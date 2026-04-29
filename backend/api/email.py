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


def modify_xlsx_cells(xlsx_bytes: bytes, cell_updates: dict) -> bytes:
    """Apply cell value updates to an xlsx via direct XML edits.

    Preserves all embedded assets (images, drawings, page setup, formatting,
    formulas in untouched cells) — unlike openpyxl which strips drawings on
    save. cell_updates is a dict of cell_ref -> value (str/int/float/None).
    """
    import zipfile
    import re
    from io import BytesIO

    out = BytesIO()
    with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as src:
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
            for item in src.namelist():
                content = src.read(item)
                if item == 'xl/worksheets/sheet1.xml':
                    content = _apply_cell_updates(content.decode('utf-8'), cell_updates).encode('utf-8')
                dst.writestr(item, content)
    return out.getvalue()


def _apply_cell_updates(xml: str, cells: dict) -> str:
    import re
    for cell_ref, value in cells.items():
        pattern = re.compile(
            rf'<c\s+r="{re.escape(cell_ref)}"([^>]*?)(/>|>.*?</c>)',
            re.DOTALL,
        )
        m = pattern.search(xml)
        if not m:
            continue
        attrs = re.sub(r'\s*t="[^"]*"', '', m.group(1) or '')
        if value is None or value == '':
            new_cell = f'<c r="{cell_ref}"{attrs}/>'
        elif isinstance(value, (int, float)):
            new_cell = f'<c r="{cell_ref}"{attrs}><v>{value}</v></c>'
        else:
            v = (str(value).replace('&', '&amp;').replace('<', '&lt;')
                 .replace('>', '&gt;').replace('"', '&quot;'))
            new_cell = f'<c r="{cell_ref}"{attrs} t="inlineStr"><is><t xml:space="preserve">{v}</t></is></c>'
        xml = xml[:m.start()] + new_cell + xml[m.end():]
    return xml


def convert_excel_to_pdf(xlsx_buffer: bytes, print_area: str = '$A$1:$AD$53',
                         setup_page: bool = False) -> bytes:
    """Convert Excel to PDF using LibreOffice (cross-platform).

    setup_page: when True, bakes print-area/fit-to-page into the file before
    converting. Skipped for user-uploaded files so embedded images remain
    as authored. Requires `libreoffice` (or `soffice`) on PATH.
    """
    import sys
    import tempfile
    import os
    import shutil
    import subprocess

    tmp_xlsx = os.path.join(tempfile.gettempdir(), f'_stt_{int(time.time() * 1000)}.xlsx')
    tmp_pdf = tmp_xlsx.replace('.xlsx', '.pdf')

    try:
        if setup_page:
            xlsx_buffer = _bake_page_setup(xlsx_buffer, print_area)

        with open(tmp_xlsx, 'wb') as f:
            f.write(xlsx_buffer)

        soffice = shutil.which('libreoffice') or shutil.which('soffice')
        if not soffice:
            raise RuntimeError(
                'LibreOffice not found. Install it (apt-get install libreoffice on '
                'Linux, or download from libreoffice.org on Windows) and ensure '
                '`soffice` or `libreoffice` is on PATH.'
            )
        result = subprocess.run(
            [soffice, '--headless', '--convert-to', 'pdf',
             '--outdir', tempfile.gettempdir(), tmp_xlsx],
            capture_output=True, timeout=90,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode() or result.stdout.decode())

        with open(tmp_pdf, 'rb') as f:
            return f.read()
    finally:
        for p in (tmp_xlsx, tmp_pdf):
            try:
                os.unlink(p)
            except OSError:
                pass


def _bake_page_setup(xlsx_bytes: bytes, print_area: str) -> bytes:
    """Set fit-to-page/A4/portrait/print-area in xlsx via direct XML edits.

    Avoids openpyxl round-trip so embedded drawings/images survive.
    """
    import zipfile
    import re
    from io import BytesIO

    out = BytesIO()
    with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as src:
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
            for item in src.namelist():
                content = src.read(item)
                if item == 'xl/worksheets/sheet1.xml':
                    content = _inject_page_setup(content.decode('utf-8'), print_area).encode('utf-8')
                elif item == 'xl/workbook.xml':
                    content = _inject_print_area(content.decode('utf-8'), print_area).encode('utf-8')
                dst.writestr(item, content)
    return out.getvalue()


def _inject_page_setup(xml: str, print_area: str) -> str:
    import re
    # pageSetup: A4 (paperSize=9), portrait, fit-to-1-page
    page_setup = ('<pageSetup paperSize="9" fitToWidth="1" fitToHeight="1" '
                  'orientation="portrait"/>')
    # sheetPr/pageSetUpPr: enable fit-to-page
    fit_pr = '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    # pageMargins: tight
    margins = ('<pageMargins left="0.2" right="0.2" top="0.2" bottom="0.2" '
               'header="0.1" footer="0.1"/>')
    # Replace existing tags or insert near </worksheet>
    xml = re.sub(r'<sheetPr[^>]*>.*?</sheetPr>|<sheetPr[^/]*/>', fit_pr, xml, count=1, flags=re.DOTALL)
    if '<sheetPr' not in xml:
        xml = xml.replace('<dimension', fit_pr + '<dimension', 1)
    xml = re.sub(r'<pageSetup[^/]*/>', page_setup, xml, count=1)
    if '<pageSetup' not in xml:
        xml = xml.replace('</worksheet>', page_setup + '</worksheet>', 1)
    xml = re.sub(r'<pageMargins[^/]*/>', margins, xml, count=1)
    if '<pageMargins' not in xml:
        xml = xml.replace('</worksheet>', margins + '</worksheet>', 1)
    return xml


def _inject_print_area(workbook_xml: str, print_area: str) -> str:
    import re
    # Print area is a defined name "_xlnm.Print_Area" scoped to sheet
    # localSheetId=0 means first sheet
    target = f"Sheet1!{print_area}"
    pa = (f'<definedName name="_xlnm.Print_Area" localSheetId="0">'
          f'{target}</definedName>')
    if '_xlnm.Print_Area' in workbook_xml:
        workbook_xml = re.sub(
            r'<definedName name="_xlnm\.Print_Area"[^>]*>[^<]*</definedName>',
            pa, workbook_xml, count=1,
        )
    elif '<definedNames>' in workbook_xml:
        workbook_xml = workbook_xml.replace('<definedNames>', f'<definedNames>{pa}', 1)
    elif '</workbook>' in workbook_xml:
        workbook_xml = workbook_xml.replace(
            '</workbook>', f'<definedNames>{pa}</definedNames></workbook>', 1,
        )
    return workbook_xml


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
