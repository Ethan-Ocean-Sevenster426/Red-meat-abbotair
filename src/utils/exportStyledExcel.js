/**
 * Export data to a styled Excel file matching the app's table look.
 *
 * @param {Object} opts
 * @param {Array<{key: string, label: string}>} opts.columns - Column definitions
 * @param {Array<Object>} opts.rows - Data rows
 * @param {string} opts.sheetName - Worksheet name
 * @param {string} opts.fileName - Output file name
 * @param {string} [opts.headerColor='FF0078D4'] - ARGB header background color
 * @param {string} [opts.title] - Optional title row text
 */
export async function exportStyledExcel({ columns, rows, sheetName, fileName, headerColor = 'FF0078D4', title }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  let startRow = 1;

  // Optional title row
  if (title) {
    ws.mergeCells(1, 1, 1, columns.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;
    startRow = 2;
  }

  // Header row
  const headerRow = ws.getRow(startRow);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = {
      right: { style: 'thin', color: { argb: 'FF' + lighten(headerColor.slice(2)) } },
      bottom: { style: 'thin', color: { argb: 'FF' + darken(headerColor.slice(2)) } },
    };
  });
  headerRow.height = 22;
  headerRow.commit();

  // Data rows
  rows.forEach((row, i) => {
    const vals = columns.map(c => row[c.key] ?? '');
    const r = ws.addRow(vals);
    const stripe = i % 2 === 0 ? 'FFFFFFFF' : 'FFF7F8FA';
    r.eachCell((cell, ci) => {
      cell.font = { size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripe } };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFEDEBE9' } },
        right: { style: 'hair', color: { argb: 'FFF2F3F5' } },
      };
    });
  });

  // Auto column widths
  columns.forEach((col, i) => {
    let maxLen = col.label.length;
    rows.forEach(row => {
      const v = String(row[col.key] ?? '');
      if (v.length > maxLen) maxLen = v.length;
    });
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 8), 50);
  });

  // Download
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Simple color helpers
function lighten(hex) {
  return hex.replace(/../g, h => {
    const v = Math.min(255, parseInt(h, 16) + 40);
    return v.toString(16).padStart(2, '0');
  });
}
function darken(hex) {
  return hex.replace(/../g, h => {
    const v = Math.max(0, parseInt(h, 16) - 30);
    return v.toString(16).padStart(2, '0');
  });
}
