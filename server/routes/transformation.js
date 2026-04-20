import { Router } from 'express';
import sql from 'mssql';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const DB_COLS = [
  'abattoir_name','rn_nr','ifc','status','report_date','za_nr','expiry_date_za',
  'import_col','black_owned','transformation_abattoirs','contributing','province',
  'seta','tel_1','tel_2','fax','vat_number','postal_address','city','postal_code',
  'municipality','physical_address','gps_coordinates','blank','owner','owner_email',
  'owner_cell','manager','manager_email','manager_cell','training','training_email',
  'training_cell','accounts','accounts_email','accounts_cell','emails',
  'technical_manager','contact_number','email','qc_hygiene_manager','qc_hygiene_cell',
  'qc_hygiene_email','member_2018','member_2019','member_2020','member_2021',
  'member_2022','member_2023','member_2024','member_2025','kosher','halaal',
  'deboning_plant','processing_plant','rendering_plant','residue','lh','g','units',
  'cattle','calves','sheep','pig','goat','game','crocodiles',
  'meat_inspection_services','blank_1','blank_2','blank_3','db_updated',
  'latest_update_received','db_comment','other_comments','returned_email',
  'returned_email_comments','diaries_2022','calendars_2023','notebooks_2024',
  'modified_by','modified_time','modified_fields','old_values','new_values',
];

// Columns needing bracket-escaping (SQL reserved words)
const BRACKET_COLS = new Set(['status', 'g']);

function colRef(c) { return BRACKET_COLS.has(c) ? `[${c}]` : c; }

const FILTERABLE = new Set(DB_COLS);
const RESERVED_PARAMS = new Set(['page', 'size', 'sortCol', 'sortDir']);

// ── GET /api/transformation — paginated list ─────────────────────────────────
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

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.TransformationMaster ${where}`);
    const total = countResult.recordset[0].total;

    const rawSortCol = req.query.sortCol || '';
    const sortCol    = (rawSortCol && FILTERABLE.has(rawSortCol)) ? colRef(rawSortCol) : 'id';
    const sortDir    = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(`SELECT * FROM dbo.TransformationMaster ${where} ORDER BY ${sortCol} ${sortDir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);

    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (err) {
    console.error('Transformation list error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/transformation/count ────────────────────────────────────────────
router.get('/count', async (_req, res) => {
  try {
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.TransformationMaster');
    res.json({ count: r.recordset[0].cnt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/transformation/:id — update a row ──────────────────────────────
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
    await r.query(`UPDATE dbo.TransformationMaster SET ${sets} WHERE id = @id`);

    if (row.modified_fields) {
      await pool.request()
        .input('table_name',      sql.NVarChar(100), 'TransformationMaster')
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
    console.error('Transformation update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/transformation/:id/history ─────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const result = await pool.request()
      .input('record_id',  sql.Int,          id)
      .input('table_name', sql.NVarChar(100), 'TransformationMaster')
      .query(`SELECT id, modified_by, modified_time, modified_fields, old_values, new_values, created_at
              FROM dbo.AuditLog
              WHERE table_name = @table_name AND record_id = @record_id
              ORDER BY created_at DESC`);
    res.json({ entries: result.recordset });
  } catch (err) {
    console.error('Transformation history error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/transformation — create a new row ─────────────────────────────
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
      `INSERT INTO dbo.TransformationMaster (${cols}) OUTPUT INSERTED.id VALUES (${vals})`
    );
    res.json({ ok: true, id: result.recordset[0].id });
  } catch (err) {
    console.error('Transformation create error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/transformation/:id ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.TransformationMaster WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('Transformation delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── CSV/XLSX header → DB column mapping ─────────────────────────────────────
const CSV_MAP = {
  'Title':                                      'abattoir_name',
  'RC Nr':                                      'rn_nr',
  'IFC':                                        'ifc',
  'Status':                                     'status',
  'Report Date':                                'report_date',
  'ZA Nr':                                      'za_nr',
  'Exp of ZA':                                  'expiry_date_za',
  'Import':                                     'import_col',
  'Black Owned':                                'black_owned',
  'Transformation Abattoirs':                   'transformation_abattoirs',
  'Contributing':                               'contributing',
  'Province':                                   'province',
  'SETA':                                       'seta',
  'Tel. 1':                                     'tel_1',
  'Tel. 2':                                     'tel_2',
  'Fax':                                        'fax',
  'VAT Number':                                 'vat_number',
  'Postal Address':                             'postal_address',
  'City':                                       'city',
  'Postal Code':                                'postal_code',
  'Municipality':                               'municipality',
  'Physical Address':                           'physical_address',
  'GPS Coordinates  (DMS)':                     'gps_coordinates',
  'GPS Coordinates (DMS)':                      'gps_coordinates',
  'Blank':                                      'blank',
  'Owner':                                      'owner',
  'Owner email':                                'owner_email',
  'Owner Cell':                                 'owner_cell',
  'Manager':                                    'manager',
  'Manager email':                              'manager_email',
  'Manager Cell':                               'manager_cell',
  'Training':                                   'training',
  'Training email':                             'training_email',
  'Training Cell':                              'training_cell',
  'Accounts':                                   'accounts',
  'Account email':                              'accounts_email',
  'Accounts Cell':                              'accounts_cell',
  'Emails':                                     'emails',
  'Technical Manager':                          'technical_manager',
  'Contact Number':                             'contact_number',
  'Email':                                      'email',
  'Quality Controll & Hygiene Manager':         'qc_hygiene_manager',
  'Quality Controll & Hygiene Manager Cell Number': 'qc_hygiene_cell',
  'Quality Controll & Hygiene Manager Email':   'qc_hygiene_email',
  '2018 Member':                                'member_2018',
  '2019 Member':                                'member_2019',
  '2020 Members':                               'member_2020',
  '2021 Members':                               'member_2021',
  '2022 Members':                               'member_2022',
  '2023 Members':                               'member_2023',
  '2024 Members':                               'member_2024',
  '2025 Members':                               'member_2025',
  'Kosher':                                     'kosher',
  'Halaal':                                     'halaal',
  'Deboning Plant':                             'deboning_plant',
  'Processing Plant':                           'processing_plant',
  'Rendering Plant':                            'rendering_plant',
  'Residue':                                    'residue',
  'L/H':                                        'lh',
  'G':                                          'g',
  'Units':                                      'units',
  'CATTLE':                                     'cattle',
  'CALVES':                                     'calves',
  'SHEEP':                                      'sheep',
  'PIG':                                        'pig',
  'GOAT':                                       'goat',
  'GAME':                                       'game',
  'CROCODILES':                                 'crocodiles',
  'Meat Inspection Services':                   'meat_inspection_services',
  'Blank 1':                                    'blank_1',
  'Blank 2':                                    'blank_2',
  'Blank 3':                                    'blank_3',
  'DB UPDATED':                                 'db_updated',
  'Latest Update Received':                     'latest_update_received',
  'Data Base Comment':                          'db_comment',
  'Other Comments':                             'other_comments',
  'Returned Email':                             'returned_email',
  'Returned Email Comments':                    'returned_email_comments',
  '2022 Diaries':                               'diaries_2022',
  '2023 Calendars':                             'calendars_2023',
  '2024 Note Books':                            'notebooks_2024',
};

const INSERT_SQL = `INSERT INTO dbo.TransformationMaster (${DB_COLS.map(colRef).join(',')}) VALUES (${DB_COLS.map(c => '@' + c).join(',')})`;

// ── POST /api/transformation/import — XLSX import ───────────────────────────
router.post('/import', async (req, res) => {
  try {
    const countRes = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.TransformationMaster');
    if (countRes.recordset[0].cnt > 0 && !req.query.force) {
      return res.status(409).json({ message: `Table already has ${countRes.recordset[0].cnt} rows. Use ?force=1 to reimport.` });
    }

    const xlsxPath = path.join(__dirname, '../../Book6.xlsx');
    const workbook = XLSX.readFile(xlsxPath, { type: 'file', raw: true });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    if (req.query.force) {
      await pool.request().query('DELETE FROM dbo.TransformationMaster');
    }

    let imported = 0;
    for (const rawRow of rawRows) {
      const row = {};
      for (const col of DB_COLS) row[col] = '';

      for (const [csvHeader, dbCol] of Object.entries(CSV_MAP)) {
        const val = rawRow[csvHeader] ?? rawRow[csvHeader.trim()] ?? '';
        if (val !== '' && val != null) row[dbCol] = String(val);
      }

      const r = pool.request();
      for (const col of DB_COLS) {
        r.input(col, sql.NVarChar(sql.MAX), row[col] || '');
      }
      await r.query(INSERT_SQL);
      imported++;
    }

    res.json({ imported });
  } catch (err) {
    console.error('Transformation import error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
