import dotenv from 'dotenv';
dotenv.config();

const TENANT_ID    = process.env.GRAPH_TENANT_ID;
const CLIENT_ID    = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;
const SENDER_EMAIL = process.env.GRAPH_SENDER_EMAIL;

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token request failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ── Convert an Excel buffer to PDF via Microsoft Graph / OneDrive ─────────────
// Uploads to the sender's OneDrive as a temp file, applies print settings via
// the Graph Excel API, downloads the PDF render, then deletes the temp file.
export async function convertExcelToPdf(xlsxBuffer) {
  const token    = await getAccessToken();
  const tempName = `_stt_convert_${Date.now()}.xlsx`;
  const driveUrl = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/drive/root:/${tempName}`;

  // 1. Upload xlsx to OneDrive
  const uploadRes = await fetch(`${driveUrl}:/content`, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    body:    xlsxBuffer,
  });
  if (!uploadRes.ok) throw new Error('OneDrive upload failed: ' + await uploadRes.text());
  const item = await uploadRes.json();
  const itemId = item.id;

  try {
    // 2. Use Graph Excel API to configure the workbook for single-page PDF output
    const excelBase = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/drive/items/${itemId}/workbook`;
    const authHdr   = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Create a persistent workbook session so changes are saved before PDF conversion
    const sessionRes = await fetch(`${excelBase}/createSession`, {
      method: 'POST', headers: authHdr,
      body:   JSON.stringify({ persistChanges: true }),
    });
    const sessionData = sessionRes.ok ? await sessionRes.json() : {};
    const sessionId   = sessionData.id;
    console.log('[PDF] session:', sessionId ? 'created' : 'failed');
    const sHdr = sessionId ? { ...authHdr, 'workbook-session-id': sessionId } : authHdr;

    const wsRes = await fetch(`${excelBase}/worksheets`, { headers: sHdr });
    if (wsRes.ok) {
      const wsData  = await wsRes.json();
      const sheets  = wsData.value || [];
      const firstWs = sheets[0];
      console.log('[PDF] sheets found:', sheets.map(s => `${s.name}(${s.visibility})`));

      if (firstWs) {
        const wsId      = firstWs.id;   // e.g. {00000000-0001-0000-0000-000000000000}
        const firstName = firstWs.name;
        // OData key syntax: worksheets('{id}')
        const wsOdata   = `worksheets('${encodeURIComponent(wsId)}')`;

        // Hide every sheet except the first
        for (const ws of sheets.slice(1)) {
          const r = await fetch(`${excelBase}/worksheets('${encodeURIComponent(ws.id)}')`, {
            method: 'PATCH', headers: sHdr,
            body:   JSON.stringify({ visibility: 'hidden' }),
          });
          console.log('[PDF] hide sheet', ws.name, r.status);
        }

        // Set A4 portrait via pageLayout using OData ID syntax
        const lr = await fetch(`${excelBase}/${wsOdata}/pageLayout`, {
          method: 'PATCH', headers: sHdr,
          body:   JSON.stringify({ paperSize: 'A4', orientation: 'portrait' }),
        });
        console.log('[PDF] pageLayout patch:', lr.status, await lr.text());

        // Set _xlnm.Print_Area (Excel's internal print area name) at workbook level
        const printRef = `'${firstName}'!$A$1:$AD$53`;
        const nr = await fetch(`${excelBase}/names/add`, {
          method: 'POST', headers: sHdr,
          body:   JSON.stringify({ name: '_xlnm.Print_Area', reference: `=${printRef}` }),
        });
        console.log('[PDF] _xlnm.Print_Area add:', nr.status, await nr.text());
      }
    } else {
      console.warn('[PDF] worksheets fetch failed:', wsRes.status, await wsRes.text());
    }

    // Close session to persist all changes to the file
    if (sessionId) {
      await fetch(`${excelBase}/closeSession`, { method: 'POST', headers: sHdr }).catch(() => {});
      console.log('[PDF] session closed');
    }

    // 3. Download as PDF
    const pdfRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/drive/items/${itemId}/content?format=pdf`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!pdfRes.ok) throw new Error('PDF conversion failed: ' + await pdfRes.text());
    const arrayBuf = await pdfRes.arrayBuffer();
    return Buffer.from(arrayBuf);
  } finally {
    // 4. Delete temp file regardless of success/failure
    await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/drive/items/${itemId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

export async function sendInviteEmail({ to, invitedBy, inviteUrl }) {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SENDER_EMAIL) {
    console.log(`[Email] Graph API not configured. Invite URL for ${to}: ${inviteUrl}`);
    return { ok: false, reason: 'Graph API not configured' };
  }

  try {
    const token = await getAccessToken();

    const message = {
      message: {
        subject: 'You have been invited to the RMAA System',
        body: {
          contentType: 'HTML',
          content: `
            <div style="font-family:Segoe UI,sans-serif;max-width:600px">
              <div style="background:#0078d4;padding:20px 28px">
                <h2 style="color:#fff;margin:0;font-size:1.2rem">Red Meat Abattoir Association</h2>
              </div>
              <div style="padding:28px;border:1px solid #edebe9;border-top:none">
                <h3 style="color:#323130;margin-top:0">You've been invited</h3>
                <p style="color:#605e5c"><strong>${invitedBy}</strong> has invited you to join the RMAA System.</p>
                <p style="color:#605e5c">Click the button below to accept your invitation and create your password.</p>
                <a href="${inviteUrl}" style="display:inline-block;background:#0078d4;color:#fff;padding:10px 24px;text-decoration:none;border-radius:2px;font-weight:600;margin:16px 0">
                  Accept Invitation
                </a>
                <p style="color:#a19f9d;font-size:0.82rem;margin-top:20px">
                  This link expires in 7 days.<br>
                  If the button doesn't work, copy and paste this link: ${inviteUrl}
                </p>
              </div>
              <div style="padding:12px 28px;background:#f3f2f1;border:1px solid #edebe9;border-top:none">
                <p style="margin:0;color:#a19f9d;font-size:0.78rem">
                  This email was sent by the RMAA System. If you were not expecting this, you can ignore it.
                </p>
              </div>
            </div>
          `,
        },
        toRecipients: [
          { emailAddress: { address: to } },
        ],
      },
      saveToSentItems: true,
    };

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`,
      {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Graph sendMail failed: ${err}`);
    }

    console.log(`[Email] Invite sent to ${to} via Microsoft Graph`);
    return { ok: true };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

export async function sendDatabaseForm({ to, abattoirName, trainingEmail, docBuffer, filename }) {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SENDER_EMAIL) {
    return { ok: false, reason: 'Graph API not configured' };
  }

  try {
    const token = await getAccessToken();

    const message = {
      message: {
        subject: `RMAA Database Form — ${abattoirName}`,
        body: {
          contentType: 'HTML',
          content: `
            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              <strong>Training Email:</strong> ${trainingEmail || '(not on record)'}
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              Good day,
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              I trust this email finds you well.
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              Please find attached a Word document containing the current data we have on file for your abattoir. We kindly request that you review the information and let us know if there have been any updates or changes to your details since the last submission.
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              If any corrections are necessary, please respond to this email with the updated information at your earliest convenience. This will help us ensure that our records remain accurate and up to date.
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0; color:#C00000; font-weight:bold;">
              Please remember to include your RC Certificate when responding to this mail.
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              Thank you for your prompt attention to this matter. Should you have any questions or need further assistance, feel free to contact us.
            </p>

            <p style="font-family:Segoe UI, Arial, sans-serif; font-size:14px; margin:12px 0;">
              Kind Regards / Vriendelike Groete
            </p>
          `,
        },
        toRecipients: [{ emailAddress: { address: to } }],
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: filename,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            contentBytes: docBuffer.toString('base64'),
          },
        ],
      },
      saveToSentItems: true,
    };

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }
    );

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Graph sendMail failed: ${err}`);
    }

    console.log(`[Email] Database form for "${abattoirName}" sent to ${to}`);
    return { ok: true };
  } catch (err) {
    console.error('[Email] Database form send failed:', err.message);
    return { ok: false, reason: err.message };
  }
}
