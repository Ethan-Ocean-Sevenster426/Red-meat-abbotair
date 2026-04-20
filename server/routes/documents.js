import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT  = path.resolve(__dirname, '..', '..', 'documents');

const router = Router();

function safeAbs(relPath) {
  const abs = path.resolve(DOCS_ROOT, relPath);
  if (!abs.startsWith(DOCS_ROOT + path.sep) && abs !== DOCS_ROOT) throw new Error('Invalid path');
  return abs;
}

function purgeEmptyDirs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) purgeEmptyDirs(path.join(dir, e.name));
  }
  // After recursing, check if this dir is now empty
  const remaining = fs.readdirSync(dir);
  if (remaining.length === 0 && dir !== DOCS_ROOT) {
    fs.rmdirSync(dir);
  }
}

function readTree(dir, relBase) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const folders = [];
  const files   = [];
  for (const e of entries) {
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const children = readTree(path.join(dir, e.name), rel);
      // Only include folders that contain at least one PDF somewhere in their subtree
      if (children.length > 0) {
        folders.push({ type: 'folder', name: e.name, path: rel, children });
      }
    } else if (e.isFile() && /\.(pdf|xlsx)$/i.test(e.name)) {
      const stat = fs.statSync(path.join(dir, e.name));
      files.push({ type: 'file', name: e.name, path: rel, size: stat.size, modified: stat.mtime });
    }
  }
  return [...folders, ...files];
}

// GET /api/documents/tree
router.get('/tree', (_req, res) => {
  try {
    if (!fs.existsSync(DOCS_ROOT)) fs.mkdirSync(DOCS_ROOT, { recursive: true });
    purgeEmptyDirs(DOCS_ROOT);
    res.json({ tree: readTree(DOCS_ROOT, '') });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents/view?p=relative/path/to/file.pdf  — inline PDF viewer
router.get('/view', (req, res) => {
  try {
    const rel = req.query.p;
    if (!rel) return res.status(400).json({ message: 'Missing path' });
    const abs = safeAbs(rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });
    const isXlsx = abs.toLowerCase().endsWith('.xlsx');
    res.setHeader('Content-Type', isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
    res.setHeader('Content-Disposition', isXlsx ? `attachment; filename="${path.basename(abs)}"` : 'inline');
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/documents/download?p=relative/path/to/file.pdf
router.get('/download', (req, res) => {
  try {
    const rel = req.query.p;
    if (!rel) return res.status(400).json({ message: 'Missing path' });
    const abs = safeAbs(rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });
    res.download(abs);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/documents/delete?p=relative/path/to/file.pdf  — admin only
router.delete('/delete', (req, res) => {
  try {
    const rel = req.query.p;
    if (!rel) return res.status(400).json({ message: 'Missing path' });
    const abs = safeAbs(rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });
    fs.unlinkSync(abs);

    // Remove any now-empty parent directories up to DOCS_ROOT
    let dir = path.dirname(abs);
    while (true) {
      const rel2 = path.relative(DOCS_ROOT, dir);
      if (!rel2 || rel2.startsWith('..') || rel2 === '') break; // reached or escaped DOCS_ROOT
      if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
