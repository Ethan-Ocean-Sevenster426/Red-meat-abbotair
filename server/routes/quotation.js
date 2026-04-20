import { Router } from 'express';
import sql from 'mssql';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { convertExcelToPdf } from '../email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, '..', '..', 'documents');
const TEMPLATE  = path.resolve(__dirname, '..', '..', 'Quotation Template.xlsx');

const router = Router();

// GET /api/quotation/abattoir-details?name=Doornplaat
router.get('/abattoir-details', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ message: 'name required' });
  try {
    const year = new Date().getFullYear();
    const memberCol = `member_${year}`;
    const result = await pool.request()
      .input('name', sql.NVarChar(500), name)
      .query(`SELECT abattoir_name, rc_nr, [lh], vat_number, province, municipality,
                     ${memberCol} AS is_member
              FROM dbo.AbattoirMaster WHERE abattoir_name = @name`);
    if (result.recordset.length === 0) return res.json({ found: false });
    const row = result.recordset[0];
    res.json({
      found: true,
      abattoir_name: row.abattoir_name,
      rc_nr: row.rc_nr || '',
      thru_put: row.lh || '',
      vat_number: row.vat_number || '',
      province: row.province || '',
      municipality: row.municipality || '',
      is_member: (row.is_member || '').toLowerCase().includes('member') ? 'Yes' : 'No',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function sanitize(str) {
  return (str || 'Unknown').replace(/[<>:"/\\|?*\r\n]/g, '_').trim() || 'Unknown';
}

// POST /api/quotation/generate
router.post('/generate', async (req, res) => {
  try {
    const {
      clientName, province, rmaaMember, rc, throughput, vatNumber,
      clientContact, telephone, cell, email, postalAddress, streetAddress,
      rmaaContact, lineItems,
    } = req.body;

    // Load template
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.worksheets[0];

    // Helper to set merged cell value (D3:H3 pattern)
    const setMerged = (row, val) => {
      ws.getCell(`D${row}`).value = val;
    };

    // Quotation date
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    ws.getCell('D2').value = `Training and Support Services Contract ${today.getFullYear()}`;
    ws.getCell('A2').value = `QUOTATION DATE: ${dateStr}`;

    // Client details
    setMerged(3, clientName);
    setMerged(4, rmaaMember);
    setMerged(5, rc);
    setMerged(6, throughput);
    setMerged(7, vatNumber);
    setMerged(9, clientContact);
    setMerged(10, telephone);
    setMerged(12, cell);
    setMerged(13, email);
    setMerged(14, postalAddress);
    setMerged(15, streetAddress);
    setMerged(16, rmaaContact);

    // Line items (rows 22-24)
    if (lineItems && lineItems.length > 0) {
      lineItems.forEach((item, i) => {
        const row = 22 + i;
        if (row > 24) return;
        ws.getCell(`B${row}`).value = fmtDateLong(item.date);
        const skillsText = item.skillsProgramme && item.qty ? `${item.skillsProgramme} x ${item.qty}` : (item.skillsProgramme || '');
        ws.getCell(`C${row}`).value = skillsText;
        ws.getCell(`D${row}`).value = item.slaughterTechnique || '';
        ws.getCell(`E${row}`).value = item.serviceCost ? Number(item.serviceCost) : '';
        ws.getCell(`F${row}`).value = item.distance ? Number(item.distance) : '';
        ws.getCell(`G${row}`).value = item.accommodation ? Number(item.accommodation) : '';
      });
    }

    // Generate XLSX buffer
    const xlsxBuffer = Buffer.from(await wb.xlsx.writeBuffer());

    // Convert to PDF
    const pdfBuffer = await convertExcelToPdf(xlsxBuffer);

    const folderName = `Quotation ${dateStr.replace(/\//g, '-')} ${sanitize(clientName)}`;

    res.json({
      ok: true,
      pdfBase64: pdfBuffer.toString('base64'),
      xlsxBase64: xlsxBuffer.toString('base64'),
      fileName: `${folderName}.pdf`,
      folderName,
      province,
      clientName,
    });
  } catch (err) {
    console.error('Quotation generate error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/quotation/send — send quotation email
router.post('/send', async (req, res) => {
  try {
    const { to, clientName, pdfBase64, xlsxBase64, fileName, folderName, province } = req.body;
    if (!to || !pdfBase64) return res.status(400).json({ message: 'Missing email or PDF' });

    // Import email functions
    const { getAccessToken } = await import('../email.js');
    const token = await getAccessToken();
    const sender = process.env.GRAPH_SENDER_EMAIL;

    const mailBody = {
      message: {
        subject: `Quotation — ${clientName || 'RMAA Training Services'}`,
        body: {
          contentType: 'HTML',
          content: `
            <p>Dear ${clientName || 'Client'},</p>
            <p>Please find attached your quotation for Training and Support Services from the Red Meat Abattoir Association.</p>
            <p>For acceptance of the quote, please sign and email back the signed copy.</p>
            <p><strong>Notes:</strong> 15% VAT EXCLUDED in all cases. CERTIFIED ID COPIES (COLOUR) NEEDED FOR ALL TRAINING.</p>
            <br/>
            <p>Kind regards,<br/>Red Meat Abattoir Association<br/>Abattoir Skills Training</p>
          `,
        },
        toRecipients: [{ emailAddress: { address: to } }],
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: fileName || 'Quotation.pdf',
            contentType: 'application/pdf',
            contentBytes: pdfBase64,
          },
        ],
      },
      saveToSentItems: true,
    };

    const mailRes = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(mailBody),
    });

    if (!mailRes.ok) {
      const err = await mailRes.text();
      return res.status(500).json({ message: `Email failed: ${err}` });
    }

    // Save to document library after successful send
    if (folderName && province && clientName) {
      try {
        const saveDir = path.join(DOCS_ROOT, sanitize(province), sanitize(clientName), 'Quotations', folderName);
        fs.mkdirSync(saveDir, { recursive: true });
        if (xlsxBase64) fs.writeFileSync(path.join(saveDir, `${folderName}.xlsx`), Buffer.from(xlsxBase64, 'base64'));
        fs.writeFileSync(path.join(saveDir, `${folderName}.pdf`), Buffer.from(pdfBase64, 'base64'));
      } catch (saveErr) {
        console.error('Quotation save error:', saveErr);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Quotation send error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
