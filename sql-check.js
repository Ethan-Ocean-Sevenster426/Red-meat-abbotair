import sql from 'mssql';

const cfg = {
  user: 'Anthony',
  password: 'StrongPassword123!',
  server: 'localhost',
  database: 'RMAAAuthDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

(async () => {
  try {
    const pool = await sql.connect(cfg);
    const result = await pool.request().query('SELECT 1 AS ok');
    console.log('sql-check success', result.recordset);
    await pool.close();
  } catch (error) {
    console.error('sql-check error', error.message);
    process.exit(1);
  }
})();
