import { Router } from 'express';
import sql from 'mssql';
import { pool } from '../db.js';
import { sendInviteEmail } from '../email.js';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/users — list all users
router.get('/', async (_req, res) => {
  try {
    const r = await pool.request().query(
      `SELECT id, username, email, displayName, role, permissions, created_at FROM dbo.Users ORDER BY id`
    );
    res.json({ users: r.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/users/invite — create pending user + send invite
router.post('/invite', async (req, res) => {
  const { email, displayName, invitedBy } = req.body;
  if (!email || !displayName) return res.status(400).json({ message: 'Email and name are required.' });
  try {
    const exists = await pool.request().input('email', sql.NVarChar(255), email)
      .query(`SELECT id FROM dbo.Users WHERE email = @email`);
    if (exists.recordset.length > 0) return res.status(409).json({ message: 'A user with this email already exists.' });

    // Create pending user (empty password until accepted)
    const ins = await pool.request()
      .input('email',       sql.NVarChar(255), email)
      .input('displayName', sql.NVarChar(150), displayName)
      .input('username',    sql.NVarChar(100), email)
      .input('role',        sql.NVarChar(50),  'user')
      .input('password',    sql.NVarChar(200), '')
      .query(`INSERT INTO dbo.Users (username,email,displayName,role,password) OUTPUT INSERTED.id VALUES (@username,@email,@displayName,@role,@password)`);

    const userId = ins.recordset[0].id;
    const token  = randomUUID();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await pool.request()
      .input('token',     sql.NVarChar(100), token)
      .input('email',     sql.NVarChar(255), email)
      .input('userId',    sql.Int,           userId)
      .input('invitedBy', sql.NVarChar(150), invitedBy || 'Admin')
      .input('expires',   sql.NVarChar(50),  expires)
      .query(`INSERT INTO dbo.Invitations (token,email,user_id,invited_by,expires_at) VALUES (@token,@email,@userId,@invitedBy,@expires)`);

    const baseUrl   = process.env.APP_URL || 'http://localhost:5173';
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
    const emailResult = await sendInviteEmail({ to: email, invitedBy: invitedBy || 'Admin', inviteUrl });

    res.json({ ok: true, inviteUrl, emailSent: emailResult.ok, userId });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/invite/:token — validate token
router.get('/invite/:token', async (req, res) => {
  try {
    const r = await pool.request().input('token', sql.NVarChar(100), req.params.token)
      .query(`SELECT i.*, u.email, u.displayName FROM dbo.Invitations i JOIN dbo.Users u ON i.user_id = u.id WHERE i.token = @token AND i.accepted = 0`);
    if (r.recordset.length === 0) return res.status(404).json({ message: 'Invitation not found or already used.' });
    const inv = r.recordset[0];
    if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ message: 'This invitation has expired.' });
    res.json({ valid: true, email: inv.email, displayName: inv.displayName, invitedBy: inv.invited_by });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/users/invite/accept — set password and activate
router.post('/invite/accept', async (req, res) => {
  const { token, password, displayName } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password required.' });
  try {
    const r = await pool.request().input('token', sql.NVarChar(100), token)
      .query(`SELECT * FROM dbo.Invitations WHERE token = @token AND accepted = 0`);
    if (r.recordset.length === 0) return res.status(404).json({ message: 'Invalid or already used invitation.' });
    const inv = r.recordset[0];
    if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ message: 'Invitation has expired.' });

    await pool.request()
      .input('id',          sql.Int,           inv.user_id)
      .input('password',    sql.NVarChar(200), password)
      .input('displayName', sql.NVarChar(150), displayName || '')
      .query(`UPDATE dbo.Users SET password=@password, displayName=CASE WHEN @displayName<>'' THEN @displayName ELSE displayName END WHERE id=@id`);

    await pool.request().input('token', sql.NVarChar(100), token)
      .query(`UPDATE dbo.Invitations SET accepted=1, accepted_at=GETDATE() WHERE token=@token`);

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/users/:id/permissions
router.put('/:id/permissions', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request()
      .input('id', sql.Int, id)
      .input('permissions', sql.NVarChar(sql.MAX), JSON.stringify(req.body.permissions || {}))
      .query(`UPDATE dbo.Users SET permissions=@permissions WHERE id=@id`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/users/:id/role
router.put('/:id/role', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request()
      .input('id',   sql.Int,         id)
      .input('role', sql.NVarChar(50), req.body.role)
      .query(`UPDATE dbo.Users SET role=@role WHERE id=@id`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.request().input('id', sql.Int, id).query(`DELETE FROM dbo.Invitations WHERE user_id=@id`);
    await pool.request().input('id', sql.Int, id).query(`DELETE FROM dbo.Users WHERE id=@id`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
