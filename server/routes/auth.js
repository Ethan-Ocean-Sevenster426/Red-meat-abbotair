import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const result = await pool.request()
      .input('email',    sql.NVarChar(255), email)
      .input('password', sql.NVarChar(200), password)
      .query(`SELECT id, username, email, role, displayName FROM dbo.Users WHERE email = @email AND password = @password`);

    if (result.recordset.length === 0)
      return res.status(401).json({ message: 'Invalid email or password.' });

    return res.json({ user: result.recordset[0] });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Database error during login.' });
  }
});

export default router;
