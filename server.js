import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage() });

const dbConfig = {
  user: process.env.DB_USER || 'Anthony',
  password: process.env.DB_PASSWORD || 'StrongPassword123!',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE || 'RMAAAuthDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

const RESIDUE_COLUMNS = `
  record_id NVARCHAR(64) NOT NULL,
  species NVARCHAR(50),
  est_no NVARCHAR(100),
  establishment NVARCHAR(255),
  substance NVARCHAR(100),
  specie NVARCHAR(100),
  sample_type NVARCHAR(100),
  sample_ref NVARCHAR(100),
  job_number NVARCHAR(100),
  sample_id NVARCHAR(100),
  pooled_or_single NVARCHAR(50),
  farm_name NVARCHAR(255),
  district NVARCHAR(255),
  state_vet_area NVARCHAR(255),
  province NVARCHAR(255),
  authorised_person NVARCHAR(255),
  owner NVARCHAR(255),
  authority_sampling NVARCHAR(255),
  date_collected NVARCHAR(50),
  date_signed NVARCHAR(50),
  date_received_lab NVARCHAR(50),
  date_registered NVARCHAR(50),
  date_captured NVARCHAR(50),
  reason_not_analysed NVARCHAR(500),
  date_completed_1 NVARCHAR(50),
  date_completed_2 NVARCHAR(50),
  date_completed_3 NVARCHAR(50),
  date_completed_4 NVARCHAR(50),
  date_completed_5 NVARCHAR(50),
  date_completed_6 NVARCHAR(50),
  date_completed_7 NVARCHAR(50),
  results_1 NVARCHAR(200),
  results_2 NVARCHAR(200),
  results_3 NVARCHAR(200),
  results_4 NVARCHAR(200),
  results_5 NVARCHAR(200),
  results_6 NVARCHAR(200),
  results_7 NVARCHAR(200),
  comments NVARCHAR(1000),
  non_compliant NVARCHAR(100),
  cost_screening NVARCHAR(50),
  cost_confirmation NVARCHAR(50),
  admin_cost NVARCHAR(50)
`;

function extractSpecies(sheetName) {
  const parts = sheetName.trim().split(' ');
  return parts[parts.length - 1];
}

function generateRecordId(sampleRef, dateCollected, sampleType, species) {
  const raw = `${sampleRef}|${dateCollected}|${sampleType}|${species}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function initDb() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('Connected to SQL Server successfully.');

    await pool.request().query(`
      IF DB_ID(N'RMAAAuthDB') IS NULL
      BEGIN
        CREATE DATABASE RMAAAuthDB;
      END
    `);

    if (pool.config.database !== 'RMAAAuthDB') {
      await sql.close();
      pool = await sql.connect(dbConfig);
    }

    // Users table
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.objects
        WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type = N'U'
      )
      BEGIN
        CREATE TABLE dbo.Users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          username NVARCHAR(100) UNIQUE NOT NULL,
          password NVARCHAR(200) NOT NULL,
          role NVARCHAR(50) NOT NULL,
          displayName NVARCHAR(150) NOT NULL
        );
      END
    `);

    // Seed users
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'Anthony')
        INSERT INTO dbo.Users (username, password, role, displayName)
        VALUES ('Anthony', 'StrongPassword123!', 'admin', 'Anthony');

      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'admin')
        INSERT INTO dbo.Users (username, password, role, displayName)
        VALUES ('admin', 'admin123', 'admin', 'Admin User');

      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'user')
        INSERT INTO dbo.Users (username, password, role, displayName)
        VALUES ('user', 'user123', 'user', 'Standard User');
    `);

    // Residue Monitoring Temp table
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.objects
        WHERE object_id = OBJECT_ID(N'[dbo].[ResidueMonitoringTemp]') AND type = N'U'
      )
      BEGIN
        CREATE TABLE dbo.ResidueMonitoringTemp (
          id INT IDENTITY(1,1) PRIMARY KEY,
          batch_id NVARCHAR(50) NOT NULL,
          uploaded_at DATETIME DEFAULT GETDATE(),
          ${RESIDUE_COLUMNS}
        );
      END
    `);

    // Residue Monitoring Final table
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.objects
        WHERE object_id = OBJECT_ID(N'[dbo].[ResidueMonitoring]') AND type = N'U'
      )
      BEGIN
        CREATE TABLE dbo.ResidueMonitoring (
          id INT IDENTITY(1,1) PRIMARY KEY,
          committed_at DATETIME DEFAULT GETDATE(),
          ${RESIDUE_COLUMNS}
        );
      END
    `);

    // Migrations for existing tables
    for (const table of ['ResidueMonitoringTemp', 'ResidueMonitoring']) {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'record_id')
          ALTER TABLE dbo.${table} ADD record_id NVARCHAR(64) NOT NULL DEFAULT '';
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'species')
          ALTER TABLE dbo.${table} ADD species NVARCHAR(50) NULL;
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'sheet_name')
          ALTER TABLE dbo.${table} DROP COLUMN sheet_name;
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'non_compliant' AND max_length < 200)
          ALTER TABLE dbo.${table} ALTER COLUMN non_compliant NVARCHAR(100);
      `);
    }

    console.log('SQL Server: all tables ensured.');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const result = await pool.request()
      .input('username', sql.NVarChar(100), username)
      .input('password', sql.NVarChar(200), password)
      .query(`
        SELECT id, username, role, displayName
        FROM dbo.Users
        WHERE username = @username AND password = @password
      `);

    if (result.recordset.length === 0)
      return res.status(401).json({ message: 'Invalid username or password.' });

    return res.json({ user: result.recordset[0] });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Database error during login.' });
  }
});

app.get('/api/status', async (req, res) => {
  res.json({ status: 'ok', db: pool ? 'connected' : 'notconnected' });
});

// ─── Residue Monitoring ───────────────────────────────────────────────────────

app.get('/api/residue/template', (_req, res) => {
  const filePath = path.join(__dirname, 'Residue Monitoring Upload Template.xlsx');
  res.download(filePath, 'Residue Monitoring Upload Template.xlsx', (err) => {
    if (err) {
      console.error('Template download error:', err);
      res.status(500).json({ message: 'Template file not found.' });
    }
  });
});

// Upload Excel → parse → store in temp table
app.post('/api/residue/upload', upload.single('file'), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: 'No file uploaded.' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const batchId = crypto.randomUUID();
    const allRows = [];

    const HEADER_MAP = [
      'est_no', 'establishment', 'substance', 'specie', 'sample_type',
      'sample_ref', 'job_number', 'sample_id', 'pooled_or_single', 'farm_name',
      'district', 'state_vet_area', 'province', 'authorised_person', 'owner',
      'authority_sampling', 'date_collected', 'date_signed', 'date_received_lab',
      'date_registered', 'date_captured', 'reason_not_analysed',
      'date_completed_1', 'date_completed_2', 'date_completed_3',
      'date_completed_4', 'date_completed_5', 'date_completed_6', 'date_completed_7',
      'results_1', 'results_2', 'results_3', 'results_4', 'results_5',
      'results_6', 'results_7', 'comments', 'non_compliant',
      'cost_screening', 'cost_confirmation', 'admin_cost',
    ];

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const species = extractSpecies(sheetName);
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(v => v === '' || v === null || v === undefined)) continue;
        const obj = { species, batch_id: batchId };
        HEADER_MAP.forEach((key, idx) => {
          obj[key] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : '';
        });
        obj.record_id = generateRecordId(obj.sample_ref, obj.date_collected, obj.sample_type, species);
        allRows.push(obj);
      }
    }

    for (const row of allRows) {
      await pool.request()
        .input('batch_id', sql.NVarChar(50), row.batch_id)
        .input('record_id', sql.NVarChar(64), row.record_id)
        .input('species', sql.NVarChar(50), row.species)
        .input('est_no', sql.NVarChar(100), row.est_no)
        .input('establishment', sql.NVarChar(255), row.establishment)
        .input('substance', sql.NVarChar(100), row.substance)
        .input('specie', sql.NVarChar(100), row.specie)
        .input('sample_type', sql.NVarChar(100), row.sample_type)
        .input('sample_ref', sql.NVarChar(100), row.sample_ref)
        .input('job_number', sql.NVarChar(100), row.job_number)
        .input('sample_id', sql.NVarChar(100), row.sample_id)
        .input('pooled_or_single', sql.NVarChar(50), row.pooled_or_single)
        .input('farm_name', sql.NVarChar(255), row.farm_name)
        .input('district', sql.NVarChar(255), row.district)
        .input('state_vet_area', sql.NVarChar(255), row.state_vet_area)
        .input('province', sql.NVarChar(255), row.province)
        .input('authorised_person', sql.NVarChar(255), row.authorised_person)
        .input('owner', sql.NVarChar(255), row.owner)
        .input('authority_sampling', sql.NVarChar(255), row.authority_sampling)
        .input('date_collected', sql.NVarChar(50), row.date_collected)
        .input('date_signed', sql.NVarChar(50), row.date_signed)
        .input('date_received_lab', sql.NVarChar(50), row.date_received_lab)
        .input('date_registered', sql.NVarChar(50), row.date_registered)
        .input('date_captured', sql.NVarChar(50), row.date_captured)
        .input('reason_not_analysed', sql.NVarChar(500), row.reason_not_analysed)
        .input('date_completed_1', sql.NVarChar(50), row.date_completed_1)
        .input('date_completed_2', sql.NVarChar(50), row.date_completed_2)
        .input('date_completed_3', sql.NVarChar(50), row.date_completed_3)
        .input('date_completed_4', sql.NVarChar(50), row.date_completed_4)
        .input('date_completed_5', sql.NVarChar(50), row.date_completed_5)
        .input('date_completed_6', sql.NVarChar(50), row.date_completed_6)
        .input('date_completed_7', sql.NVarChar(50), row.date_completed_7)
        .input('results_1', sql.NVarChar(200), row.results_1)
        .input('results_2', sql.NVarChar(200), row.results_2)
        .input('results_3', sql.NVarChar(200), row.results_3)
        .input('results_4', sql.NVarChar(200), row.results_4)
        .input('results_5', sql.NVarChar(200), row.results_5)
        .input('results_6', sql.NVarChar(200), row.results_6)
        .input('results_7', sql.NVarChar(200), row.results_7)
        .input('comments', sql.NVarChar(1000), row.comments)
        .input('non_compliant', sql.NVarChar(100), row.non_compliant)
        .input('cost_screening', sql.NVarChar(50), row.cost_screening)
        .input('cost_confirmation', sql.NVarChar(50), row.cost_confirmation)
        .input('admin_cost', sql.NVarChar(50), row.admin_cost)
        .query(`
          INSERT INTO dbo.ResidueMonitoringTemp (
            batch_id, record_id, species,
            est_no, establishment, substance, specie, sample_type, sample_ref,
            job_number, sample_id, pooled_or_single, farm_name, district, state_vet_area,
            province, authorised_person, owner, authority_sampling, date_collected,
            date_signed, date_received_lab, date_registered, date_captured,
            reason_not_analysed, date_completed_1, date_completed_2, date_completed_3,
            date_completed_4, date_completed_5, date_completed_6, date_completed_7,
            results_1, results_2, results_3, results_4, results_5, results_6, results_7,
            comments, non_compliant, cost_screening, cost_confirmation, admin_cost
          ) VALUES (
            @batch_id, @record_id, @species,
            @est_no, @establishment, @substance, @specie, @sample_type, @sample_ref,
            @job_number, @sample_id, @pooled_or_single, @farm_name, @district, @state_vet_area,
            @province, @authorised_person, @owner, @authority_sampling, @date_collected,
            @date_signed, @date_received_lab, @date_registered, @date_captured,
            @reason_not_analysed, @date_completed_1, @date_completed_2, @date_completed_3,
            @date_completed_4, @date_completed_5, @date_completed_6, @date_completed_7,
            @results_1, @results_2, @results_3, @results_4, @results_5, @results_6, @results_7,
            @comments, @non_compliant, @cost_screening, @cost_confirmation, @admin_cost
          )
        `);
    }

    res.json({ batchId, rowCount: allRows.length });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to process file: ' + error.message });
  }
});

// Get temp records for a batch
app.get('/api/residue/temp/:batchId', async (req, res) => {
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

// Commit selected rows (with any edits) from temp → final, then clear whole batch
app.post('/api/residue/commit-rows', async (req, res) => {
  const { batchId, rows } = req.body;
  if (!batchId || !Array.isArray(rows))
    return res.status(400).json({ message: 'Invalid request.' });

  try {
    for (const row of rows) {
      await pool.request()
        .input('record_id', sql.NVarChar(64), row.record_id || '')
        .input('species', sql.NVarChar(50), row.species || '')
        .input('est_no', sql.NVarChar(100), row.est_no || '')
        .input('establishment', sql.NVarChar(255), row.establishment || '')
        .input('substance', sql.NVarChar(100), row.substance || '')
        .input('specie', sql.NVarChar(100), row.specie || '')
        .input('sample_type', sql.NVarChar(100), row.sample_type || '')
        .input('sample_ref', sql.NVarChar(100), row.sample_ref || '')
        .input('job_number', sql.NVarChar(100), row.job_number || '')
        .input('sample_id', sql.NVarChar(100), row.sample_id || '')
        .input('pooled_or_single', sql.NVarChar(50), row.pooled_or_single || '')
        .input('farm_name', sql.NVarChar(255), row.farm_name || '')
        .input('district', sql.NVarChar(255), row.district || '')
        .input('state_vet_area', sql.NVarChar(255), row.state_vet_area || '')
        .input('province', sql.NVarChar(255), row.province || '')
        .input('authorised_person', sql.NVarChar(255), row.authorised_person || '')
        .input('owner', sql.NVarChar(255), row.owner || '')
        .input('authority_sampling', sql.NVarChar(255), row.authority_sampling || '')
        .input('date_collected', sql.NVarChar(50), row.date_collected || '')
        .input('date_signed', sql.NVarChar(50), row.date_signed || '')
        .input('date_received_lab', sql.NVarChar(50), row.date_received_lab || '')
        .input('date_registered', sql.NVarChar(50), row.date_registered || '')
        .input('date_captured', sql.NVarChar(50), row.date_captured || '')
        .input('reason_not_analysed', sql.NVarChar(500), row.reason_not_analysed || '')
        .input('date_completed_1', sql.NVarChar(50), row.date_completed_1 || '')
        .input('date_completed_2', sql.NVarChar(50), row.date_completed_2 || '')
        .input('date_completed_3', sql.NVarChar(50), row.date_completed_3 || '')
        .input('date_completed_4', sql.NVarChar(50), row.date_completed_4 || '')
        .input('date_completed_5', sql.NVarChar(50), row.date_completed_5 || '')
        .input('date_completed_6', sql.NVarChar(50), row.date_completed_6 || '')
        .input('date_completed_7', sql.NVarChar(50), row.date_completed_7 || '')
        .input('results_1', sql.NVarChar(200), row.results_1 || '')
        .input('results_2', sql.NVarChar(200), row.results_2 || '')
        .input('results_3', sql.NVarChar(200), row.results_3 || '')
        .input('results_4', sql.NVarChar(200), row.results_4 || '')
        .input('results_5', sql.NVarChar(200), row.results_5 || '')
        .input('results_6', sql.NVarChar(200), row.results_6 || '')
        .input('results_7', sql.NVarChar(200), row.results_7 || '')
        .input('comments', sql.NVarChar(1000), row.comments || '')
        .input('non_compliant', sql.NVarChar(10), row.non_compliant || '')
        .input('cost_screening', sql.NVarChar(50), row.cost_screening || '')
        .input('cost_confirmation', sql.NVarChar(50), row.cost_confirmation || '')
        .input('admin_cost', sql.NVarChar(50), row.admin_cost || '')
        .query(`
          INSERT INTO dbo.ResidueMonitoring (
            record_id, species,
            est_no, establishment, substance, specie, sample_type, sample_ref,
            job_number, sample_id, pooled_or_single, farm_name, district, state_vet_area,
            province, authorised_person, owner, authority_sampling, date_collected,
            date_signed, date_received_lab, date_registered, date_captured,
            reason_not_analysed, date_completed_1, date_completed_2, date_completed_3,
            date_completed_4, date_completed_5, date_completed_6, date_completed_7,
            results_1, results_2, results_3, results_4, results_5, results_6, results_7,
            comments, non_compliant, cost_screening, cost_confirmation, admin_cost
          ) VALUES (
            @record_id, @species,
            @est_no, @establishment, @substance, @specie, @sample_type, @sample_ref,
            @job_number, @sample_id, @pooled_or_single, @farm_name, @district, @state_vet_area,
            @province, @authorised_person, @owner, @authority_sampling, @date_collected,
            @date_signed, @date_received_lab, @date_registered, @date_captured,
            @reason_not_analysed, @date_completed_1, @date_completed_2, @date_completed_3,
            @date_completed_4, @date_completed_5, @date_completed_6, @date_completed_7,
            @results_1, @results_2, @results_3, @results_4, @results_5, @results_6, @results_7,
            @comments, @non_compliant, @cost_screening, @cost_confirmation, @admin_cost
          )
        `);
    }

    // Clear entire batch from temp (both committed and discarded rows)
    await pool.request()
      .input('batch_id', sql.NVarChar(50), batchId)
      .query(`DELETE FROM dbo.ResidueMonitoringTemp WHERE batch_id = @batch_id`);

    res.json({
      message: `${rows.length} records committed to the Residue Monitoring Database.`,
      committed: rows.length,
    });
  } catch (error) {
    console.error('Commit rows error:', error);
    res.status(500).json({ message: 'Failed to commit rows: ' + error.message });
  }
});

// Get committed (final) residue data
app.get('/api/residue/committed', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page  || '1',   10));
    const pageSize = Math.min(500, parseInt(req.query.size || '200', 10));
    const offset   = (page - 1) * pageSize;

    const countResult = await pool.request().query(`SELECT COUNT(*) AS total FROM dbo.ResidueMonitoring`);
    const total       = countResult.recordset[0].total;

    const result = await pool.request().query(`
      SELECT * FROM dbo.ResidueMonitoring
      ORDER BY (SELECT NULL)
      OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
    `);
    res.json({ total, page, pageSize, rows: result.recordset });
  } catch (error) {
    console.error('Fetch committed error:', error);
    res.status(500).json({ message: 'Failed to fetch committed data: ' + error.message });
  }
});

// Discard entire batch
app.delete('/api/residue/temp/:batchId', async (req, res) => {
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

// ─── Start ────────────────────────────────────────────────────────────────────

const port = process.env.PORT || 4000;

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend API running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
