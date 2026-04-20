import { Router } from 'express';
import sql from 'mssql';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pool } from '../db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { convertExcelToPdf } from '../email.js';

const execFileAsync = promisify(execFile);

// Use real Excel via PowerShell COM to set A4 portrait fit-to-page + print area A1:AD53
async function applyPrintSettings(xlsxBuffer) {
  // Use C:\Temp to avoid spaces in path that break Excel COM SaveAs
  const tmpDir = 'C:\\Temp\\stt';
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpIn  = `${tmpDir}\\stt_${Date.now()}.xlsx`;
  fs.writeFileSync(tmpIn, xlsxBuffer);

  const ps = `
$ErrorActionPreference = 'Stop'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open('${tmpIn.replace(/\\/g, '\\\\')}')
  $ws = $wb.Worksheets.Item(1)
  $pg = $ws.PageSetup
  $pg.PrintArea      = '$A$1:$AD$53'
  $pg.Zoom           = $false
  $pg.FitToPagesWide = 1
  $pg.FitToPagesTall = 1
  $pg.PaperSize      = 9
  $pg.Orientation    = 1
  $wb.Save()
  $wb.Close($false)
} finally {
  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
`;

  await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 60000 });
  const result = fs.readFileSync(tmpIn);
  try { fs.unlinkSync(tmpIn); } catch {}
  return result;
}

const __dirnameR = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT  = path.resolve(__dirnameR, '..', '..', 'documents');

function sanitizeName(str) {
  return (str || 'Unknown').replace(/[<>:"/\\|?*\r\n]/g, '_').trim() || 'Unknown';
}

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

const DB_COLS = [
  'province','municipality','name','surname','id_number','year_of_birth','age',
  'citizen','race_gender','training_date','training_start_date','training_end_date','abattoir_name','thru_put','specie',
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
const RESERVED_PARAMS = new Set(['page', 'size', 'sortCol', 'sortDir', '_years', '_months', '_provinces', '_idCheck']);

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
      if (val === '__blank__') {
        where += ` AND (${colRef(key)} = '' OR ${colRef(key)} IS NULL)`;
        continue;
      }
      const pName = `f${paramIdx++}`;
      where += ` AND ${colRef(key)} LIKE @${pName}`;
      r.input(pName,  sql.NVarChar(500), `%${val}%`);
      cr.input(pName, sql.NVarChar(500), `%${val}%`);
    }

    // Multi-select filters (comma-separated)
    const yearsParam = req.query._years;
    if (yearsParam) {
      const yrs = yearsParam.split(',').map(Number).filter(n => n > 0 && n < 3000);
      if (yrs.length) where += ` AND YEAR(TRY_CAST(training_start_date AS DATE)) IN (${yrs.join(',')})`;
    }
    const monthsParam = req.query._months;
    if (monthsParam) {
      const mos = monthsParam.split(',').map(Number).filter(n => n >= 1 && n <= 12);
      if (mos.length) where += ` AND MONTH(TRY_CAST(training_start_date AS DATE)) IN (${mos.join(',')})`;
    }
    const provsParam = req.query._provinces;
    if (provsParam) {
      const provs = provsParam.split(',').filter(Boolean);
      if (provs.length) {
        const phs = provs.map((p, i) => { const n = `pv${i}`; r.input(n, sql.NVarChar(200), p); cr.input(n, sql.NVarChar(200), p); return `@${n}`; });
        where += ` AND province IN (${phs.join(',')})`;
      }
    }
    const idCheck = req.query._idCheck;
    if (idCheck === 'duplicate') {
      where += ` AND id_number IN (SELECT id_number FROM dbo.STTTrainingReport WHERE id_number IS NOT NULL AND id_number <> '' GROUP BY id_number HAVING COUNT(*) > 1)`;
    } else if (idCheck === 'incorrect') {
      where += ` AND id_number IS NOT NULL AND id_number <> '' AND LEN(id_number) <> 13`;
    } else if (idCheck === 'missing') {
      where += ` AND (id_number IS NULL OR id_number = '')`;
    }

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.STTTrainingReport ${where}`);
    const total = countResult.recordset[0].total;

    const rawSortCol = req.query.sortCol || '';
    const sortCol    = (rawSortCol && FILTERABLE.has(rawSortCol)) ? colRef(rawSortCol) : 'id';
    const sortDir    = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(
      `SELECT * FROM dbo.STTTrainingReport ${where} ORDER BY ${sortCol} ${sortDir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
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
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.STTTrainingReport');
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
    await r.query(`UPDATE dbo.STTTrainingReport SET ${sets} WHERE id = @id`);

    // Append to AuditLog if there are changed fields
    if (row.modified_fields) {
      await pool.request()
        .input('table_name',      sql.NVarChar(100), 'STTTrainingReport')
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
      .input('table_name',  sql.NVarChar(100), 'STTTrainingReport')
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
      `INSERT INTO dbo.STTTrainingReport (${cols}) OUTPUT INSERTED.id VALUES (${vals})`
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
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.STTTrainingReport WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('TrainingReport delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /parse-excel — parse uploaded STT attendance register ────────────────
router.post('/parse-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];

    const cv = (row, col) => {
      const cell = ws.getRow(row).getCell(col);
      if (cell.value === null || cell.value === undefined) return '';
      return String(cell.value).trim();
    };

    // Extract session fields from row 16
    const session = {
      programme:   cv(16, 'C'),  // Name of Training Programme
      specie:      cv(16, 'G'),  // Species
      facilitator: cv(16, 'L'),  // Name of Facilitator
      contact:     cv(16, 'Y'),  // Contact Number
    };

    // Extract data rows 19–48
    // D=WorkStation, F=Surname, I=Name, L–X=ID digits (13 digits), Z=Race, AA=Gender
    const ID_COLS = ['L','M','N','O','P','Q','R','S','T','U','V','W','X'];
    const rows = [];

    for (let r = 19; r <= 48; r++) {
      const workStation = cv(r, 'D');
      const surname     = cv(r, 'F');
      const name        = cv(r, 'I');
      const race        = cv(r, 'Z');
      const gender      = cv(r, 'AA');
      const idNumber    = ID_COLS.map(c => cv(r, c)).join('').replace(/\s/g, '');

      // Skip blank rows
      if (!surname && !name && !idNumber) continue;

      rows.push({
        work_station: workStation,
        surname,
        name,
        id_number: idNumber,
        race_gender: (race + gender).trim(),
      });
    }

    res.json({ session, rows });
  } catch (err) {
    console.error('Excel parse error:', err);
    res.status(500).json({ message: 'Failed to parse Excel file: ' + err.message });
  }
});

// ── POST /export-pdf — convert uploaded Excel (A1:AD53) to A4 portrait PDF ────
router.post('/export-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const printBuffer = await applyPrintSettings(req.file.buffer);
    const pdfBuf = await convertExcelToPdf(printBuffer);

    // Save to Document Library: Province → Abattoir Name → STT Training Documents → STT Training DD-MM-YYYY Abattoir
    const province   = sanitizeName(req.body.province || 'Unknown Province');
    const abattoir   = sanitizeName(req.body.abattoir || 'Unknown Abattoir');
    const now        = new Date();
    const dd         = String(now.getDate()).padStart(2, '0');
    const mm         = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy       = now.getFullYear();
    const folderName = `STT Training ${dd}-${mm}-${yyyy} ${abattoir}`;
    const saveDir    = path.join(DOCS_ROOT, province, abattoir, 'STT Training Documents', folderName);
    fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(path.join(saveDir, `${folderName}.xlsx`), req.file.buffer);
    fs.writeFileSync(path.join(saveDir, `${folderName}.pdf`), pdfBuf);

    res.json({ ok: true });
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ message: 'PDF conversion failed: ' + err.message });
  }
});

// ── GET /api/stt-training-report/breakdown — aggregated report ───────────────
router.get('/breakdown', async (req, res) => {
  try {
    const r = pool.request();
    let where = 'WHERE 1=1';
    let pi = 0;

    const { year, month, quarter, province, abattoir } = req.query;

    // Multi-value: comma-separated years
    if (year) {
      const yrs = year.split(',').map(Number).filter(n => n > 0 && n < 3000);
      if (yrs.length) where += ` AND YEAR(TRY_CAST(training_start_date AS DATE)) IN (${yrs.join(',')})`;
    }
    // Multi-value: comma-separated months
    if (month) {
      const mos = month.split(',').map(Number).filter(n => n >= 1 && n <= 12);
      if (mos.length) where += ` AND MONTH(TRY_CAST(training_start_date AS DATE)) IN (${mos.join(',')})`;
    }
    if (quarter) {
      const q = parseInt(quarter);
      // Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12
      const mStart = (q - 1) * 3 + 1;
      const mEnd   = q * 3;
      where += ` AND MONTH(TRY_CAST(training_start_date AS DATE)) BETWEEN @p${pi} AND @p${pi+1}`;
      r.input(`p${pi++}`, sql.Int, mStart);
      r.input(`p${pi++}`, sql.Int, mEnd);
    }
    // Multi-value: comma-separated provinces
    if (province) {
      const provs = province.split(',').filter(Boolean);
      if (provs.length) {
        const phs = provs.map((p, i) => { const n = `p${pi++}`; r.input(n, sql.NVarChar(200), p); return `@${n}`; });
        where += ` AND province IN (${phs.join(',')})`;
      }
    }
    if (abattoir) {
      const abs = abattoir.split(',').filter(Boolean);
      if (abs.length === 1) {
        where += ` AND abattoir_name LIKE @p${pi}`;
        r.input(`p${pi++}`, sql.NVarChar(500), `%${abs[0]}%`);
      } else if (abs.length > 1) {
        const phs = abs.map((a, i) => { const n = `p${pi++}`; r.input(n, sql.NVarChar(500), a); return `@${n}`; });
        where += ` AND abattoir_name IN (${phs.join(',')})`;
      }
    }

    const sql_query = `
      SELECT
        training_start_date,
        training_end_date,
        abattoir_name,
        municipality,
        province,
        thru_put,
        specie,
        COUNT(*) AS total_trained,
        SUM(CASE WHEN am   = '1' THEN 1 ELSE 0 END) AS am,
        SUM(CASE WHEN af   = '1' THEN 1 ELSE 0 END) AS af,
        SUM(CASE WHEN cm   = '1' THEN 1 ELSE 0 END) AS cm,
        SUM(CASE WHEN cf   = '1' THEN 1 ELSE 0 END) AS cf,
        SUM(CASE WHEN im   = '1' THEN 1 ELSE 0 END) AS im,
        SUM(CASE WHEN if_  = '1' THEN 1 ELSE 0 END) AS if_,
        SUM(CASE WHEN wm   = '1' THEN 1 ELSE 0 END) AS wm,
        SUM(CASE WHEN wf   = '1' THEN 1 ELSE 0 END) AS wf,
        SUM(CASE WHEN age_lt35  = '1' THEN 1 ELSE 0 END) AS age_lt35,
        SUM(CASE WHEN age_35_55 = '1' THEN 1 ELSE 0 END) AS age_35_55,
        SUM(CASE WHEN age_gt55  = '1' THEN 1 ELSE 0 END) AS age_gt55,
        SUM(CASE WHEN am='1' OR af='1' OR cm='1' OR cf='1' OR im='1' OR if_='1' THEN 1 ELSE 0 END) AS hdis,
        SUM(CASE WHEN disability = 'Yes' THEN 1 ELSE 0 END) AS disability_count
      FROM dbo.STTTrainingReport
      ${where}
      GROUP BY training_start_date, training_end_date, abattoir_name, municipality, province, thru_put, specie
      ORDER BY training_start_date ASC, abattoir_name ASC, specie ASC
    `;

    const result = await r.query(sql_query);

    // Also return distinct values for filter dropdowns
    const filtersResult = await pool.request().query(`
      SELECT DISTINCT
        YEAR(TRY_CAST(training_start_date AS DATE)) AS yr,
        province,
        abattoir_name
      FROM dbo.STTTrainingReport
      WHERE training_start_date IS NOT NULL AND training_start_date != ''
      ORDER BY yr DESC
    `);

    const years     = [...new Set(filtersResult.recordset.map(r => r.yr).filter(Boolean))].sort((a,b) => b-a);
    const provinces = [...new Set(filtersResult.recordset.map(r => r.province).filter(Boolean))].sort();
    const abattoirs = [...new Set(filtersResult.recordset.map(r => r.abattoir_name).filter(Boolean))].sort();

    res.json({ rows: result.recordset, years, provinces, abattoirs });
  } catch (err) {
    console.error('Breakdown error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
