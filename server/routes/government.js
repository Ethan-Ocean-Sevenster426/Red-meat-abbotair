import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const DB_COLS = [
  'department','detail','name','tel_1','cellphone_number','email','position',
  'department_2','directorate','sub_directors','address','blank_1','town',
  'blank_2','notes','modified_by','modified_time','modified_fields',
  'old_values','new_values',
];

const BRACKET_COLS = new Set([]);
function colRef(c) { return BRACKET_COLS.has(c) ? `[${c}]` : c; }

const FILTERABLE = new Set(DB_COLS);
const RESERVED_PARAMS = new Set(['page', 'size', 'sortCol', 'sortDir']);

// ── GET /api/government — paginated list ─────────────────────────────────────
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

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.GovernmentMaster ${where}`);
    const total = countResult.recordset[0].total;

    const rawSortCol = req.query.sortCol || '';
    const sortCol    = (rawSortCol && FILTERABLE.has(rawSortCol)) ? colRef(rawSortCol) : 'id';
    const sortDir    = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(`SELECT * FROM dbo.GovernmentMaster ${where} ORDER BY ${sortCol} ${sortDir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);

    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (err) {
    console.error('Government list error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/government/count ────────────────────────────────────────────────
router.get('/count', async (_req, res) => {
  try {
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.GovernmentMaster');
    res.json({ count: r.recordset[0].cnt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/government/:id — update a row ───────────────────────────────────
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
    await r.query(`UPDATE dbo.GovernmentMaster SET ${sets} WHERE id = @id`);

    // Append to AuditLog if there are changed fields
    if (row.modified_fields) {
      await pool.request()
        .input('table_name',      sql.NVarChar(100), 'GovernmentMaster')
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
    console.error('Government update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/government/:id/history ─────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const result = await pool.request()
      .input('record_id',  sql.Int,          id)
      .input('table_name', sql.NVarChar(100), 'GovernmentMaster')
      .query(`SELECT id, modified_by, modified_time, modified_fields, old_values, new_values, created_at
              FROM dbo.AuditLog
              WHERE table_name = @table_name AND record_id = @record_id
              ORDER BY created_at DESC`);
    res.json({ entries: result.recordset });
  } catch (err) {
    console.error('Government history error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/government — create a new row ──────────────────────────────────
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
      `INSERT INTO dbo.GovernmentMaster (${cols}) OUTPUT INSERTED.id VALUES (${vals})`
    );
    res.json({ ok: true, id: result.recordset[0].id });
  } catch (err) {
    console.error('Government create error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/government/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.GovernmentMaster WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('Government delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/government/import — import from Book7.xlsx ──────────────────────
const CSV_MAP = {
  'Department':        'department',
  'Detail':            'detail',
  'Name':              'name',
  'Tel 1':             'tel_1',
  'Cellphone Number':  'cellphone_number',
  'Email':             'email',
  'Position':          'position',
  'Department 2':      'department_2',
  'Directorate':       'directorate',
  'Sub-Directorate':   'sub_directors',
  'Address':           'address',
  'Blank 1':           'blank_1',
  'Town':              'town',
  'Blank 2':           'blank_2',
  'NOTES':             'notes',
};

router.post('/import', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const xlsPath = path.resolve(__dirname, '..', '..', 'Book7.xlsx');
    const wb = XLSX.readFile(xlsPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!force) {
      const chk = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.GovernmentMaster');
      if (chk.recordset[0].cnt > 0) {
        return res.status(409).json({ message: `Table already has ${chk.recordset[0].cnt} rows. Use ?force=1 to reimport.` });
      }
    } else {
      await pool.request().query('DELETE FROM dbo.GovernmentMaster');
    }

    const DATA_COLS = DB_COLS.filter(c => !c.startsWith('modified_') && c !== 'old_values' && c !== 'new_values');
    let inserted = 0;
    for (const row of rows) {
      const mapped = {};
      for (const [xlsHeader, dbCol] of Object.entries(CSV_MAP)) {
        mapped[dbCol] = row[xlsHeader] != null ? String(row[xlsHeader]).trim() : '';
      }
      const r = pool.request();
      for (const col of DATA_COLS) {
        r.input(col, sql.NVarChar(sql.MAX), mapped[col] || '');
      }
      const cols = DATA_COLS.map(colRef).join(',');
      const vals = DATA_COLS.map(c => '@' + c).join(',');
      await r.query(`INSERT INTO dbo.GovernmentMaster (${cols}) VALUES (${vals})`);
      inserted++;
    }

    res.json({ ok: true, inserted });
  } catch (err) {
    console.error('Government import error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
