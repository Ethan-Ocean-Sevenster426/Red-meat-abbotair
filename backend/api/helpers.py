"""Shared helpers for the RMAA Django API.

Contains:
- Generic master-CRUD view builder (list/count/create/update/delete/history)
- LIKE-filter + paginate helper
- Audit-log append helper
- Name sanitiser for filesystem paths
"""
from __future__ import annotations
import json
from datetime import datetime
from django.db import connection
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response


def sanitize_fs_name(s: str | None) -> str:
    """Strip filesystem-unsafe chars — mirrors the Node sanitize()."""
    if not s:
        return 'Unknown'
    import re
    cleaned = re.sub(r'[<>:"/\\|?*\r\n]', '_', str(s)).strip()
    return cleaned or 'Unknown'


def json_field(value) -> str:
    """Serialize any value to a JSON string for TEXT columns."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


def row_to_dict(cursor, row) -> dict:
    cols = [c[0] for c in cursor.description]
    return dict(zip(cols, row))


def rows_to_dicts(cursor) -> list[dict]:
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, r)) for r in cursor.fetchall()]


def table_name(model) -> str:
    return model._meta.db_table


def safe_col_ref(col: str, bracket_cols: set[str]) -> str:
    """Quote column name if reserved — works on both MySQL and SQLite."""
    if col in bracket_cols:
        # SQLite and MySQL both accept double-quotes for identifiers in ANSI mode,
        # but MySQL default uses backticks. Use backticks for MySQL-compat.
        vendor = connection.vendor
        if vendor == 'mysql':
            return f'`{col}`'
        # SQLite and Postgres accept double quotes
        return f'"{col}"'
    return col


def append_audit_log(table: str, record_id: int, row: dict):
    """Insert an AuditLog entry if the row has a modified_fields payload."""
    if not row.get('modified_fields'):
        return
    with connection.cursor() as c:
        c.execute(
            """INSERT INTO AuditLog
               (table_name, record_id, modified_by, modified_time, modified_fields, old_values, new_values, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            [
                table,
                record_id,
                str(row.get('modified_by') or ''),
                str(row.get('modified_time') or ''),
                json_field(row.get('modified_fields')),
                json_field(row.get('old_values')),
                json_field(row.get('new_values')),
                datetime.utcnow(),
            ],
        )


def apply_column_filters(
    query_params,
    columns: list[str],
    bracket_cols: set[str],
    reserved: set[str],
):
    """
    Replicate the Node master-list filter behavior:
    - Any query param whose key matches a column adds `AND col LIKE %val%`
    - Value `__blank__` matches empty/NULL
    Returns (where_sql, params_list).
    """
    where_parts = []
    params = []
    for key, raw_val in query_params.items():
        if key in reserved:
            continue
        if key not in columns:
            continue
        val = (raw_val or '').strip()
        if not val:
            continue
        col_ref = safe_col_ref(key, bracket_cols)
        if val == '__blank__':
            where_parts.append(f"({col_ref} = '' OR {col_ref} IS NULL)")
            continue
        where_parts.append(f"{col_ref} LIKE %s")
        params.append(f'%{val}%')
    return where_parts, params


def build_master_crud(
    model,
    *,
    columns: list[str],
    bracket_cols: set[str] | None = None,
    audit_table: str | None = None,
):
    """
    Build DRF-style function views for a master CRUD resource.

    Usage:
        views = build_master_crud(AbattoirMaster,
                                  columns=DB_COLS,
                                  bracket_cols={'status', 'g'},
                                  audit_table='AbattoirMaster')
        path('', views['list_create']),
        path('count', views['count']),
        path('<int:pk>', views['retrieve_update_delete']),
        path('<int:pk>/history', views['history']),
    """
    bracket_cols = bracket_cols or set()
    reserved = {'page', 'size', 'sortCol', 'sortDir'}
    tbl = model._meta.db_table

    @api_view(['GET', 'POST'])
    def list_create(request):
        if request.method == 'POST':
            return _create(request, model, columns, bracket_cols)
        return _list(request, model, columns, bracket_cols, reserved)

    @api_view(['GET'])
    def count(request):
        with connection.cursor() as c:
            c.execute(f'SELECT COUNT(*) FROM {tbl}')
            n = c.fetchone()[0]
        return Response({'count': n})

    @api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
    def retrieve_update_delete(request, pk: int):
        if request.method in ('PUT', 'PATCH'):
            return _update(request, model, columns, bracket_cols, pk, audit_table or tbl)
        if request.method == 'DELETE':
            return _delete(model, pk)
        # GET single (not commonly used by frontend but useful)
        with connection.cursor() as c:
            c.execute(f'SELECT * FROM {tbl} WHERE id = %s', [pk])
            rows = rows_to_dicts(c)
        if not rows:
            return Response({'message': 'Not found'}, status=404)
        return Response(rows[0])

    @api_view(['GET'])
    def history(request, pk: int):
        with connection.cursor() as c:
            c.execute(
                """SELECT id, modified_by, modified_time, modified_fields,
                          old_values, new_values, created_at
                   FROM AuditLog
                   WHERE table_name = %s AND record_id = %s
                   ORDER BY created_at DESC""",
                [audit_table or tbl, pk],
            )
            entries = rows_to_dicts(c)
        return Response({'entries': entries})

    return {
        'list_create': list_create,
        'count': count,
        'retrieve_update_delete': retrieve_update_delete,
        'history': history,
    }


def _list(request, model, columns, bracket_cols, reserved):
    try:
        page = max(1, int(request.query_params.get('page', '1')))
        page_size = min(100, int(request.query_params.get('size', '50')))
    except ValueError:
        page, page_size = 1, 50
    offset = (page - 1) * page_size
    tbl = model._meta.db_table

    where_parts, params = apply_column_filters(
        request.query_params.dict(), columns, bracket_cols, reserved
    )
    where_sql = ('WHERE ' + ' AND '.join(where_parts)) if where_parts else ''

    sort_col_raw = request.query_params.get('sortCol', '')
    sort_col = safe_col_ref(sort_col_raw, bracket_cols) if sort_col_raw in columns else 'id'
    sort_dir = 'DESC' if request.query_params.get('sortDir') == 'desc' else 'ASC'

    with connection.cursor() as c:
        c.execute(f'SELECT COUNT(*) FROM {tbl} {where_sql}', params)
        total = c.fetchone()[0]

        c.execute(
            f'SELECT * FROM {tbl} {where_sql} ORDER BY {sort_col} {sort_dir} '
            f'LIMIT %s OFFSET %s',
            params + [page_size, offset],
        )
        rows = rows_to_dicts(c)
    return Response({'total': total, 'page': page, 'pageSize': page_size, 'rows': rows})


def _create(request, model, columns, bracket_cols):
    row = request.data or {}
    tbl = model._meta.db_table
    col_refs = [safe_col_ref(c, bracket_cols) for c in columns]
    placeholders = ['%s'] * len(columns)
    values = [str(row.get(c, '') or '') for c in columns]
    sql = f'INSERT INTO {tbl} ({",".join(col_refs)}) VALUES ({",".join(placeholders)})'
    with connection.cursor() as c:
        c.execute(sql, values)
        c.execute('SELECT LAST_INSERT_ID()' if connection.vendor == 'mysql' else 'SELECT last_insert_rowid()')
        new_id = c.fetchone()[0]
    return Response({'ok': True, 'id': new_id})


def _update(request, model, columns, bracket_cols, pk, audit_table):
    row = request.data or {}
    tbl = model._meta.db_table
    sets = ', '.join(f'{safe_col_ref(c, bracket_cols)} = %s' for c in columns)
    values = [str(row.get(c, '') or '') for c in columns] + [pk]
    with connection.cursor() as c:
        c.execute(f'UPDATE {tbl} SET {sets} WHERE id = %s', values)
    append_audit_log(audit_table, pk, row)
    return Response({'ok': True})


def _delete(model, pk):
    tbl = model._meta.db_table
    with connection.cursor() as c:
        c.execute(f'DELETE FROM {tbl} WHERE id = %s', [pk])
    return Response({'ok': True})
