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
                # Drop cached calc chain so LibreOffice/Excel recalculates formulas
                if item == 'xl/calcChain.xml':
                    continue
                content = src.read(item)
                if item == 'xl/worksheets/sheet1.xml':
                    xml = _apply_cell_updates(content.decode('utf-8'), cell_updates)
                    xml = _strip_formula_cache(xml)
                    content = xml.encode('utf-8')
                elif item == 'xl/workbook.xml':
                    content = _force_recalc(content.decode('utf-8')).encode('utf-8')
                elif item == '[Content_Types].xml':
                    content = content.decode('utf-8').replace(
                        '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>',
                        '',
                    ).encode('utf-8')
                dst.writestr(item, content)
    return out.getvalue()


def _strip_formula_cache(xml: str) -> str:
    """Remove cached <v> values from formula cells so LibreOffice/Excel recomputes."""
    import re
    return re.sub(
        r'(<c\s+[^>]*?>\s*<f[^>]*>[^<]*</f>)\s*<v>[^<]*</v>',
        r'\1',
        xml,
    )


def _force_recalc(workbook_xml: str) -> str:
    import re
    if '<calcPr' in workbook_xml:
        if 'fullCalcOnLoad' in workbook_xml:
            workbook_xml = re.sub(r'fullCalcOnLoad="[^"]*"', 'fullCalcOnLoad="1"', workbook_xml)
        else:
            workbook_xml = re.sub(r'<calcPr', '<calcPr fullCalcOnLoad="1"', workbook_xml, count=1)
    else:
        workbook_xml = workbook_xml.replace(
            '</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>', 1,
        )
    return workbook_xml


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
    """Convert Excel to PDF.

    Tries Microsoft Graph (renders ink/signatures faithfully) when configured;
    falls back to LibreOffice. setup_page=True bakes print-area + fit-to-page
    into the xlsx before converting (for generated quotations and STT exports).
    """
    # Rasterize ink (stylus) annotations — neither LibreOffice nor Graph PDF
    # export renders Excel's <xdr:contentPart> ink, so we convert them to PNG
    # images first.
    xlsx_buffer = _rasterize_inks(xlsx_buffer)
    if setup_page:
        xlsx_buffer = _bake_page_setup(xlsx_buffer, print_area)
    if _graph_configured():
        try:
            return _convert_via_graph(xlsx_buffer, print_area)
        except Exception:
            pass  # fall through to LibreOffice
    return _convert_via_libreoffice(xlsx_buffer, print_area, setup_page=False)


def _rasterize_inks(xlsx_bytes: bytes) -> bytes:
    """Replace Excel ink annotations with rendered PNG images.

    Excel stores stylus drawings as xl/ink/*.xml (W3C InkML) referenced from
    drawings via <xdr:contentPart>. PDF exporters skip these — we render each
    stroke to a PNG and substitute a normal <xdr:pic> anchor.
    """
    import zipfile
    import re
    from io import BytesIO

    with zipfile.ZipFile(BytesIO(xlsx_bytes)) as src:
        files = {name: src.read(name) for name in src.namelist()}

    drawings = [n for n in files if re.fullmatch(r'xl/drawings/drawing\d+\.xml', n)]
    if not drawings:
        return xlsx_bytes

    next_img_idx = max(
        [int(m.group(1)) for n in files
         for m in [re.search(r'xl/media/image(\d+)\.', n)] if m] + [0]
    ) + 1

    new_files = dict(files)
    changed = False

    for d_name in drawings:
        rels_name = d_name.replace('xl/drawings/', 'xl/drawings/_rels/') + '.rels'
        if rels_name not in files:
            continue
        drawing_xml = new_files[d_name].decode('utf-8')
        rels_xml = new_files[rels_name].decode('utf-8')

        rid_to_target = dict(re.findall(
            r'<Relationship\s+Id="(rId\d+)"[^>]*?Target="([^"]+)"', rels_xml))

        # Iterate twoCellAnchor blocks that wrap contentPart ink. Keep the
        # original <xdr:from>/<xdr:to> cell anchors (they scale with the page
        # layout), and replace only the AlternateContent with an <xdr:pic>
        # that stretches to fill the anchor.
        anchor_re = re.compile(
            r'(<xdr:twoCellAnchor[^>]*>)(.*?)(</xdr:twoCellAnchor>)', re.DOTALL)
        new_drawing = drawing_xml
        offset = 0
        for m in list(anchor_re.finditer(drawing_xml)):
            inner = m.group(2)
            cp = re.search(r'<xdr:contentPart[^>]*r:id="(rId\d+)"', inner)
            if not cp:
                continue
            rid = cp.group(1)
            ink_target = rid_to_target.get(rid, '')
            if 'ink' not in ink_target:
                continue
            ink_path = 'xl/' + ink_target.replace('../', '')
            if ink_path not in files:
                continue
            ext_m = re.search(r'<a:ext\s+cx="(\d+)"\s+cy="(\d+)"', inner)
            cx = int(ext_m.group(1)) if ext_m else 200000
            cy = int(ext_m.group(2)) if ext_m else 80000
            png = _render_ink_png(files[ink_path], cx, cy)
            if not png:
                continue

            img_name = f'xl/media/image_ink{next_img_idx}.png'
            new_files[img_name] = png
            new_rid = f'rIdInk{next_img_idx}'
            new_rel = (
                f'<Relationship Id="{new_rid}" '
                f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
                f'Target="../media/image_ink{next_img_idx}.png"/>'
            )
            rels_xml = rels_xml.replace('</Relationships>', new_rel + '</Relationships>')

            # Preserve <xdr:from> and <xdr:to>, replace the rest of the inner
            # content with a pic and clientData
            from_m = re.search(r'<xdr:from>.*?</xdr:from>', inner, re.DOTALL)
            to_m = re.search(r'<xdr:to>.*?</xdr:to>', inner, re.DOTALL)
            if not (from_m and to_m):
                continue
            new_inner = (
                from_m.group() + to_m.group() +
                f'<xdr:pic>'
                f'<xdr:nvPicPr>'
                f'<xdr:cNvPr id="{2000 + next_img_idx}" name="Ink {next_img_idx}"/>'
                f'<xdr:cNvPicPr/>'
                f'</xdr:nvPicPr>'
                f'<xdr:blipFill xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                f'<a:blip r:embed="{new_rid}"/>'
                f'<a:stretch><a:fillRect/></a:stretch>'
                f'</xdr:blipFill>'
                f'<xdr:spPr>'
                f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
                f'</xdr:spPr>'
                f'</xdr:pic>'
                f'<xdr:clientData/>'
            )
            new_anchor = m.group(1) + new_inner + m.group(3)
            start = m.start() + offset
            end = m.end() + offset
            new_drawing = new_drawing[:start] + new_anchor + new_drawing[end:]
            offset += len(new_anchor) - (end - start)
            next_img_idx += 1
            changed = True

        new_files[d_name] = new_drawing.encode('utf-8')
        new_files[rels_name] = rels_xml.encode('utf-8')

    if not changed:
        return xlsx_bytes

    # Update Content_Types if needed (PNG default may already be there)
    ct_name = '[Content_Types].xml'
    if ct_name in new_files:
        ct = new_files[ct_name].decode('utf-8')
        if 'Extension="png"' not in ct:
            ct = ct.replace(
                '<Types ',
                '<Types ',
            ).replace(
                '</Types>',
                '<Default Extension="png" ContentType="image/png"/></Types>',
            )
            new_files[ct_name] = ct.encode('utf-8')

    out = BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for name, content in new_files.items():
            dst.writestr(name, content)
    return out.getvalue()


def _render_ink_png(ink_bytes: bytes, cx_emu: int, cy_emu: int) -> bytes | None:
    """Rasterize InkML traces to a transparent PNG sized to cx/cy EMU."""
    try:
        from xml.etree import ElementTree as ET
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    try:
        root = ET.fromstring(ink_bytes)
    except ET.ParseError:
        return None
    ns = {'i': 'http://www.w3.org/2003/InkML'}
    strokes = []
    for tr in root.findall('.//i:trace', ns):
        text = (tr.text or '').strip()
        if not text:
            continue
        pts = []
        for entry in text.replace('\n', ' ').split(','):
            parts = entry.strip().split()
            if len(parts) >= 2:
                try:
                    pts.append((float(parts[0]), float(parts[1])))
                except ValueError:
                    pass
        if pts:
            strokes.append(pts)
    if not strokes:
        return None

    all_x = [p[0] for s in strokes for p in s]
    all_y = [p[1] for s in strokes for p in s]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)

    # 9525 EMU per pixel @ 96 DPI; scale up 2x for crisper rendering
    w_px = max(int(cx_emu / 9525) * 2, 8)
    h_px = max(int(cy_emu / 9525) * 2, 8)

    img = Image.new('RGBA', (w_px, h_px), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    pad = 2
    sx = (w_px - 2 * pad) / max(max_x - min_x, 1e-6)
    sy = (h_px - 2 * pad) / max(max_y - min_y, 1e-6)
    scale = min(sx, sy)
    off_x = (w_px - (max_x - min_x) * scale) / 2
    off_y = (h_px - (max_y - min_y) * scale) / 2

    for pts in strokes:
        scaled = [((x - min_x) * scale + off_x, (y - min_y) * scale + off_y) for x, y in pts]
        if len(scaled) >= 2:
            draw.line(scaled, fill=(0, 0, 0, 255), width=max(2, w_px // 80))

    from io import BytesIO
    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _convert_via_libreoffice(xlsx_buffer: bytes, print_area: str, setup_page: bool) -> bytes:
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
        if not soffice and sys.platform == 'win32':
            for p in (r'C:\Program Files\LibreOffice\program\soffice.exe',
                      r'C:\Program Files (x86)\LibreOffice\program\soffice.exe'):
                if os.path.exists(p):
                    soffice = p
                    break
        if not soffice:
            raise RuntimeError(
                'LibreOffice not found. Install it (apt-get install libreoffice on '
                'Linux, or download from libreoffice.org on Windows).'
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


def _convert_via_graph(xlsx_buffer: bytes, print_area: str) -> bytes:
    """Upload xlsx to OneDrive, set page layout, render PDF, delete temp file.

    Microsoft renders the file with the real Excel engine — handles ink
    annotations, signatures, charts, etc. correctly.
    """
    token = get_access_token()
    sender = settings.GRAPH_SENDER_EMAIL
    temp_name = f'_stt_convert_{int(time.time() * 1000)}.xlsx'
    item_url = f'https://graph.microsoft.com/v1.0/users/{sender}/drive/root:/{temp_name}'
    auth = {'Authorization': f'Bearer {token}'}

    upload = requests.put(
        f'{item_url}:/content',
        headers={**auth, 'Content-Type':
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
        data=xlsx_buffer, timeout=120,
    )
    if not upload.ok:
        raise RuntimeError(f'OneDrive upload failed: {upload.text}')
    item_id = upload.json()['id']

    excel_base = (f'https://graph.microsoft.com/v1.0/users/{sender}'
                  f'/drive/items/{item_id}/workbook')
    json_hdr = {**auth, 'Content-Type': 'application/json'}

    try:
        session = requests.post(f'{excel_base}/createSession', headers=json_hdr,
                                json={'persistChanges': True}, timeout=60)
        session_id = session.json().get('id') if session.ok else None
        s_hdr = {**json_hdr, 'workbook-session-id': session_id} if session_id else json_hdr

        ws_resp = requests.get(f'{excel_base}/worksheets', headers=s_hdr, timeout=60)
        if ws_resp.ok:
            sheets = ws_resp.json().get('value', [])
            if sheets:
                first = sheets[0]
                from urllib.parse import quote
                ws_path = f"worksheets('{quote(first['id'])}')"
                # Hide other sheets so PDF only contains the first
                for s in sheets[1:]:
                    requests.patch(
                        f"{excel_base}/worksheets('{quote(s['id'])}')",
                        headers=s_hdr, json={'visibility': 'hidden'}, timeout=60,
                    )
                requests.patch(f'{excel_base}/{ws_path}/pageLayout', headers=s_hdr,
                               json={
                                   'paperSize': 'A4',
                                   'orientation': 'portrait',
                                   'centerHorizontally': True,
                                   'leftMargin': 0.4, 'rightMargin': 0.4,
                                   'topMargin': 0.4, 'bottomMargin': 0.4,
                                   'headerMargin': 0.2, 'footerMargin': 0.2,
                                   'zoom': {'fitToPagesWide': 1, 'fitToPagesTall': 1},
                               }, timeout=60)
                requests.post(f'{excel_base}/names/add', headers=s_hdr, json={
                    'name': '_xlnm.Print_Area',
                    'reference': f"='{first['name']}'!{print_area}",
                }, timeout=60)

        if session_id:
            requests.post(f'{excel_base}/closeSession', headers=s_hdr, timeout=30)

        pdf = requests.get(
            f'https://graph.microsoft.com/v1.0/users/{sender}'
            f'/drive/items/{item_id}/content?format=pdf',
            headers=auth, timeout=120,
        )
        if not pdf.ok:
            raise RuntimeError(f'PDF render failed: {pdf.text}')
        return pdf.content
    finally:
        requests.delete(
            f'https://graph.microsoft.com/v1.0/users/{sender}/drive/items/{item_id}',
            headers=auth, timeout=30,
        )


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
    # pageMargins: equal left/right for centered look
    margins = ('<pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" '
               'header="0.2" footer="0.2"/>')
    # printOptions: center horizontally on page
    print_opts = '<printOptions horizontalCentered="1"/>'
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
    # printOptions must come BEFORE pageMargins per ECMA-376
    xml = re.sub(r'<printOptions[^/]*/>', print_opts, xml, count=1)
    if '<printOptions' not in xml:
        xml = xml.replace('<pageMargins', print_opts + '<pageMargins', 1)
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
