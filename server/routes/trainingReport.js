import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';

const router = Router();

const DB_COLS = [
  'province','municipality','name','surname','id_number','year_of_birth','age',
  'citizen','race_gender','training_date','abattoir_name','thru_put','specie',
  'work_station','report_to_client','reported_by','sample_take','lab_report_received',
  'am','af','ad','cm','cf','cd','im','if_','id_2','wm','wf','wd',
  'tot_m','tot_f','tot_d',
  'age_lt35','age_35_55','age_gt55','age_2',
  'total_race_gender','total_male_female','total_per_age_group',
  'disability',
  'modified_by','modified_time','modified_fields','old_values','new_values',
];

// Columns that need bracket quoting (reserved words / special chars)
const BRACKET_COLS = new Set(['if_', 'id_2', 'name']);
function colRef(c) { return BRACKET_COLS.has(c) ? `[${c}]` : c; }

const FILTERABLE = new Set(DB_COLS);
const RESERVED_PARAMS = new Set(['page', 'size']);

// ── GET /api/training-report — paginated list ────────────────────────────────
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
      const pName = `f${paramIdx++}`;
      where += ` AND ${colRef(key)} LIKE @${pName}`;
      r.input(pName,  sql.NVarChar(500), `%${val}%`);
      cr.input(pName, sql.NVarChar(500), `%${val}%`);
    }

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.TrainingReport ${where}`);
    const total = countResult.recordset[0].total;

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(
      `SELECT * FROM dbo.TrainingReport ${where} ORDER BY id OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
    );

    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (err) {
    console.error('TrainingReport list error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/training-report/count ──────────────────────────────────────────
router.get('/count', async (_req, res) => {
  try {
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.TrainingReport');
    res.json({ count: r.recordset[0].cnt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/training-report/:id — update a row ──────────────────────────────
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
    await r.query(`UPDATE dbo.TrainingReport SET ${sets} WHERE id = @id`);

    // Append to AuditLog if there are changed fields
    if (row.modified_fields) {
      await pool.request()
        .input('table_name',      sql.NVarChar(100), 'TrainingReport')
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
    console.error('TrainingReport update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/training-report/:id/history ────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const result = await pool.request()
      .input('record_id',  sql.Int,          id)
      .input('table_name', sql.NVarChar(100), 'TrainingReport')
      .query(`SELECT id, modified_by, modified_time, modified_fields, old_values, new_values, created_at
              FROM dbo.AuditLog
              WHERE table_name = @table_name AND record_id = @record_id
              ORDER BY created_at DESC`);
    res.json({ entries: result.recordset });
  } catch (err) {
    console.error('TrainingReport history error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/training-report — create a new row ─────────────────────────────
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
      `INSERT INTO dbo.TrainingReport (${cols}) OUTPUT INSERTED.id VALUES (${vals})`
    );
    res.json({ ok: true, id: result.recordset[0].id });
  } catch (err) {
    console.error('TrainingReport create error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/training-report/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.TrainingReport WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('TrainingReport delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
