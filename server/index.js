import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { initDb, testDb } from './db.js';
import authRoutes    from './routes/auth.js';
import residueRoutes from './routes/residue.js';
import abattoirRoutes from './routes/abattoir.js';
import transformationRoutes from './routes/transformation.js';
import governmentRoutes from './routes/government.js';
import trainingReportRoutes from './routes/trainingReport.js';
import usersRoutes from './routes/users.js';
import sttTrainingReportRoutes from './routes/sttTrainingReport.js';
import documentsRoutes from './routes/documents.js';
import userPrefsRoutes from './routes/userPreferences.js';
import auditLogRoutes from './routes/auditLog.js';
import quotationRoutes from './routes/quotation.js';
import industryRoutes from './routes/industry.js';
import associatedMembersRoutes from './routes/associatedMembers.js';

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api/residue', residueRoutes);
app.use('/api/abattoir', abattoirRoutes);
app.use('/api/transformation', transformationRoutes);
app.use('/api/government', governmentRoutes);
app.use('/api/training-report', trainingReportRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stt-training-report', sttTrainingReportRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/user-prefs', userPrefsRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/quotation', quotationRoutes);
app.use('/api/industry', industryRoutes);
app.use('/api/associated-members', associatedMembersRoutes);

app.get('/api/status', (_req, res) => res.json({ status: 'ok' }));

// DB health check endpoint — runs live tests and returns results
app.get('/api/health', async (_req, res) => {
  const results = await testDb();
  const allOk   = results.every(r => r.ok);
  res.status(allOk ? 200 : 500).json({ ok: allOk, checks: results });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const port = process.env.PORT || 4000;

initDb()
  .then(async () => {
    // Run DB tests on startup
    const results = await testDb();
    console.log('\n── DB Health Check ──────────────────');
    for (const r of results) {
      console.log(`  ${r.ok ? '✔' : '✘'} ${r.check}: ${r.detail}`);
    }
    console.log('─────────────────────────────────────\n');

    app.listen(port, () => {
      console.log(`✔ Backend API running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('✘ Failed to start server:', err.message);
    process.exit(1);
  });
