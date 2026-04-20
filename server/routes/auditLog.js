import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';

const router = Router();

// Map table_name → { table, nameCol } for joining a display name
const NAME_JOIN = {
  STTTrainingReport:    { tbl: 'dbo.STTTrainingReport',    col: 'abattoir_name' },
  AbattoirMaster:       { tbl: 'dbo.AbattoirMaster',       col: 'abattoir_name' },
  TransformationMaster: { tbl: 'dbo.TransformationMaster', col: 'abattoir_name' },
  GovernmentMaster:     { tbl: 'dbo.GovernmentMaster',     col: 'department' },
  IndustryMaster:       { tbl: 'dbo.IndustryMaster',       col: 'company' },
  AssociatedMembersMaster: { tbl: 'dbo.AssociatedMembersMaster', col: 'company' },
  ResidueMonitoring:    { tbl: 'dbo.ResidueMonitoring',    col: 'establishment' },
};

// GET /api/audit-log?table=STTTrainingReport&user=John&year=2025&month=3&days=7&page=1&size=50
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(200, parseInt(req.query.size || '50', 10));
    const offset   = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const r  = pool.request();
    const cr = pool.request();
    let pi = 0;

    const { table, user, year, month, days } = req.query;

    if (table) {
      where += ` AND a.table_name = @p${pi}`;
      r.input(`p${pi}`, sql.NVarChar(100), table);
      cr.input(`p${pi}`, sql.NVarChar(100), table);
      pi++;
    }
    if (user) {
      where += ` AND a.modified_by LIKE @p${pi}`;
      r.input(`p${pi}`, sql.NVarChar(500), `%${user}%`);
      cr.input(`p${pi}`, sql.NVarChar(500), `%${user}%`);
      pi++;
    }
    if (year) {
      const yrs = year.split(',').map(Number).filter(n => n > 0);
      if (yrs.length) where += ` AND YEAR(a.created_at) IN (${yrs.join(',')})`;
    }
    if (month) {
      const mos = month.split(',').map(Number).filter(n => n >= 1 && n <= 12);
      if (mos.length) where += ` AND MONTH(a.created_at) IN (${mos.join(',')})`;
    }
    if (days) {
      const d = parseInt(days);
      if (d > 0) {
        where += ` AND a.created_at >= DATEADD(day, -@p${pi}, GETDATE())`;
        r.input(`p${pi}`, sql.Int, d);
        cr.input(`p${pi}`, sql.Int, d);
        pi++;
      }
    }

    const countResult = await cr.query(`SELECT COUNT(*) AS total FROM dbo.AuditLog a ${where}`);
    const total = countResult.recordset[0].total;

    r.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
    const join = table && NAME_JOIN[table]
      ? `LEFT JOIN ${NAME_JOIN[table].tbl} AS src ON src.id = a.record_id`
      : '';
    const nameSelect = table && NAME_JOIN[table]
      ? `, src.${NAME_JOIN[table].col} AS record_name`
      : `, NULL AS record_name`;
    const result = await r.query(
      `SELECT a.id, a.table_name, a.record_id${nameSelect}, a.modified_by, a.modified_time, a.modified_fields, a.old_values, a.new_values, a.created_at
       FROM dbo.AuditLog a ${join} ${where}
       ORDER BY a.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
    );

    // Also return distinct users for filter dropdown
    const usersResult = await pool.request()
      .input('tbl', sql.NVarChar(100), table || '')
      .query(
        table
          ? `SELECT DISTINCT modified_by FROM dbo.AuditLog WHERE table_name = @tbl AND modified_by IS NOT NULL AND modified_by <> '' ORDER BY modified_by`
          : `SELECT DISTINCT modified_by FROM dbo.AuditLog WHERE modified_by IS NOT NULL AND modified_by <> '' ORDER BY modified_by`
      );

    // Get the display label for the name column
    const nameLabel = table && NAME_JOIN[table] ? NAME_JOIN[table].col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;

    res.json({
      total,
      page,
      pageSize,
      rows: result.recordset,
      users: usersResult.recordset.map(r => r.modified_by),
      nameLabel,
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
