/**
 * Extract all data from SQL Server database into Excel files for seeding.
 *
 * Usage:  node extract-data.js
 * Output: seed-data/ folder with one .xlsx per table
 */
import sql from 'mssql';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const dbConfig = {
  user:     process.env.DB_USER     || 'Anthony',
  password: process.env.DB_PASSWORD || 'StrongPassword123!',
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE || 'RMAAAuthDB',
  options: {
    encrypt:              false,
    trustServerCertificate: true,
    enableArithAbort:     true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

// Tables to extract — data tables first, then system tables
const TABLES = [
  'AbattoirMaster',
  'TransformationMaster',
  'GovernmentMaster',
  'IndustryMaster',
  'AssociatedMembersMaster',
  'STTTrainingReport',
  'TrainingReport',
  'ResidueMonitoring',
  'CustomAbattoirs',
  'Users',
  'AuditLog',
  'UserColumnPreferences',
  'Invitations',
];

async function main() {
  const outDir = path.join(process.cwd(), 'seed-data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Connecting to SQL Server...');
  const pool = await sql.connect(dbConfig);
  console.log('Connected.\n');

  const summary = [];

  for (const table of TABLES) {
    process.stdout.write(`Extracting ${table}... `);

    try {
      // Check if table exists
      const exists = await pool.request().query(
        `SELECT OBJECT_ID(N'dbo.${table}') AS oid`
      );
      if (!exists.recordset[0].oid) {
        console.log('TABLE NOT FOUND — skipped');
        summary.push({ table, rows: 0, status: 'not found' });
        continue;
      }

      // Get row count
      const countResult = await pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.[${table}]`);
      const rowCount = countResult.recordset[0].cnt;

      // Get all data
      const result = await pool.request().query(`SELECT * FROM dbo.[${table}]`);
      const rows = result.recordset;

      if (rows.length === 0) {
        console.log(`0 rows — skipped`);
        summary.push({ table, rows: 0, status: 'empty' });
        continue;
      }

      // Get column names from the first row
      const columns = Object.keys(rows[0]);

      // Create workbook
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(table);

      // Header row
      ws.addRow(columns);
      const headerRow = ws.getRow(1);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0078D4' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Data rows
      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          if (val instanceof Date) return val.toISOString();
          return String(val);
        });
        ws.addRow(values);
      }

      // Auto-size columns (approximate)
      ws.columns.forEach((col, i) => {
        const colName = columns[i] || '';
        let maxLen = colName.length;
        rows.slice(0, 100).forEach(row => {
          const val = row[colName];
          if (val) {
            const len = String(val).length;
            if (len > maxLen) maxLen = len;
          }
        });
        col.width = Math.min(Math.max(maxLen + 2, 10), 50);
      });

      // Freeze header row
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      // Save
      const filePath = path.join(outDir, `${table}.xlsx`);
      await wb.xlsx.writeFile(filePath);

      console.log(`${rowCount} rows → ${table}.xlsx`);
      summary.push({ table, rows: rowCount, status: 'ok' });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      summary.push({ table, rows: 0, status: `error: ${err.message}` });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('EXTRACTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`${'Table'.padEnd(30)} ${'Rows'.padStart(8)}  Status`);
  console.log('-'.repeat(60));
  let totalRows = 0;
  for (const s of summary) {
    console.log(`${s.table.padEnd(30)} ${String(s.rows).padStart(8)}  ${s.status}`);
    totalRows += s.rows;
  }
  console.log('-'.repeat(60));
  console.log(`${'TOTAL'.padEnd(30)} ${String(totalRows).padStart(8)}`);
  console.log(`\nFiles saved to: ${outDir}`);

  await sql.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
