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


def convert_excel_to_pdf(xlsx_buffer: bytes, print_area: str = '$A$1:$AD$53') -> bytes:
    """Convert Excel to PDF. Uses win32com on Windows, LibreOffice on Linux."""
    import sys
    import tempfile
    import os
    import subprocess

    tmp_xlsx = os.path.join(tempfile.gettempdir(), f'_stt_{int(time.time() * 1000)}.xlsx')
    tmp_pdf = tmp_xlsx.replace('.xlsx', '.pdf')

    try:
        with open(tmp_xlsx, 'wb') as f:
            f.write(xlsx_buffer)

        if sys.platform == 'win32':
            import win32com.client
            import pythoncom
            pythoncom.CoInitialize()
            excel = win32com.client.Dispatch('Excel.Application')
            excel.Visible = False
            excel.DisplayAlerts = False
            try:
                wb = excel.Workbooks.Open(os.path.abspath(tmp_xlsx), ReadOnly=True)
                ws = wb.Worksheets(1)
                ws.PageSetup.Zoom = False
                ws.PageSetup.FitToPagesWide = 1
                ws.PageSetup.FitToPagesTall = 1
                ws.PageSetup.Orientation = 1
                ws.PageSetup.PaperSize = 9
                ws.PageSetup.PrintArea = print_area
                ws.PageSetup.LeftMargin = excel.InchesToPoints(0.2)
                ws.PageSetup.RightMargin = excel.InchesToPoints(0.2)
                ws.PageSetup.TopMargin = excel.InchesToPoints(0.2)
                ws.PageSetup.BottomMargin = excel.InchesToPoints(0.2)
                ws.PageSetup.HeaderMargin = excel.InchesToPoints(0.1)
                ws.PageSetup.FooterMargin = excel.InchesToPoints(0.1)
                wb.ExportAsFixedFormat(0, os.path.abspath(tmp_pdf))
                wb.Close(False)
            finally:
                excel.Quit()
                pythoncom.CoUninitialize()
        else:
            from openpyxl import load_workbook
            from openpyxl.worksheet.page import PageMargins
            wb_obj = load_workbook(tmp_xlsx)
            ws_obj = wb_obj.active
            ws_obj.print_area = print_area
            ws_obj.page_setup.orientation = 'portrait'
            ws_obj.page_setup.paperSize = ws_obj.PAPERSIZE_A4
            ws_obj.page_setup.fitToWidth = 1
            ws_obj.page_setup.fitToHeight = 1
            ws_obj.page_setup.fitToPage = True
            ws_obj.page_margins = PageMargins(
                left=0.2, right=0.2, top=0.2, bottom=0.2,
                header=0.1, footer=0.1,
            )
            wb_obj.save(tmp_xlsx)
            result = subprocess.run(
                ['libreoffice', '--headless', '--convert-to', 'pdf',
                 '--outdir', tempfile.gettempdir(), tmp_xlsx],
                capture_output=True, timeout=60,
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr.decode())

        with open(tmp_pdf, 'rb') as f:
            return f.read()
    finally:
        for p in (tmp_xlsx, tmp_pdf):
            try:
                os.unlink(p)
            except OSError:
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


def send_quotation_email(*, to: str, cc: list[str] | None = None,
                         client_name: str, pdf_base64: str, file_name: str) -> dict:
    html = f"""
      <p>Dear {client_name or 'Client'},</p>
      <p>Please find attached your quotation for Training and Support Services from the Red Meat Abattoir Association.</p>
      <p>For acceptance of the quote, please sign and email back the signed copy.</p>
      <p><strong>Notes:</strong> 15% VAT EXCLUDED in all cases. CERTIFIED ID COPIES (COLOUR) NEEDED FOR ALL TRAINING.</p>
      <br/>
      <p>Kind regards,<br/>Red Meat Abattoir Association<br/>Abattoir Skills Training</p>
    """
    message = {
        'subject': f'Quotation — {client_name or "RMAA Training Services"}',
        'body': {'contentType': 'HTML', 'content': html},
        'toRecipients': [{'emailAddress': {'address': to}}],
        'attachments': [{
            '@odata.type': '#microsoft.graph.fileAttachment',
            'name': file_name or 'Quotation.pdf',
            'contentType': 'application/pdf',
            'contentBytes': pdf_base64,
        }],
    }
    if cc:
        message['ccRecipients'] = [{'emailAddress': {'address': addr}} for addr in cc if addr.strip()]
    return _send_mail({'message': message, 'saveToSentItems': True})
