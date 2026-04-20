"""Microsoft Graph API helpers — ports server/email.js.

Provides:
- get_access_token()        — OAuth client-credentials token
- convert_excel_to_pdf(buf) — upload to OneDrive, set A4 portrait, render PDF
- send_invite_email(...)    — invitation email
- send_database_form(...)   — attach Word doc, send to training email
- send_quotation_email(...) — attach PDF quotation

All functions return {'ok': bool, 'reason': str} on failure so callers can
propagate a useful message without raising.
"""
from __future__ import annotations
import time
import requests
from django.conf import settings


_token_cache = {'access_token': None, 'expires_at': 0}


def _graph_configured() -> bool:
    return all([
        settings.GRAPH_TENANT_ID,
        settings.GRAPH_CLIENT_ID,
        settings.GRAPH_CLIENT_SECRET,
        settings.GRAPH_SENDER_EMAIL,
    ])


def get_access_token() -> str:
    if _token_cache['access_token'] and _token_cache['expires_at'] > time.time() + 60:
        return _token_cache['access_token']

    url = f"https://login.microsoftonline.com/{settings.GRAPH_TENANT_ID}/oauth2/v2.0/token"
    data = {
        'grant_type': 'client_credentials',
        'client_id': settings.GRAPH_CLIENT_ID,
        'client_secret': settings.GRAPH_CLIENT_SECRET,
        'scope': 'https://graph.microsoft.com/.default',
    }
    r = requests.post(url, data=data, timeout=30)
    r.raise_for_status()
    payload = r.json()
    _token_cache['access_token'] = payload['access_token']
    _token_cache['expires_at'] = time.time() + int(payload.get('expires_in', 3600))
    return payload['access_token']


def _graph_post(path: str, json_body: dict, token: str, extra_headers: dict | None = None):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    if extra_headers:
        headers.update(extra_headers)
    return requests.post(
        f'https://graph.microsoft.com/v1.0{path}',
        json=json_body,
        headers=headers,
        timeout=60,
    )


def convert_excel_to_pdf(xlsx_buffer: bytes) -> bytes:
    """Upload Excel to OneDrive, set A4 portrait print area, download as PDF."""
    token = get_access_token()
    sender = settings.GRAPH_SENDER_EMAIL
    temp_name = f"_stt_convert_{int(time.time() * 1000)}.xlsx"
    drive_root = f"https://graph.microsoft.com/v1.0/users/{sender}/drive/root"

    # 1. Upload
    up = requests.put(
        f"{drive_root}:/{temp_name}:/content",
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        data=xlsx_buffer,
        timeout=120,
    )
    up.raise_for_status()
    item_id = up.json()['id']
    item_url = f"https://graph.microsoft.com/v1.0/users/{sender}/drive/items/{item_id}"
    excel_base = f"{item_url}/workbook"

    try:
        # 2. Configure print area via Excel session
        s = requests.post(
            f"{excel_base}/createSession",
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json={'persistChanges': True},
            timeout=30,
        )
        session_id = s.json().get('id') if s.ok else None
        session_hdr = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        if session_id:
            session_hdr['workbook-session-id'] = session_id

        ws = requests.get(f"{excel_base}/worksheets", headers=session_hdr, timeout=30)
        if ws.ok:
            sheets = ws.json().get('value', [])
            if sheets:
                first_name = sheets[0]['name']
                first_id = sheets[0]['id']
                # Hide other sheets
                for other in sheets[1:]:
                    from urllib.parse import quote
                    requests.patch(
                        f"{excel_base}/worksheets('{quote(other['id'])}')",
                        headers=session_hdr,
                        json={'visibility': 'hidden'},
                        timeout=30,
                    )
                # Set A4 portrait
                from urllib.parse import quote
                requests.patch(
                    f"{excel_base}/worksheets('{quote(first_id)}')/pageLayout",
                    headers=session_hdr,
                    json={'paperSize': 'A4', 'orientation': 'portrait'},
                    timeout=30,
                )
                # Set print area
                requests.post(
                    f"{excel_base}/names/add",
                    headers=session_hdr,
                    json={
                        'name': '_xlnm.Print_Area',
                        'reference': f"='{first_name}'!$A$1:$AD$53",
                    },
                    timeout=30,
                )

        if session_id:
            try:
                requests.post(f"{excel_base}/closeSession", headers=session_hdr, timeout=30)
            except requests.RequestException:
                pass

        # 3. Download as PDF
        pdf = requests.get(
            f"{item_url}/content?format=pdf",
            headers={'Authorization': f'Bearer {token}'},
            timeout=120,
        )
        pdf.raise_for_status()
        return pdf.content
    finally:
        try:
            requests.delete(item_url, headers={'Authorization': f'Bearer {token}'}, timeout=30)
        except requests.RequestException:
            pass


def _send_mail(message: dict) -> dict:
    if not _graph_configured():
        return {'ok': False, 'reason': 'Graph API not configured'}
    try:
        token = get_access_token()
        r = requests.post(
            f"https://graph.microsoft.com/v1.0/users/{settings.GRAPH_SENDER_EMAIL}/sendMail",
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=message,
            timeout=60,
        )
        if not r.ok:
            return {'ok': False, 'reason': f'sendMail failed: {r.text}'}
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'reason': str(e)}


def send_invite_email(*, to: str, invited_by: str, invite_url: str) -> dict:
    html = f"""
    <div style="font-family:Segoe UI,sans-serif;max-width:600px">
      <div style="background:#0078d4;padding:20px 28px">
        <h2 style="color:#fff;margin:0;font-size:1.2rem">Red Meat Abattoir Association</h2>
      </div>
      <div style="padding:28px;border:1px solid #edebe9;border-top:none">
        <h3 style="color:#323130;margin-top:0">You've been invited</h3>
        <p style="color:#605e5c"><strong>{invited_by}</strong> has invited you to join the RMAA System.</p>
        <p style="color:#605e5c">Click the button below to accept your invitation and create your password.</p>
        <a href="{invite_url}" style="display:inline-block;background:#0078d4;color:#fff;padding:10px 24px;text-decoration:none;border-radius:2px;font-weight:600;margin:16px 0">Accept Invitation</a>
        <p style="color:#a19f9d;font-size:0.82rem;margin-top:20px">
          This link expires in 7 days.<br>
          If the button doesn't work, copy and paste this link: {invite_url}
        </p>
      </div>
    </div>
    """
    return _send_mail({
        'message': {
            'subject': 'You have been invited to the RMAA System',
            'body': {'contentType': 'HTML', 'content': html},
            'toRecipients': [{'emailAddress': {'address': to}}],
        },
        'saveToSentItems': True,
    })


def send_database_form(*, to: str, abattoir_name: str, training_email: str,
                       doc_buffer: bytes, filename: str) -> dict:
    import base64
    html = f"""
      <p><strong>Training Email:</strong> {training_email or '(not on record)'}</p>
      <p>Good day,</p>
      <p>I trust this email finds you well.</p>
      <p>Please find attached a Word document containing the current data we have on file for your abattoir.
      We kindly request that you review the information and let us know if there have been any updates.</p>
      <p style="color:#C00000; font-weight:bold;">Please remember to include your RC Certificate when responding to this mail.</p>
      <p>Thank you for your prompt attention.</p>
      <p>Kind Regards / Vriendelike Groete</p>
    """
    return _send_mail({
        'message': {
            'subject': f'RMAA Database Form — {abattoir_name}',
            'body': {'contentType': 'HTML', 'content': html},
            'toRecipients': [{'emailAddress': {'address': to}}],
            'attachments': [{
                '@odata.type': '#microsoft.graph.fileAttachment',
                'name': filename,
                'contentType': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'contentBytes': base64.b64encode(doc_buffer).decode('ascii'),
            }],
        },
        'saveToSentItems': True,
    })


def send_quotation_email(*, to: str, client_name: str, pdf_base64: str, file_name: str) -> dict:
    html = f"""
      <p>Dear {client_name or 'Client'},</p>
      <p>Please find attached your quotation for Training and Support Services from the Red Meat Abattoir Association.</p>
      <p>For acceptance of the quote, please sign and email back the signed copy.</p>
      <p><strong>Notes:</strong> 15% VAT EXCLUDED in all cases. CERTIFIED ID COPIES (COLOUR) NEEDED FOR ALL TRAINING.</p>
      <br/>
      <p>Kind regards,<br/>Red Meat Abattoir Association<br/>Abattoir Skills Training</p>
    """
    return _send_mail({
        'message': {
            'subject': f'Quotation — {client_name or "RMAA Training Services"}',
            'body': {'contentType': 'HTML', 'content': html},
            'toRecipients': [{'emailAddress': {'address': to}}],
            'attachments': [{
                '@odata.type': '#microsoft.graph.fileAttachment',
                'name': file_name or 'Quotation.pdf',
                'contentType': 'application/pdf',
                'contentBytes': pdf_base64,
            }],
        },
        'saveToSentItems': True,
    })
