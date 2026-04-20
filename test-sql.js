import sql from 'mssql';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf-8')
    .trim()
    .split('\n')
    .map((line) => line.split('='))
);

const config = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: env.DB_SERVER,
  database: env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

(async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT 1 AS one');
    console.log('connected ok', result.recordset);
    await sql.close();
  } catch (error) {
    console.error('direct-connection error', error);
    process.exit(1);
  }
})();
