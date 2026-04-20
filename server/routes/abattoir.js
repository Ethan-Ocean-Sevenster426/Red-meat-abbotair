import { Router } from 'express';
import sql from 'mssql';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import PizZip from 'pizzip';
import { sendDatabaseForm } from '../email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// CSV header → DB column mapping
const CSV_MAP = {
  'Abattoir Name':                          'abattoir_name',
  'RC Nr':                                  'rc_nr',
  'Province':                               'province',
  'Status':                                 'status',
  'ZA Nr':                                  'za_nr',
  'Expiry Date of ZA':                      'expiry_date_za',
  'Transformation/ Government':             'transformation_government',
  'Price Information':                      'price_information',
  'SETA':                                   'seta',
  'Tel. 1':                                 'tel_1',
  'Tel. 2':                                 'tel_2',
  'FAX':                                    'fax',
  'VAT Number':                             'vat_number',
  'Distance from Headoffice':               'distance_from_headoffice',
  'Postal Address':                         'postal_address',
  'City':                                   'city',
  'Postal Code':                            'postal_code',
  'Municipality':                           'municipality',
  'Physical Address':                       'physical_address',
  ' GPS Coordinates (DMS)':                 'gps_1',
  'GPS Coordinates (DMS)':                  'gps_1',
  ' GPS Coordinates (DMS) 2':              'gps_2',
  'GPS Coordinates (DMS) 2':               'gps_2',
  'Owner':                                  'owner',
  'Owner email':                            'owner_email',
  'Owner Cell':                             'owner_cell',
  'Manager':                                'manager',
  'Manager email':                          'manager_email',
  'Manager Cell':                           'manager_cell',
  'Training':                               'training',
  'Training email':                         'training_email',
  'Training Cell':                          'training_cell',
  'Accounts':                               'accounts',
  'Account email':                          'accounts_email',
  'Accounts Cell':                          'accounts_cell',
  'Emails':                                 'emails',
  'Meat Inspection Services (Assignee Name)': 'assignee_name',
  'Assignee Contact Name':                  'assignee_contact_name',
  'Assignee Contact Number':                'assignee_contact_number',
  'Meat Inspectors':                        'meat_inspectors',
  'Meat Examiner':                          'meat_examiner',
  'QA Manager/s or HMS Contact':            'qa_manager',
  'Floor Supervisor':                       'floor_supervisor',
  'Technical Manager':                      'technical_manager',
  'Contact Number':                         'contact_number',
  'Email':                                  'email',
  'Quality Control & Hygiene Manager':      'qc_hygiene_manager',
  'Cell Number':                            'cell_number',
  'Email Control & Hygiene Manager':        'email_qc_hygiene',
  'L/H':                                    'lh',
  'G':                                      'g',
  'Units':                                  'units',
  'Amount Slaughtered':                     'amount_slaughtered',
  'CATTLE':                                 'cattle',
  'CALVES':                                 'calves',
  'SHEEP':                                  'sheep',
  'PIG':                                    'pig',
  'GOAT':                                   'goat',
  'GAME':                                   'game',
  'CROCODILES':                             'crocodiles',
  'HORSES':                                 'horses',
  'Kosher':                                 'kosher',
  'Halaal':                                 'halaal',
  'Classification (C/NC)':                  'classification',
  'Grader':                                 'grader',
  'Deboning Plant':                         'deboning_plant',
  'Processing Plant':                       'processing_plant',
  'Rendering Plant':                        'rendering_plant',
  'Residue':                                'residue',
  '2018 Member':                            'member_2018',
  '2019 Member':                            'member_2019',
  '2020 Members':                           'member_2020',
  '2021 Members':                           'member_2021',
  '2022 Members':                           'member_2022',
  '2023 Members':                           'member_2023',
  '2024 Members':                           'member_2024',
  '2025 Members':                           'member_2025',
  '2026 Members':                           'member_2026',
  'Other Comments':                         'other_comments',
  'Modified By':                            'modified_by',
  'Modified':                               'modified_time',
  'Modified Fields':                        'modified_fields',
  'Old Values':                             'old_values',
  'New Values':                             'new_values',
  'Can Mail Be sent to Client?':            'can_mail',
  'Date Mail Sent':                         'date_mail_sent',
  'Verification':                           'verification',
  'DB UPDATED':                             'db_updated',
  'Latest Update Received':                 'latest_update_received',
  'Data Base Comment':                      'db_comment',
};

const DB_COLS = [
  'abattoir_name','rc_nr','province','status','za_nr','expiry_date_za',
  'transformation_government','price_information','seta','tel_1','tel_2','fax',
  'vat_number','distance_from_headoffice','postal_address','city','postal_code',
  'municipality','physical_address','gps_1','gps_2','owner','owner_email',
  'owner_cell','manager','manager_email','manager_cell','training','training_email',
  'training_cell','accounts','accounts_email','accounts_cell','emails',
  'assignee_name','assignee_contact_name','assignee_contact_number','meat_inspectors',
  'meat_examiner','qa_manager','floor_supervisor','technical_manager','contact_number',
  'email','qc_hygiene_manager','cell_number','email_qc_hygiene','lh','g','units',
  'amount_slaughtered','cattle','calves','sheep','pig','goat','game','crocodiles',
  'horses','kosher','halaal','classification','grader','deboning_plant',
  'processing_plant','rendering_plant','residue','member_2018','member_2019',
  'member_2020','member_2021','member_2022','member_2023','member_2024','member_2025',
  'member_2026','other_comments','modified_by','modified_time','modified_fields',
  'old_values','new_values','can_mail','date_mail_sent','verification',
  'db_updated','latest_update_received','db_comment',
];

function bindRow(req, row) {
  for (const col of DB_COLS) {
    const val = row[col] != null ? String(row[col]) : '';
    const maxLen = ['other_comments','modified_fields','old_values','new_values','db_comment'].includes(col) ? sql.NVarChar(sql.MAX) : sql.NVarChar(500);
    req.input(col, maxLen, val.substring(0, col === 'other_comments' || col === 'modified_fields' || col === 'old_values' || col === 'new_values' || col === 'db_comment' ? 999999 : 500));
  }
  return req;
}

const INSERT_SQL = `
  INSERT INTO dbo.AbattoirMaster (${DB_COLS.join(',')})
  VALUES (${DB_COLS.map(c => '@' + c).join(',')})
`;

// Columns that are safe to filter on (prevents SQL injection via column name)
const FILTERABLE = new Set(DB_COLS);
// Reserved query params (not column filters)
const RESERVED_PARAMS = new Set(['page', 'size', 'sortCol', 'sortDir']);

// ── GET /api/abattoir/names — returns all abattoir names (registered + custom) ─
router.get('/names', async (_req, res) => {
  try {
    const registered = await pool.request()
      .query("SELECT abattoir_name AS name, municipality, province, [lh] AS thru_put FROM dbo.AbattoirMaster WHERE abattoir_name IS NOT NULL AND abattoir_name <> '' ORDER BY abattoir_name");
    const custom = await pool.request()
      .query("SELECT id, name, NULL AS municipality FROM dbo.CustomAbattoirs ORDER BY name");
    res.json({ registered: registered.recordset, custom: custom.recordset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/abattoir/custom — add custom abattoir ───────────────────────────
router.post('/custom', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Name required' });
  try {
    const r = await pool.request()
      .input('name', sql.NVarChar(255), name.trim())
      .query('INSERT INTO dbo.CustomAbattoirs (name) OUTPUT INSERTED.id, INSERTED.name VALUES (@name)');
    res.json(r.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/abattoir/custom/:id — delete custom abattoir ─────────────────
router.delete('/custom/:id', async (req, res) => {
  try {
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM dbo.CustomAbattoirs WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/abattoir — paginated list ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, parseInt(req.query.size || '50', 10));
    const offset   = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const r  = pool.request();
    const cr = pool.request();
    let paramIdx = 0;

    // Per-column filters: any query param whose name matches a DB column
    for (const [key, rawVal] of Object.entries(req.query)) {
      if (RESERVED_PARAMS.has(key)) continue;
      if (!FILTERABLE.has(key)) continue;
      const val = String(rawVal).trim();
      if (!val) continue;
      const col = key === 'status' || key === 'g' ? `[${key}]` : key;
      if (val === '__blank__') {
        where += ` AND (${col} = '' OR ${col} IS NULL)`;
        continue;
      }
      const pName = `f${paramIdx++}`;
      where += ` AND ${col} LIKE @${pName}`;
      r.input(pName,  sql.NVarChar(500), `%${val}%`);
      cr.input(pName, sql.NVarChar(500), `%${val}%`);
    }

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.AbattoirMaster ${where}`);
    const total = countResult.recordset[0].total;

    const rawSortCol = req.query.sortCol || '';
    const sortColA   = (rawSortCol && FILTERABLE.has(rawSortCol)) ? (rawSortCol === 'status' || rawSortCol === 'g' ? `[${rawSortCol}]` : rawSortCol) : 'id';
    const sortDir    = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const result = await r.query(`SELECT * FROM dbo.AbattoirMaster ${where} ORDER BY ${sortColA} ${sortDir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);

    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (err) {
    console.error('Abattoir list error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/abattoir/:id — update a row ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const row = req.body;
    const r = pool.request().input('id', sql.Int, id);
    for (const col of DB_COLS) {
      const val = row[col] != null ? String(row[col]) : '';
      r.input(col, sql.NVarChar(sql.MAX), val);
    }
    const sets = DB_COLS.map(c => `${c === 'status' || c === 'g' ? `[${c}]` : c} = @${c}`).join(', ');
    await r.query(`UPDATE dbo.AbattoirMaster SET ${sets} WHERE id = @id`);

    if (row.modified_fields) {
      await pool.request()
        .input('table_name',      sql.NVarChar(100), 'AbattoirMaster')
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
    console.error('Abattoir update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/abattoir/:id/history ────────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const result = await pool.request()
      .input('record_id',  sql.Int,          id)
      .input('table_name', sql.NVarChar(100), 'AbattoirMaster')
      .query(`SELECT id, modified_by, modified_time, modified_fields, old_values, new_values, created_at
              FROM dbo.AuditLog
              WHERE table_name = @table_name AND record_id = @record_id
              ORDER BY created_at DESC`);
    res.json({ entries: result.recordset });
  } catch (err) {
    console.error('Abattoir history error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/abattoir — create a new row ─────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const row = req.body;
    const r = pool.request();
    for (const col of DB_COLS) {
      r.input(col, sql.NVarChar(sql.MAX), row[col] != null ? String(row[col]) : '');
    }
    const result = await r.query(
      `INSERT INTO dbo.AbattoirMaster (${DB_COLS.join(',')}) OUTPUT INSERTED.id VALUES (${DB_COLS.map(c => '@' + c).join(',')})`
    );
    res.json({ ok: true, id: result.recordset[0].id });
  } catch (err) {
    console.error('Abattoir create error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/abattoir/:id — delete a row ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.AbattoirMaster WHERE id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('Abattoir delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/abattoir/import — one-time CSV import ───────────────────────────
router.post('/import', async (req, res) => {
  try {
    const countRes = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.AbattoirMaster');
    if (countRes.recordset[0].cnt > 0 && !req.query.force) {
      return res.status(409).json({ message: `Table already has ${countRes.recordset[0].cnt} rows. Use ?force=1 to reimport.` });
    }

    const csvPath = path.join(__dirname, '../../Abattoir Master Database (1).csv');
    const workbook = XLSX.readFile(csvPath, { type: 'file', raw: true });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    if (req.query.force) {
      await pool.request().query('DELETE FROM dbo.AbattoirMaster');
    }

    let imported = 0;
    for (const rawRow of rawRows) {
      const row = {};
      for (const DB_COLS_INIT of DB_COLS) row[DB_COLS_INIT] = '';

      for (const [csvHeader, dbCol] of Object.entries(CSV_MAP)) {
        const trimmed = csvHeader.trim();
        // try exact match first, then trimmed
        const val = rawRow[csvHeader] ?? rawRow[trimmed] ?? '';
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
    console.error('Abattoir import error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/abattoir/count — quick row count ─────────────────────────────────
router.get('/count', async (_req, res) => {
  try {
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.AbattoirMaster');
    res.json({ count: r.recordset[0].cnt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ── Generate and email filled Database Form ───────────────────────────────────

// Fills inline Word content controls by their <w:tag w:val="..."> name
function fillContentControls(xml, data) {
  return xml.replace(/<w:sdt\b[\s\S]*?<\/w:sdt>/g, (sdt) => {
    const tagMatch = sdt.match(/<w:tag\s+w:val="([^"]+)"/);
    if (!tagMatch) return sdt;
    const tagName = tagMatch[1];
    if (!(tagName in data)) return sdt;

    const escaped = String(data[tagName])
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Preserve the run properties (font/size) from the first <w:rPr> inside sdtContent
    const rPrMatch = sdt.match(/<w:sdtContent>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)/);
    const rPr = rPrMatch ? rPrMatch[1] : '';

    // Replace sdtContent with a single inline run (no <w:p> — these are inline controls)
    return sdt.replace(
      /(<w:sdtContent>)[\s\S]*?(<\/w:sdtContent>)/,
      `$1<w:r><w:rPr>${rPr.replace(/^<w:rPr>/, '').replace(/<\/w:rPr>$/, '')}</w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>$2`
    );
  });
}

function buildFormBuffer(row) {
  const v = (val) => (val != null && val !== '') ? String(val) : '';

  const data = {
    AbattoirName:            v(row.abattoir_name),
    RegistrationNr:          v(row.rc_nr),
    ExportNumber:            v(row.za_nr),
    Units:                   v(row.units),
    Slaughter:               v(row.amount_slaughtered),
    Throughput:              v(row.lh),
    Cattle:                  v(row.cattle),
    Sheep:                   v(row.sheep),
    Pigs:                    v(row.pig),
    Game:                    v(row.game),
    Horses:                  v(row.horses),
    VATNumber:               v(row.vat_number),
    Halaal:                  v(row.halaal),
    Kosher:                  v(row.kosher),
    SETA:                    v(row.seta),
    Telephone1:              v(row.tel_1),
    Telephone2:              v(row.tel_2),
    FAX:                     v(row.fax),
    Municipality:            v(row.municipality),
    PostalAddress:           v(row.postal_address),
    Owner:                   v(row.owner),
    OwnerEmail:              v(row.owner_email),
    OwnerCell:               v(row.owner_cell),
    Manager:                 v(row.manager),
    ManagerEmail:            v(row.manager_email),
    ManagerCell:             v(row.manager_cell),
    Training:                v(row.training),
    TrainingEmail:           v(row.training_email),
    TrainingCell:            v(row.training_cell),
    Accounts:                v(row.accounts),
    AccountsEmail:           v(row.accounts_email),
    AccountsCell:            v(row.accounts_cell),
    MeatInspectionServices:  v(row.assignee_name),
    MIServiceContactDetails: v(row.assignee_contact_name) + (row.assignee_contact_number ? ' / ' + row.assignee_contact_number : ''),
    MeatInspectors:          v(row.meat_inspectors),
    MeatExaminers:           v(row.meat_examiner),
    Graders:                 v(row.grader),
    Classifier:              v(row.classification),
    QAManager:               v(row.qa_manager),
    FloorSupervisor:         v(row.floor_supervisor),
    PhysicalAddress:         v(row.physical_address),
    GPSCoordinates:          [row.gps_1, row.gps_2].filter(Boolean).join(' / '),
  };

  const templatePath = path.join(__dirname, '../../RMAA Database Form.docx');
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);

  const docXml = zip.files['word/document.xml'].asText();
  const filled = fillContentControls(docXml, data);
  zip.file('word/document.xml', filled);

  return zip.generate({ type: 'nodebuffer' });
}

router.post('/:id/send-database-form', async (req, res) => {
  try {
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM dbo.AbattoirMaster WHERE id = @id');

    if (result.recordset.length === 0)
      return res.status(404).json({ message: 'Record not found.' });

    const row = result.recordset[0];
    const filename = `RMAA Database Form - ${row.abattoir_name || 'Abattoir'}.docx`;
    const buf = buildFormBuffer(row);

    const emailResult = await sendDatabaseForm({
      to: 'training@rmaa.co.za',
      abattoirName: row.abattoir_name || 'Unknown Abattoir',
      trainingEmail: row.training_email || '',
      docBuffer: buf,
      filename,
    });

    if (!emailResult.ok)
      return res.status(500).json({ message: 'Form generated but email failed: ' + emailResult.reason });

    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sentDate = `${String(now.getDate()).padStart(2,'0')}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(2)}`;

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('date_mail_sent', sql.NVarChar(50), sentDate)
      .query('UPDATE dbo.AbattoirMaster SET date_mail_sent = @date_mail_sent WHERE id = @id');

    // Record in audit log
    await pool.request()
      .input('table_name',      sql.NVarChar(100), 'AbattoirMaster')
      .input('record_id',       sql.Int,           req.params.id)
      .input('modified_by',     sql.NVarChar(255), 'System')
      .input('modified_fields', sql.NVarChar(sql.MAX), JSON.stringify(['date_mail_sent']))
      .input('old_values',      sql.NVarChar(sql.MAX), JSON.stringify({ date_mail_sent: row.date_mail_sent || '' }))
      .input('new_values',      sql.NVarChar(sql.MAX), JSON.stringify({ date_mail_sent: sentDate }))
      .query(`INSERT INTO dbo.AuditLog (table_name, record_id, modified_by, modified_fields, old_values, new_values, created_at)
              VALUES (@table_name, @record_id, @modified_by, @modified_fields, @old_values, @new_values, GETDATE())`);

    res.json({ ok: true, dateSent: sentDate, message: `Database form sent successfully for ${row.abattoir_name}.` });
  } catch (err) {
    console.error('Database form send error:', err);
    res.status(500).json({ message: 'Failed to send form: ' + err.message });
  }
});

export default router;
