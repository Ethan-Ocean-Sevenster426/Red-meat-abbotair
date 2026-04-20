import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';

const router = Router();

const DB_COLS = [
  'company','number','number_1','fax','vat_number','postal_address','physical_address',
  'contact_1','position_1','email_1','cell_1',
  'contact_2','position_2','email_2','cell_2',
  'contact_3','position_3','email_3','cell_3',
  'contact_4','position_4','email_4','cell_4',
  'diary_2022','calendar_2023',
  'modified_by','modified_time','modified_fields','old_values','new_values',
];

const BRACKET_COLS = new Set(['number']);
function colRef(c) { return BRACKET_COLS.has(c) ? `[${c}]` : c; }

const FILTERABLE = new Set(DB_COLS);
const RESERVED_PARAMS = new Set(['page', 'size', 'sortCol', 'sortDir']);

// ── GET /api/industry — paginated list ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, parseInt(req.query.size || '50', 10));
    const offset   = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const r  = pool.request();
    const cr = pool.request();
    let paramIdx = 0;

    for (const [key, rawVal] of Object.entries(req.query)) {
      if (RESERVED_PARAMS.has(key)) continue;
      if (!FILTERABLE.has(key)) continue;
      const val = String(rawVal).trim();
      if (!val) continue;
      if (val === '__blank__') {
        where += ` AND (${colRef(key)} = '' OR ${colRef(key)} IS NULL)`;
        continue;
      }
      const pName = `f${paramIdx++}`;
      where += ` AND ${colRef(key)} LIKE @${pName}`;
      r.input(pName,  sql.NVarChar(500), `%${val}%`);
      cr.input(pName, sql.NVarChar(500), `%${val}%`);
    }

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.IndustryMaster ${where}`);
    const total = countResult.recordset[0].total;

    const rawSortCol = req.query.sortCol || '';
    const sortCol    = (rawSortCol && FILTERABLE.has(rawSortCol)) ? colRef(rawSortCol) : 'id';
    const sortDir    = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(`SELECT * FROM dbo.IndustryMaster ${where} ORDER BY ${sortCol} ${sortDir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);

    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (err) {
    console.error('Industry list error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/industry/count ─────────────────────────────────────────────────
router.get('/count', async (_req, res) => {
  try {
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.IndustryMaster');
    res.json({ count: r.recordset[0].cnt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/industry/:id — update a row ────────────────────────────────────
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const row = req.body;
    const r = pool.request().input('id', sql.Int, id);
    for (const col of DB_COLS) {
      r.input(col, sql.NVarChar(sql.MAX), row[col] != null ? String(row[col]) : '');
    }
    const sets = DB_COLS.map(c => `${colRef(c)} = @${c}`).join(', ');
    await r.query(`UPDATE dbo.IndustryMaster SET ${sets} WHERE id = @id`);

    // Append to AuditLog if there are changed fields
    if (row.modified_fields) {
      await pool.request()
        .input('table_name',      sql.NVarChar(100), 'IndustryMaster')
        .input('record_id',       sql.Int,           id)
        .input('modified_by',     sql.NVarChar(500), row.modified_by     || '')
        .input('modified_time',   sql.NVarChar(100), row.modified_time   || '')
        .input('modified_fields', sql.NVarChar(sql.MAX), row.modified_fields || '')
        .input('old_values',      sql.NVarChar(sql.MAX), row.old_values  || '')
        .input('new_values',      sql.NVarChar(sql.MAX), row.new_values  || '')
        .query(`INSERT INTO dbo.AuditLog (table_name,record_id,modified_by,modified_time,modified_fields,old_values,new_values)
                VALUES (@table_name,@record_id,@modified_by,@modified_time,@modified_fields,@old_values,@new_values)`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Industry update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/industry/:id/history ───────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const result = await pool.request()
      .input('record_id',  sql.Int,          id)
      .input('table_name', sql.NVarChar(100), 'IndustryMaster')
      .query(`SELECT id, modified_by, modified_time, modified_fields, old_values, new_values, created_at
              FROM dbo.AuditLog
              WHERE table_name = @table_name AND record_id = @record_id
              ORDER BY created_at DESC`);
    res.json({ entries: result.recordset });
  } catch (err) {
    console.error('Industry history error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/industry — create a new row ───────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const row = req.body;
    const r = pool.request();
    for (const col of DB_COLS) {
      r.input(col, sql.NVarChar(sql.MAX), row[col] != null ? String(row[col]) : '');
    }
    const cols = DB_COLS.map(colRef).join(',');
    const vals = DB_COLS.map(c => '@' + c).join(',');
    const result = await r.query(
      `INSERT INTO dbo.IndustryMaster (${cols}) OUTPUT INSERTED.id VALUES (${vals})`
    );
    res.json({ ok: true, id: result.recordset[0].id });
  } catch (err) {
    console.error('Industry create error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/industry/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.IndustryMaster WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('Industry delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
