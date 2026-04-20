import { Router } from 'express';
import sql from 'mssql';
import multer from 'multer';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload    = multer({ storage: multer.memoryStorage() });
const router    = Router();

function extractSpecies(sheetName) {
  const parts = sheetName.trim().split(' ');
  return parts[parts.length - 1];
}

function generateRecordId(sampleRef, dateCollected, sampleType, species) {
  const raw = `${sampleRef}|${dateCollected}|${sampleType}|${species}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const HEADER_MAP = [
  'est_no','establishment','substance','specie','sample_type',
  'sample_ref','job_number','sample_id','pooled_or_single','farm_name',
  'district','state_vet_area','province','authorised_person','owner',
  'authority_sampling','date_collected','date_signed','date_received_lab',
  'date_registered','date_captured','reason_not_analysed',
  'date_completed_1','date_completed_2','date_completed_3',
  'date_completed_4','date_completed_5','date_completed_6','date_completed_7',
  'results_1','results_2','results_3','results_4','results_5',
  'results_6','results_7','comments','non_compliant',
  'cost_screening','cost_confirmation','admin_cost',
];

// All data columns for the ResidueMonitoring table (used by PUT)
const ALL_DATA_COLS = [
  'record_id','species',
  'est_no','establishment','substance','specie','sample_type','sample_ref',
  'job_number','sample_id','pooled_or_single','farm_name','district','state_vet_area',
  'province','authorised_person','owner','authority_sampling','date_collected',
  'date_signed','date_received_lab','date_registered','date_captured',
  'reason_not_analysed',
  'date_completed_1','date_completed_2','date_completed_3',
  'date_completed_4','date_completed_5','date_completed_6','date_completed_7',
  'results_1','substance_results_1','ppb_results_1',
  'results_2','substance_results_2','ppb_results_2',
  'results_3','substance_results_3','ppb_results_3',
  'results_4','substance_results_4','ppb_results_4',
  'results_5','substance_results_5','ppb_results_5',
  'results_6','substance_results_6','ppb_results_6',
  'results_7','substance_results_7','ppb_results_7',
  'comments','non_compliant','cost_screening','cost_confirmation','admin_cost',
  'modified_by','modified_time','modified_fields','old_values','new_values',
];

// Columns inserted from upload (no substance/ppb/modified — those are added manually)
const INSERT_COLS = [
  'record_id','species',
  'est_no','establishment','substance','specie','sample_type','sample_ref',
  'job_number','sample_id','pooled_or_single','farm_name','district','state_vet_area',
  'province','authorised_person','owner','authority_sampling','date_collected',
  'date_signed','date_received_lab','date_registered','date_captured',
  'reason_not_analysed',
  'date_completed_1','date_completed_2','date_completed_3',
  'date_completed_4','date_completed_5','date_completed_6','date_completed_7',
  'results_1','results_2','results_3','results_4','results_5','results_6','results_7',
  'comments','non_compliant','cost_screening','cost_confirmation','admin_cost',
];

// SQL type map matching actual table column definitions (must match db.js)
const COL_TYPE = {
  record_id:            sql.NVarChar(64),
  species:              sql.NVarChar(50),
  est_no:               sql.NVarChar(100),
  establishment:        sql.NVarChar(255),
  substance:            sql.NVarChar(100),
  specie:               sql.NVarChar(100),
  sample_type:          sql.NVarChar(100),
  sample_ref:           sql.NVarChar(100),
  job_number:           sql.NVarChar(100),
  sample_id:            sql.NVarChar(100),
  pooled_or_single:     sql.NVarChar(50),
  farm_name:            sql.NVarChar(255),
  district:             sql.NVarChar(255),
  state_vet_area:       sql.NVarChar(255),
  province:             sql.NVarChar(255),
  authorised_person:    sql.NVarChar(255),
  owner:                sql.NVarChar(255),
  authority_sampling:   sql.NVarChar(255),
  date_collected:       sql.NVarChar(50),
  date_signed:          sql.NVarChar(50),
  date_received_lab:    sql.NVarChar(50),
  date_registered:      sql.NVarChar(50),
  date_captured:        sql.NVarChar(50),
  reason_not_analysed:  sql.NVarChar(500),
  date_completed_1:     sql.NVarChar(50),
  date_completed_2:     sql.NVarChar(50),
  date_completed_3:     sql.NVarChar(50),
  date_completed_4:     sql.NVarChar(50),
  date_completed_5:     sql.NVarChar(50),
  date_completed_6:     sql.NVarChar(50),
  date_completed_7:     sql.NVarChar(50),
  results_1:            sql.NVarChar(200),
  substance_results_1:  sql.NVarChar(200),
  ppb_results_1:        sql.NVarChar(200),
  results_2:            sql.NVarChar(200),
  substance_results_2:  sql.NVarChar(200),
  ppb_results_2:        sql.NVarChar(200),
  results_3:            sql.NVarChar(200),
  substance_results_3:  sql.NVarChar(200),
  ppb_results_3:        sql.NVarChar(200),
  results_4:            sql.NVarChar(200),
  substance_results_4:  sql.NVarChar(200),
  ppb_results_4:        sql.NVarChar(200),
  results_5:            sql.NVarChar(200),
  substance_results_5:  sql.NVarChar(200),
  ppb_results_5:        sql.NVarChar(200),
  results_6:            sql.NVarChar(200),
  substance_results_6:  sql.NVarChar(200),
  ppb_results_6:        sql.NVarChar(200),
  results_7:            sql.NVarChar(200),
  substance_results_7:  sql.NVarChar(200),
  ppb_results_7:        sql.NVarChar(200),
  comments:             sql.NVarChar(1000),
  non_compliant:        sql.NVarChar(100),
  cost_screening:       sql.NVarChar(50),
  cost_confirmation:    sql.NVarChar(50),
  admin_cost:           sql.NVarChar(50),
  modified_by:          sql.NVarChar(255),
  modified_time:        sql.NVarChar(100),
  modified_fields:      sql.NVarChar(sql.MAX),
  old_values:           sql.NVarChar(sql.MAX),
  new_values:           sql.NVarChar(sql.MAX),
};

// Download template
router.get('/template', (req, res) => {
  const filePath = path.join(__dirname, '../../Residue Monitoring Upload Template.xlsx');
  res.download(filePath, 'Residue Monitoring Upload Template.xlsx', (err) => {
    if (err) res.status(500).json({ message: 'Template file not found.' });
  });
});

// Upload Excel → temp table
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const batchId  = crypto.randomUUID();
    const allRows  = [];

    for (const sheetName of workbook.SheetNames) {
      const ws      = workbook.Sheets[sheetName];
      const rows    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const species = extractSpecies(sheetName);
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(v => v === '' || v == null)) continue;
        const obj = { species, batch_id: batchId };
        HEADER_MAP.forEach((key, idx) => {
          obj[key] = row[idx] != null ? String(row[idx]) : '';
        });
        obj.record_id = generateRecordId(obj.sample_ref, obj.date_collected, obj.sample_type, species);
        allRows.push(obj);
      }
    }

    // Batched insert into temp table (100 rows per INSERT for speed)
    const BATCH = 40;
    const colList = ['batch_id', ...INSERT_COLS].join(', ');
    for (let i = 0; i < allRows.length; i += BATCH) {
      const chunk = allRows.slice(i, i + BATCH);
      const r = pool.request();
      const valueSets = [];
      chunk.forEach((row, ri) => {
        const params = [`@b${ri}`];
        r.input(`b${ri}`, sql.NVarChar(50), row.batch_id);
        INSERT_COLS.forEach((col, ci) => {
          const pName = `p${ri}_${ci}`;
          params.push(`@${pName}`);
          r.input(pName, sql.NVarChar(sql.MAX), row[col] != null ? String(row[col]) : '');
        });
        valueSets.push(`(${params.join(', ')})`);
      });
      await r.query(`INSERT INTO dbo.ResidueMonitoringTemp (${colList}) VALUES ${valueSets.join(', ')}`);
    }

    res.json({ batchId, rowCount: allRows.length });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to process file: ' + error.message });
  }
});

// Get temp batch for preview
router.get('/temp/:batchId', async (req, res) => {
  try {
    const result = await pool.request()
      .input('batch_id', sql.NVarChar(50), req.params.batchId)
      .query(`SELECT * FROM dbo.ResidueMonitoringTemp WHERE batch_id = @batch_id ORDER BY id`);
    res.json(result.recordset);
  } catch (error) {
    console.error('Fetch temp error:', error);
    res.status(500).json({ message: 'Failed to fetch temp data.' });
  }
});

// Commit selected rows → final table, clear batch from temp
router.post('/commit-rows', async (req, res) => {
  const { batchId, rows } = req.body;
  if (!batchId || !Array.isArray(rows))
    return res.status(400).json({ message: 'Invalid request.' });

  try {
    // Build a Set of existing keys in one query for fast duplicate detection
    const existingKeys = new Set();
    // Fetch all existing composite keys from committed table
    const allExisting = await pool.request().query(
      `SELECT sample_ref, date_collected, sample_type, species FROM dbo.ResidueMonitoring`
    );
    for (const r of allExisting.recordset) {
      const key = `${(r.sample_ref||'').trim()}|${(r.date_collected||'').trim()}|${(r.sample_type||'').trim()}|${(r.species||'').trim()}`;
      existingKeys.add(key);
    }

    const newRows = [];
    let duplicateCount = 0;
    for (const row of rows) {
      const key = `${String(row.sample_ref||'').trim()}|${String(row.date_collected||'').trim()}|${String(row.sample_type||'').trim()}|${String(row.species||'').trim()}`;
      if (existingKeys.has(key)) {
        duplicateCount++;
      } else {
        newRows.push(row);
        existingKeys.add(key); // prevent intra-batch duplicates too
      }
    }

    if (newRows.length > 0) {
      const BATCH = 40;
      const colList = INSERT_COLS.join(', ');
      for (let i = 0; i < newRows.length; i += BATCH) {
        const chunk = newRows.slice(i, i + BATCH);
        const r = pool.request();
        const valueSets = [];
        chunk.forEach((row, ri) => {
          const params = [];
          INSERT_COLS.forEach((col, ci) => {
            const pName = `p${ri}_${ci}`;
            params.push(`@${pName}`);
            r.input(pName, sql.NVarChar(sql.MAX), row[col] != null ? String(row[col]) : '');
          });
          valueSets.push(`(${params.join(', ')})`);
        });
        await r.query(`INSERT INTO dbo.ResidueMonitoring (${colList}) VALUES ${valueSets.join(', ')}`);
      }
    }

    await pool.request()
      .input('batch_id', sql.NVarChar(50), batchId)
      .query(`DELETE FROM dbo.ResidueMonitoringTemp WHERE batch_id = @batch_id`);

    let msg = `${newRows.length} records committed.`;
    if (duplicateCount > 0) msg += ` ${duplicateCount} duplicate(s) skipped.`;
    res.json({ message: msg, committed: newRows.length, duplicates: duplicateCount });
  } catch (error) {
    console.error('Commit rows error:', error);
    res.status(500).json({ message: 'Failed to commit rows: ' + error.message });
  }
});

// Fetch committed (final) data with pagination and per-column filtering
router.get('/committed', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(99999, parseInt(req.query.size || '200', 10));
    const offset   = (page - 1) * pageSize;

    const RESERVED = new Set(['page', 'size']);
    const FILTERABLE = new Set(ALL_DATA_COLS);

    let where = 'WHERE 1=1';
    const r  = pool.request();
    const cr = pool.request();
    let paramIdx = 0;

    for (const [key, rawVal] of Object.entries(req.query)) {
      if (RESERVED.has(key)) continue;
      if (!FILTERABLE.has(key)) continue;
      const val = String(rawVal).trim();
      if (!val) continue;
      const pName = `f${paramIdx++}`;
      where += ` AND ${key} LIKE @${pName}`;
      r.input(pName, sql.NVarChar(500), `%${val}%`);
      cr.input(pName, sql.NVarChar(500), `%${val}%`);
    }

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.ResidueMonitoring ${where}`);
    const total = countResult.recordset[0].total;

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(
      `SELECT * FROM dbo.ResidueMonitoring ${where} ORDER BY id OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
    );
    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (error) {
    console.error('Fetch committed error:', error);
    res.status(500).json({ message: 'Failed to fetch committed data: ' + error.message });
  }
});

// ── PUT /api/residue/committed/:id — update a committed row ──────────────────
router.put('/committed/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const row = req.body;
    const r = pool.request().input('id', sql.Int, id);
    for (const col of ALL_DATA_COLS) {
      r.input(col, COL_TYPE[col] || sql.NVarChar(255), row[col] != null ? String(row[col]) : '');
    }
    const sets = ALL_DATA_COLS.map(c => `${c} = @${c}`).join(', ');
    await r.query(`UPDATE dbo.ResidueMonitoring SET ${sets} WHERE id = @id`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Residue committed update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Clear all committed data
router.delete('/committed/all', async (req, res) => {
  try {
    const result = await pool.request().query('DELETE FROM dbo.ResidueMonitoring');
    res.json({ ok: true, deleted: result.rowsAffected[0] });
  } catch (error) {
    console.error('Clear committed error:', error);
    res.status(500).json({ message: 'Failed to clear: ' + error.message });
  }
});

// Discard entire batch
router.delete('/temp/:batchId', async (req, res) => {
  try {
    await pool.request()
      .input('batch_id', sql.NVarChar(50), req.params.batchId)
      .query(`DELETE FROM dbo.ResidueMonitoringTemp WHERE batch_id = @batch_id`);
    res.json({ message: 'Batch discarded.' });
  } catch (error) {
    console.error('Discard error:', error);
    res.status(500).json({ message: 'Failed to discard batch.' });
  }
});

export default router;
