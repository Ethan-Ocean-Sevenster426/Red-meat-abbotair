import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';

const router = Router();

// GET /api/user-prefs?page=X&userId=Y
router.get('/', async (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  const page   = (req.query.page || '').trim();
  if (!userId || !page) return res.json({ hiddenColumns: [] });
  try {
    const r = await pool.request()
      .input('user_id',   sql.Int,          userId)
      .input('page_name', sql.NVarChar(100), page)
      .query(`SELECT hidden_columns FROM dbo.UserColumnPreferences
              WHERE user_id = @user_id AND page_name = @page_name`);
    if (r.recordset.length === 0) return res.json({ hiddenColumns: [], columnOrder: [] });
    const row = r.recordset[0];
    res.json({
      hiddenColumns: JSON.parse(row.hidden_columns || '[]'),
      columnOrder: JSON.parse(row.column_order || '[]'),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/user-prefs?page=X&userId=Y  body: { hiddenColumns: [...] }
router.put('/', async (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  const page   = (req.query.page || '').trim();
  if (!userId || !page) return res.status(400).json({ message: 'Missing userId or page' });
  const hidden = JSON.stringify(Array.isArray(req.body.hiddenColumns) ? req.body.hiddenColumns : []);
  const order  = JSON.stringify(Array.isArray(req.body.columnOrder) ? req.body.columnOrder : []);
  try {
    // Ensure column_order column exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserColumnPreferences') AND name = 'column_order')
        ALTER TABLE dbo.UserColumnPreferences ADD column_order NVARCHAR(MAX) DEFAULT '[]'
    `);
    await pool.request()
      .input('user_id',        sql.Int,          userId)
      .input('page_name',      sql.NVarChar(100), page)
      .input('hidden_columns', sql.NVarChar(sql.MAX), hidden)
      .input('column_order',   sql.NVarChar(sql.MAX), order)
      .query(`
        MERGE dbo.UserColumnPreferences AS target
        USING (VALUES (@user_id, @page_name, @hidden_columns, @column_order)) AS src (user_id, page_name, hidden_columns, column_order)
        ON target.user_id = src.user_id AND target.page_name = src.page_name
        WHEN MATCHED THEN UPDATE SET hidden_columns = src.hidden_columns, column_order = src.column_order
        WHEN NOT MATCHED THEN INSERT (user_id, page_name, hidden_columns, column_order) VALUES (src.user_id, src.page_name, src.hidden_columns, src.column_order);
      `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
