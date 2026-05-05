import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const MONTHS = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' },   { v: 5, l: 'May' },       { v: 6, l: 'June' },
  { v: 7, l: 'July' },    { v: 8, l: 'August' },    { v: 9, l: 'September' },
  { v: 10, l: 'October' },{ v: 11, l: 'November' },  { v: 12, l: 'December' },
];
const QUARTERS = [
  { v: 1, l: 'Q1 (Jan – Mar)' }, { v: 2, l: 'Q2 (Apr – Jun)' },
  { v: 3, l: 'Q3 (Jul – Sep)' }, { v: 4, l: 'Q4 (Oct – Dec)' },
];

// ─── Multi-select filter dropdown ────────────────────────────────────────────

function MultiFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);

  const handleOpen = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setSearch('');
    setOpen(true);
  };

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const has = selected.length > 0;
  const display = has ? `${label} (${selected.length})` : label;

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} style={{
        background: '#ffffff', border: '1px solid #8a8886',
        color: '#323130', borderRadius: '2px', padding: '5px 8px', cursor: 'pointer',
        fontSize: '0.75rem', fontWeight: 400, width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '4px', lineHeight: 1, height: 28, boxSizing: 'border-box',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
        {has && <span style={{ background: '#0078d4', color: '#fff', borderRadius: 10, fontSize: '0.6rem', padding: '0 5px', lineHeight: '1.5', fontWeight: 700, flexShrink: 0 }}>{selected.length}</span>}
        <span style={{ fontSize: '0.5rem', opacity: 0.5, flexShrink: 0 }}>▼</span>
      </button>
      {open && rect && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 8999 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed', top: rect.bottom + 3, left: rect.left,
            minWidth: Math.max(rect.width, 200), maxWidth: 280,
            zIndex: 9000, background: '#fff', border: '1px solid #d0d7de', borderRadius: 5,
            boxShadow: '0 6px 18px rgba(0,0,0,0.16)', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '7px 10px 5px', borderBottom: '1px solid #edebe9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: '0.73rem', color: '#323130' }}>{label}</span>
              {has && (
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: '#0078d4', padding: 0 }}
                  onClick={() => { onChange([]); }}>Clear all</button>
              )}
            </div>
            {/* Search */}
            {options.length > 6 && (
              <div style={{ padding: '5px 8px', borderBottom: '1px solid #edebe9' }}>
                <input autoFocus style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #c8c6c4', borderRadius: 3, padding: '3px 7px', fontSize: '0.72rem', outline: 'none', color: '#323130' }}
                  placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
              </div>
            )}
            {/* Options */}
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#888', fontStyle: 'italic' }}>No matches</div>
              )}
              {filtered.map(opt => {
                const checked = selected.includes(opt.value);
                return (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 12px', cursor: 'pointer', background: 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f2f1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 14, height: 14, flexShrink: 0,
                      border: `1.5px solid ${checked ? '#0078d4' : '#8a8886'}`,
                      borderRadius: 2, background: checked ? '#0078d4' : '#fff',
                      marginRight: 8, fontSize: '0.6rem', color: '#fff', transition: 'all 0.1s',
                    }}>{checked ? '✓' : ''}</span>
                    <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: '#323130', userSelect: 'none', lineHeight: '1.4' }}>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

const HEADER_BG = '#2e4b8a';

const REPORT_COLS = [
  { key: 'training_start_date', label: 'Training Date',  w: 100, fmt: true },
  { key: 'abattoir_name',       label: 'Abattoir Name',  w: 190 },
  { key: 'province',            label: 'Province',       w: 120 },
  { key: 'municipality',        label: 'Municipality',   w: 130 },
  { key: 'thru_put',            label: 'Throughput',       w: 70  },
  { key: 'specie',              label: 'Specie',         w: 70  },
  { key: 'total_trained',       label: 'No. Trained',    w: 72,  num: true },
  { key: 'am',                  label: 'AM',  w: 40, num: true },
  { key: 'af',                  label: 'AF',  w: 40, num: true },
  { key: 'ad',                  label: 'AD',  w: 40, num: true },
  { key: 'cm',                  label: 'CM',  w: 40, num: true },
  { key: 'cf',                  label: 'CF',  w: 40, num: true },
  { key: 'cd',                  label: 'CD',  w: 40, num: true },
  { key: 'im',                  label: 'IM',  w: 40, num: true },
  { key: 'if_',                 label: 'IF',  w: 40, num: true },
  { key: 'id_2',                label: 'ID',  w: 40, num: true },
  { key: 'wm',                  label: 'WM',  w: 40, num: true },
  { key: 'wf',                  label: 'WF',  w: 40, num: true },
  { key: 'wd',                  label: 'WD',  w: 40, num: true },
  { key: 'age_lt35',            label: '< 35',    w: 44, num: true },
  { key: 'age_35_55',           label: '35 > 55', w: 52, num: true },
  { key: 'age_gt55',            label: '55 >',    w: 44, num: true },
  { key: 'hdis',                label: "HDI's",   w: 48, num: true },
  { key: 'disability_count',    label: 'Disability', w: 68, num: true },
];

function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sum(rows, key) {
  return rows.reduce((a, r) => a + (parseInt(r[key]) || 0), 0);
}

function FilterGroup({ label, children, wide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: wide ? 160 : 120, flex: wide ? '1 1 160px' : '0 0 120px' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </div>
  );
}

export default function STTBreakdownReport() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [yearOpts, setYearOpts]         = useState([]);
  const [provinceOpts, setProvinceOpts] = useState([]);
  const [abattoirOpts, setAbattoirOpts] = useState([]);

  const [fYears,    setFYears]    = useState([]);
  const [fMonths,   setFMonths]   = useState([]);
  const [fQuarter,  setFQuarter]  = useState('');
  const [fProvinces,setFProvinces]= useState([]);
  const [fAbattoirs,setFAbattoirs]= useState([]);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const load = async (filters = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.years?.length)     params.set('year',     filters.years.join(','));
      if (filters.months?.length)    params.set('month',    filters.months.join(','));
      if (filters.quarter)           params.set('quarter',  filters.quarter);
      if (filters.provinces?.length) params.set('province', filters.provinces.join(','));
      if (filters.abattoirs?.length)  params.set('abattoir', filters.abattoirs.join(','));
      const res  = await fetch(`/api/stt-training-report/breakdown?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(data.rows || []);
      setYearOpts(data.years || []);
      setProvinceOpts(data.provinces || []);
      setAbattoirOpts(data.abattoirs || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load({}); }, []);

  const applyFilters = () => load({ years: fYears, months: fMonths, quarter: fQuarter, provinces: fProvinces, abattoirs: fAbattoirs });

  const clearFilters = () => {
    setFYears([]); setFMonths([]); setFQuarter(''); setFProvinces([]); setFAbattoirs([]);
    load({});
  };

  const hasFilter = !!(fYears.length || fMonths.length || fQuarter || fProvinces.length || fAbattoirs.length);

  const titleParts = [];
  if (fProvinces.length) titleParts.push(fProvinces.join(', '));
  if (fYears.length) {
    const yearStr = fYears.join(', ');
    if (fMonths.length) titleParts.push(`${fMonths.map(m => MONTHS.find(x => x.v === m)?.l).join(', ')} ${yearStr}`);
    else if (fQuarter) titleParts.push(`${QUARTERS.find(q => String(q.v) === fQuarter)?.l} ${yearStr}`);
    else titleParts.push(yearStr);
  }
  if (fAbattoirs.length) titleParts.push(fAbattoirs.join(', '));
  const reportTitle = titleParts.length
    ? `Detailed Training Breakdown — ${titleParts.join(', ')}`
    : 'Detailed Training Breakdown';

  const handleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  const [view, setView] = useState('table'); // 'table' | 'analytics'
  const analyticsRef = useRef(null);

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortCol) return 0;
    const col = REPORT_COLS.find(c => c.key === sortCol);
    let av = a[sortCol], bv = b[sortCol];
    if (col?.num) { av = parseInt(av) || 0; bv = parseInt(bv) || 0; }
    else { av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ── Analytics data ──
  const CHART_COLORS = ['#0078d4','#107c10','#d13438','#8764b8','#ca5010','#008272','#5c2d91','#986f0b','#4f6bed'];
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const analytics = useMemo(() => {
    if (!rows.length) return null;

    // By month
    const byMonth = {};
    rows.forEach(r => {
      const d = new Date(r.training_start_date);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!byMonth[key]) byMonth[key] = { key, label, trained: 0 };
      byMonth[key].trained += parseInt(r.total_trained) || 0;
    });
    const monthlyData = Object.values(byMonth).sort((a,b) => a.key.localeCompare(b.key));

    // By province
    const byProv = {};
    rows.forEach(r => {
      const p = r.province || 'Unknown';
      if (!byProv[p]) byProv[p] = { name: p, trained: 0 };
      byProv[p].trained += parseInt(r.total_trained) || 0;
    });
    const provinceData = Object.values(byProv).sort((a,b) => b.trained - a.trained);

    // By species
    const bySpecies = {};
    rows.forEach(r => {
      const sp = r.specie || 'Unknown';
      if (!bySpecies[sp]) bySpecies[sp] = { name: sp, trained: 0 };
      bySpecies[sp].trained += parseInt(r.total_trained) || 0;
    });
    const speciesData = Object.values(bySpecies).sort((a,b) => b.trained - a.trained);

    // Gender totals (D = disabled within race)
    const gender = { AM: 0, AF: 0, AD: 0, CM: 0, CF: 0, CD: 0,
                     IM: 0, IF: 0, ID: 0, WM: 0, WF: 0, WD: 0 };
    rows.forEach(r => {
      gender.AM += parseInt(r.am) || 0;
      gender.AF += parseInt(r.af) || 0;
      gender.AD += parseInt(r.ad) || 0;
      gender.CM += parseInt(r.cm) || 0;
      gender.CF += parseInt(r.cf) || 0;
      gender.CD += parseInt(r.cd) || 0;
      gender.IM += parseInt(r.im) || 0;
      gender.IF += parseInt(r.if_) || 0;
      gender.ID += parseInt(r.id_2) || 0;
      gender.WM += parseInt(r.wm) || 0;
      gender.WF += parseInt(r.wf) || 0;
      gender.WD += parseInt(r.wd) || 0;
    });
    const genderData = [
      { name: 'African Male', value: gender.AM, color: '#0078d4' },
      { name: 'African Female', value: gender.AF, color: '#40a9ff' },
      { name: 'African Disabled', value: gender.AD, color: '#69c0ff' },
      { name: 'Coloured Male', value: gender.CM, color: '#107c10' },
      { name: 'Coloured Female', value: gender.CF, color: '#52c41a' },
      { name: 'Coloured Disabled', value: gender.CD, color: '#95de64' },
      { name: 'Indian Male', value: gender.IM, color: '#ca5010' },
      { name: 'Indian Female', value: gender.IF, color: '#fa8c16' },
      { name: 'Indian Disabled', value: gender.ID, color: '#ffc069' },
      { name: 'White Male', value: gender.WM, color: '#5c2d91' },
      { name: 'White Female', value: gender.WF, color: '#b37feb' },
      { name: 'White Disabled', value: gender.WD, color: '#d3adf7' },
    ].filter(g => g.value > 0);

    // Ethnicity (race groups)
    const ethnicity = [
      { name: 'African', value: gender.AM + gender.AF + gender.AD, color: '#0078d4' },
      { name: 'Coloured', value: gender.CM + gender.CF + gender.CD, color: '#107c10' },
      { name: 'Indian', value: gender.IM + gender.IF + gender.ID, color: '#ca5010' },
      { name: 'White', value: gender.WM + gender.WF + gender.WD, color: '#5c2d91' },
    ].filter(e => e.value > 0);

    // Age groups
    const age = { '<35': 0, '35-55': 0, '55+': 0 };
    rows.forEach(r => {
      age['<35'] += parseInt(r.age_lt35) || 0;
      age['35-55'] += parseInt(r.age_35_55) || 0;
      age['55+'] += parseInt(r.age_gt55) || 0;
    });
    const ageData = [
      { name: 'Under 35', value: age['<35'], color: '#0078d4' },
      { name: '35 to 55', value: age['35-55'], color: '#107c10' },
      { name: 'Over 55', value: age['55+'], color: '#ca5010' },
    ].filter(a => a.value > 0);

    // Grand total
    const totalTrained = rows.reduce((s, r) => s + (parseInt(r.total_trained) || 0), 0);
    const totalMale = gender.AM + gender.CM + gender.IM + gender.WM;
    const totalFemale = gender.AF + gender.CF + gender.IF + gender.WF;
    const totalDisability = rows.reduce((s, r) => s + (parseInt(r.disability_count) || 0), 0);

    return { monthlyData, provinceData, speciesData, genderData, ethnicity, ageData, totalTrained, totalMale, totalFemale, totalDisability };
  }, [rows]);

  const exportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Breakdown');

    // Title row
    ws.mergeCells(1, 1, 1, REPORT_COLS.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = reportTitle;
    titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4B8A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Header row
    const headerRow = ws.addRow(REPORT_COLS.map(c => c.label));
    headerRow.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4B8A' } };
      cell.alignment = { horizontal: REPORT_COLS[ci - 1]?.num ? 'right' : 'left', vertical: 'middle' };
      cell.border = { right: { style: 'thin', color: { argb: 'FF4A6BB5' } }, bottom: { style: 'thin', color: { argb: 'FF1A3570' } } };
    });
    headerRow.height = 22;

    // Data rows
    const dataRows = sortedRows.length ? sortedRows : rows;
    dataRows.forEach((row, i) => {
      const vals = REPORT_COLS.map(c => c.fmt ? fmt(row[c.key]) : c.num ? (parseInt(row[c.key]) || 0) : (row[c.key] || ''));
      const r = ws.addRow(vals);
      const stripe = i % 2 === 0 ? 'FFFFFFFF' : 'FFF7F8FA';
      r.eachCell((cell, ci) => {
        cell.font = { size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripe } };
        cell.alignment = { horizontal: REPORT_COLS[ci - 1]?.num ? 'right' : 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFEEF0F2' } }, right: { style: 'hair', color: { argb: 'FFF2F3F5' } } };
      });
    });

    // Totals row
    const totVals = REPORT_COLS.map(c => c.num ? sum(rows, c.key) : (c.key === 'training_start_date' ? 'TOTALS' : ''));
    const totRow = ws.addRow(totVals);
    totRow.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4B8A' } };
      cell.alignment = { horizontal: REPORT_COLS[ci - 1]?.num ? 'right' : 'left', vertical: 'middle' };
      cell.border = { right: { style: 'thin', color: { argb: 'FF4A6BB5' } } };
    });
    totRow.height = 22;

    // Column widths
    REPORT_COLS.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(c.w / 7, c.label.length + 2); });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'STT_Training_Breakdown.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Province summary helper ──
  const getProvinceSummary = () => {
    const provMap = {};
    rows.forEach(r => {
      const p = (r.province || 'Unknown').toUpperCase();
      if (!provMap[p]) provMap[p] = { province: p, visits: 0, trained: 0, hdis: 0 };
      provMap[p].visits += 1;
      provMap[p].trained += parseInt(r.total_trained) || 0;
      provMap[p].hdis += parseInt(r.hdis) || 0;
    });
    return Object.values(provMap).sort((a, b) => a.province.localeCompare(b.province));
  };

  const exportProvinceExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Provincial Summary');
    const provRows = getProvinceSummary();
    const yearLabel = fYears.length ? fYears.join(', ') : 'ALL';

    // Title row
    ws.mergeCells(1, 1, 1, 5);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `Provincial Summary — ${yearLabel}`;
    titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4B8A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Header row
    const headers = ['#', 'PROVINCE', 'VISITS', '# TRAINED', "# HDI's"];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4B8A' } };
      cell.alignment = { horizontal: ci <= 2 ? 'left' : 'right', vertical: 'middle' };
      cell.border = { right: { style: 'thin', color: { argb: 'FF4A6BB5' } }, bottom: { style: 'thin', color: { argb: 'FF1A3570' } } };
    });
    headerRow.height = 22;

    // Data rows
    provRows.forEach((r, i) => {
      const row = ws.addRow([`${i + 1}.`, r.province, r.visits, r.trained, r.hdis]);
      const stripe = i % 2 === 0 ? 'FFFFFFFF' : 'FFF7F8FA';
      row.eachCell((cell, ci) => {
        cell.font = { size: 10, bold: ci >= 4 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripe } };
        cell.alignment = { horizontal: ci <= 2 ? 'left' : 'right', vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFEEF0F2' } } };
      });
    });

    // Totals row
    const totVisits = provRows.reduce((s, r) => s + r.visits, 0);
    const totTrained = provRows.reduce((s, r) => s + r.trained, 0);
    const totHdis = provRows.reduce((s, r) => s + r.hdis, 0);
    const totRow = ws.addRow(['', `YEAR TOTALS: ${yearLabel}`, totVisits, totTrained, totHdis]);
    totRow.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4B8A' } };
      cell.alignment = { horizontal: ci <= 2 ? 'left' : 'right', vertical: 'middle' };
    });
    totRow.height = 22;

    // Column widths
    [6, 30, 12, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'STT_Provincial_Summary.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAnalyticsPdf = async () => {
    if (!analyticsRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const el = analyticsRef.current;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f3f4f6' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const imgRatio = canvas.width / canvas.height;
    let w = usableW;
    let h = w / imgRatio;
    if (h > usableH) { h = usableH; w = h * imgRatio; }
    const x = margin + (usableW - w) / 2;
    pdf.addImage(imgData, 'PNG', x, margin, w, h);
    pdf.save('STT_Training_Analytics.pdf');
  };

  const sel = (val, onChange, opts, placeholder, disabled) => (
    <select
      style={{ ...s.select, ...(disabled ? s.selectDisabled : {}) }}
      value={val}
      onChange={onChange}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {opts.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
    </select>
  );

  return (
    <div style={s.page} className="page-print">
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={s.header} className="no-print">
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/training-report/stt')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>STT Training Breakdown Report</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.body} className="body-print">

        {/* ── Filter Panel ── */}
        <div style={s.filterPanel} className="no-print">
          <div style={s.filterPanelHeader}>
            <span style={s.filterPanelTitle}>Filters</span>
            {hasFilter && (
              <button onClick={clearFilters} style={s.btnClearSmall}>✕ Clear all</button>
            )}
          </div>
          <div style={s.filterGrid}>
            <FilterGroup label="Year">
              <MultiFilter label="All Years" options={yearOpts.map(y => ({ value: y, label: String(y) }))} selected={fYears} onChange={setFYears} />
            </FilterGroup>
            <FilterGroup label="Month">
              <MultiFilter label="All Months" options={MONTHS.map(m => ({ value: m.v, label: m.l }))} selected={fMonths} onChange={v => { setFMonths(v); setFQuarter(''); }} />
            </FilterGroup>
            <FilterGroup label="Quarter">
              {sel(fQuarter, e => { setFQuarter(e.target.value); setFMonths([]); }, QUARTERS, 'All Quarters', !fYears.length)}
            </FilterGroup>
            <FilterGroup label="Province">
              <MultiFilter label="All Provinces" options={provinceOpts.map(p => ({ value: p, label: p }))} selected={fProvinces} onChange={setFProvinces} />
            </FilterGroup>
            {view !== 'province' && (
              <FilterGroup label="Abattoir">
                <MultiFilter label="All Abattoirs" options={abattoirOpts.map(a => ({ value: a, label: a }))} selected={fAbattoirs} onChange={setFAbattoirs} />
              </FilterGroup>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button onClick={applyFilters} style={s.btnApply}>Apply</button>
            </div>
          </div>
        </div>

        {error && <div style={s.errorMsg}>{error}</div>}

        {/* ── Toolbar ── */}
        <div style={s.toolbar} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={s.viewToggle}>
              <button onClick={() => setView('province')} style={view === 'province' ? s.viewBtnActive : s.viewBtn}>Province</button>
              <button onClick={() => setView('table')} style={view === 'table' ? s.viewBtnActive : s.viewBtn}>All Data</button>
              <button onClick={() => setView('analytics')} style={view === 'analytics' ? s.viewBtnActive : s.viewBtn}>Analytics</button>
            </div>
            <span style={s.recordCount}>
              {loading ? 'Loading…' : `${rows.length} training session${rows.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {view !== 'analytics' && (
              <button onClick={view === 'province' ? exportProvinceExcel : exportExcel} style={s.btnExport} disabled={rows.length === 0}>Export Excel</button>
            )}
            {view === 'analytics' ? (
              <button onClick={exportAnalyticsPdf} style={s.btnPrint} disabled={!analytics}>Export PDF</button>
            ) : (
              <button onClick={() => window.print()} style={s.btnPrint}>Print</button>
            )}
          </div>
        </div>

        {/* ── Analytics ── */}
        {view === 'analytics' && analytics && (
          <div style={s.analyticsWrap} className="analytics-print" ref={analyticsRef}>
            {/* KPI summary strip */}
            <div style={s.kpiStrip}>
              {[
                { v: analytics.totalTrained, l: 'People Trained', icon: '👥', c: '#0078d4', bg: '#e8f4fd' },
                { v: rows.length, l: 'Training Sessions', icon: '📋', c: '#107c10', bg: '#dff6dd' },
                { v: analytics.totalMale, l: 'Male Delegates', icon: '♂', c: '#2e4b8a', bg: '#e5eaf4' },
                { v: analytics.totalFemale, l: 'Female Delegates', icon: '♀', c: '#8764b8', bg: '#f0ebf8' },
                { v: analytics.totalDisability, l: 'With Disability', icon: '♿', c: '#ca5010', bg: '#fff4ce' },
              ].map((k, i) => (
                <div key={i} style={{ ...s.kpiCard, borderLeft: `3px solid ${k.c}` }}>
                  <div style={s.kpiTop}>
                    <span style={{ ...s.kpiIcon, background: k.bg, color: k.c }}>{k.icon}</span>
                    <div>
                      <div style={{ ...s.kpiValue, color: k.c }}>{k.v.toLocaleString()}</div>
                      <div style={s.kpiLabel}>{k.l}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 1: Monthly training volume */}
            <div style={s.chartCard}>
              <div style={s.chartHeader}>
                <div>
                  <div style={s.chartTitle}>Monthly Training Volume</div>
                  <div style={s.chartDesc}>Number of people trained per month across all sessions</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.monthlyData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#605e5c' }} axisLine={{ stroke: '#edebe9' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#605e5c' }} width={40} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #edebe9' }} />
                  <Bar dataKey="trained" fill="#0078d4" radius={[3,3,0,0]} name="People Trained" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Row 2: Province + Species */}
            <div style={s.chartRow}>
              <div style={{ ...s.chartCard, flex: 3 }}>
                <div style={s.chartHeader}>
                  <div>
                    <div style={s.chartTitle}>Provincial Distribution</div>
                    <div style={s.chartDesc}>Training reach across South African provinces</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={analytics.provinceData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#605e5c' }} axisLine={{ stroke: '#edebe9' }} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#323130' }} width={85} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #edebe9' }} />
                    <Bar dataKey="trained" fill="#2e4b8a" radius={[0,3,3,0]} name="People Trained">
                      {analytics.provinceData.map((_, i) => <Cell key={i} fill={i === 0 ? '#0078d4' : '#2e4b8a'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...s.chartCard, flex: 2 }}>
                <div style={s.chartHeader}>
                  <div>
                    <div style={s.chartTitle}>Species Breakdown</div>
                    <div style={s.chartDesc}>Slaughter technique training by animal type</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={analytics.speciesData} dataKey="trained" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                      {analytics.speciesData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #edebe9' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 3: Ethnicity + Age + Gender */}
            <div style={s.chartRow}>
              <div style={{ ...s.chartCard, flex: 1 }}>
                <div style={s.chartHeader}>
                  <div>
                    <div style={s.chartTitle}>Ethnicity</div>
                    <div style={s.chartDesc}>Racial group distribution of trained delegates</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.ethnicity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={75} paddingAngle={2} label={({ name, value, percent }) => `${name}: ${value} (${(percent*100).toFixed(0)}%)`} labelLine={false} style={{ fontSize: 10 }}>
                      {analytics.ethnicity.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #edebe9' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...s.chartCard, flex: 1 }}>
                <div style={s.chartHeader}>
                  <div>
                    <div style={s.chartTitle}>Age Distribution</div>
                    <div style={s.chartDesc}>Delegates grouped by age bracket</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.ageData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={75} paddingAngle={3} label={({ name, value, percent }) => `${name}: ${value} (${(percent*100).toFixed(0)}%)`} labelLine={false} style={{ fontSize: 10 }}>
                      {analytics.ageData.map((a, i) => <Cell key={i} fill={a.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #edebe9' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...s.chartCard, flex: 2 }}>
                <div style={s.chartHeader}>
                  <div>
                    <div style={s.chartTitle}>Race & Gender Breakdown</div>
                    <div style={s.chartDesc}>African (A), Coloured (C), Indian (I), White (W) — Male (M) / Female (F)</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.genderData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#605e5c' }} axisLine={{ stroke: '#edebe9' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#605e5c' }} width={35} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #edebe9' }} />
                    <Bar dataKey="value" name="Delegates" radius={[3,3,0,0]}>
                      {analytics.genderData.map((g, i) => <Cell key={i} fill={g.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && !analytics && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#8a8886' }}>No data to display. Apply filters and click Apply.</div>
        )}

        {/* ── Province View ── */}
        {view === 'province' && (() => {
          const provRows = getProvinceSummary();
          const totVisits = provRows.reduce((s, r) => s + r.visits, 0);
          const totTrained = provRows.reduce((s, r) => s + r.trained, 0);
          const totHdis = provRows.reduce((s, r) => s + r.hdis, 0);
          const yearLabel = fYears.length ? fYears.join(', ') : 'ALL';
          return (
            <div style={{ background: '#fff', border: '1px solid #e1e4e8', borderRadius: 4, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minHeight: 0 }}>
              <div style={{ background: HEADER_BG, color: '#fff', fontWeight: 700, fontSize: '0.88rem', textAlign: 'center', padding: '11px 16px', letterSpacing: '0.03em' }}>
                Provincial Summary
              </div>
              {loading ? (
                <div style={s.loadMsg}>Loading…</div>
              ) : provRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>No records match the selected filters.</div>
              ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, width: 40, textAlign: 'center' }}>#</th>
                      <th style={{ ...s.th, textAlign: 'left' }}>PROVINCE</th>
                      <th style={{ ...s.th, textAlign: 'right', width: 120 }}>VISITS</th>
                      <th style={{ ...s.th, textAlign: 'right', width: 140 }}># TRAINED</th>
                      <th style={{ ...s.th, textAlign: 'right', width: 140 }}># HDI's</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provRows.map((r, i) => (
                      <tr key={r.province} style={{ background: i % 2 === 0 ? '#ffffff' : '#f7f8fa' }}>
                        <td style={{ ...s.td, textAlign: 'center', fontWeight: 600, color: HEADER_BG, fontSize: '0.8rem' }}>{i + 1}.</td>
                        <td style={{ ...s.td, fontWeight: 600, color: '#323130', fontSize: '0.8rem' }}>{r.province}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>{r.visits.toLocaleString()}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>{r.trained.toLocaleString()}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>{r.hdis.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ ...s.totalsLabel, textAlign: 'right', paddingRight: 16 }}>YEAR TOTALS: {yearLabel}</td>
                      <td style={{ ...s.totalsCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totVisits.toLocaleString()}</td>
                      <td style={{ ...s.totalsCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totTrained.toLocaleString()}</td>
                      <td style={{ ...s.totalsCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totHdis.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          );
        })()}

        {/* ── Table ── */}
        <div style={{ ...s.tableWrap, display: view === 'table' ? 'flex' : 'none', flexDirection: 'column' }}>
          <div style={s.reportTitle}>{reportTitle}</div>
          {loading ? (
            <div style={s.loadMsg}>Loading…</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {REPORT_COLS.map(col => {
                    const isSorted = sortCol === col.key;
                    return (
                      <th key={col.key} style={{ ...s.th, minWidth: col.w, textAlign: col.num ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort(col.key)}>
                        {col.label}
                        {isSorted && <span style={{ marginLeft: 3, fontSize: '0.55rem', opacity: 0.85 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={REPORT_COLS.length} style={{ ...s.td, textAlign: 'center', padding: '32px 16px', color: '#64748b', fontStyle: 'italic' }}>
                      No records match the selected filters.
                    </td>
                  </tr>
                )}
                {sortedRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f7f8fa' }}>
                    {REPORT_COLS.map(col => {
                      const val = col.fmt ? fmt(row[col.key]) : col.num ? (parseInt(row[col.key]) || 0) : (row[col.key] || '');
                      const extra = col.key === 'training_start_date' ? { fontWeight: 600, color: HEADER_BG }
                        : col.key === 'abattoir_name' ? { fontWeight: 600 }
                        : col.key === 'total_trained' ? { fontWeight: 600 }
                        : col.key === 'municipality' ? { color: '#444' } : {};
                      return (
                        <td key={col.key} style={{ ...s.td, ...(col.num ? s.num : {}), ...extra }}>{val}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={6} style={s.totalsLabel}>TOTALS</td>
                    <td style={{ ...s.totalsCell, ...s.num }}>{sum(rows,'total_trained')}</td>
                    {['am','af','ad','cm','cf','cd','im','if_','id_2','wm','wf','wd'].map(k => (
                      <td key={k} style={{ ...s.totalsCell, ...s.num }}>{sum(rows,k)}</td>
                    ))}
                    <td style={{ ...s.totalsCell, ...s.num }}>{sum(rows,'age_lt35')}</td>
                    <td style={{ ...s.totalsCell, ...s.num }}>{sum(rows,'age_35_55')}</td>
                    <td style={{ ...s.totalsCell, ...s.num }}>{sum(rows,'age_gt55')}</td>
                    <td style={{ ...s.totalsCell, ...s.num }}>{sum(rows,'hdis')}</td>
                    <td style={{ ...s.totalsCell, ...s.num }}>{sum(rows,'disability_count')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page:         { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#f3f4f6', overflow: 'hidden' },

  // Header
  header:       { background: '#0078d4', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', position: 'sticky', top: 0, zIndex: 200 },
  topBarLeft:   { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' },
  backBtn:      { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '2px', padding: '0 10px', cursor: 'pointer', fontSize: '0.9rem', width: 'auto', height: '28px', display: 'flex', alignItems: 'center', lineHeight: 1 },
  waffle:       { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' },
  waffleIcon:   { color: '#ffffff', fontSize: '1.1rem', letterSpacing: '-1px' },
  siteLabel:    { color: '#ffffff', fontSize: '0.95rem', fontWeight: 600 },
  topBarCenter: { flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' },
  pageTitle:    { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 400 },
  topBarRight:  { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px', justifyContent: 'flex-end' },
  userName:     { color: '#ffffff', fontSize: '0.85rem' },
  avatar:       { width: '32px', height: '32px', borderRadius: '50%', background: '#005a9e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.4)' },
  signOutBtn:   { background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#ffffff', padding: '4px 12px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', width: 'auto', margin: 0 },

  body:         { flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' },

  // Filter panel
  filterPanel:  { background: '#fff', border: '1px solid #e1e4e8', borderRadius: 4, padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  filterPanelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  filterPanelTitle:  { fontSize: '0.78rem', fontWeight: 700, color: '#323130', letterSpacing: '0.02em' },
  filterGrid:   { display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'flex-end' },
  select:       { fontSize: '0.75rem', border: '1px solid #c8c6c4', borderRadius: 3, padding: '5px 8px', color: '#323130', background: '#fff', cursor: 'pointer', width: '100%', outline: 'none', lineHeight: 1, height: 28, boxSizing: 'border-box' },
  selectDisabled: { background: '#f5f5f5', color: '#aaa', cursor: 'not-allowed' },
  btnApply:     { background: '#0078d4', border: '1px solid #0078d4', color: '#fff', borderRadius: 2, padding: '5px 18px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', height: 28, boxSizing: 'border-box' },
  btnClearSmall:{ background: 'none', border: 'none', color: '#a4262c', fontSize: '0.72rem', cursor: 'pointer', padding: 0 },

  // Toolbar
  toolbar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  recordCount:  { fontSize: '0.78rem', color: '#605e5c', fontWeight: 500 },
  btnExport:    { background: '#107c10', border: '1px solid #107c10', color: '#fff', borderRadius: 2, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1 },
  btnPrint:     { background: '#fff', border: '1px solid #8a8886', color: '#323130', borderRadius: 2, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', lineHeight: 1 },

  errorMsg:     { color: '#a4262c', background: '#fde7e9', border: '1px solid #f1707b', borderRadius: 4, padding: '8px 14px', fontSize: '0.78rem' },

  // Table
  tableWrap:    { background: '#fff', border: '1px solid #e1e4e8', borderRadius: 4, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minHeight: 0 },
  reportTitle:  { background: HEADER_BG, color: '#fff', fontWeight: 700, fontSize: '0.88rem', textAlign: 'center', padding: '11px 16px', letterSpacing: '0.03em' },
  loadMsg:      { padding: 40, textAlign: 'center', color: '#605e5c', fontSize: '0.85rem' },
  table:        { borderCollapse: 'collapse', width: '100%' },
  th:           { background: HEADER_BG, color: '#fff', padding: '7px 9px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.02em', borderRight: '1px solid rgba(255,255,255,0.12)', position: 'sticky', top: 0 },
  td:           { padding: '5px 9px', borderBottom: '1px solid #eef0f2', borderRight: '1px solid #f2f3f5', fontSize: '0.73rem', color: '#323130', whiteSpace: 'nowrap' },
  num:          { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  totalsLabel:  { padding: '7px 9px', background: HEADER_BG, color: '#fff', fontWeight: 700, fontSize: '0.73rem', borderRight: '1px solid rgba(255,255,255,0.15)' },
  totalsCell:   { padding: '7px 9px', background: HEADER_BG, color: '#fff', fontWeight: 700, fontSize: '0.73rem', borderRight: '1px solid rgba(255,255,255,0.15)' },

  // View toggle
  viewToggle:   { display: 'flex', border: '1px solid #8a8886', borderRadius: 2, overflow: 'hidden' },
  viewBtn:      { background: '#fff', border: 'none', color: '#323130', padding: '4px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 400, lineHeight: 1 },
  viewBtnActive:{ background: '#0078d4', border: 'none', color: '#fff', padding: '4px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1 },

  // Analytics
  analyticsWrap:{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '0', width: '100%' },
  kpiStrip:     { display: 'flex', gap: 10 },
  kpiCard:      { flex: 1, background: '#fff', border: '1px solid #edebe9', borderRadius: 4, padding: '14px 16px' },
  kpiTop:       { display: 'flex', alignItems: 'center', gap: 10 },
  kpiIcon:      { width: 34, height: 34, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 },
  kpiValue:     { fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.1 },
  kpiLabel:     { fontSize: '0.65rem', fontWeight: 500, color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.02em' },
  chartRow:     { display: 'flex', gap: 10 },
  chartCard:    { background: '#fff', border: '1px solid #edebe9', borderRadius: 4, padding: '14px 18px', overflow: 'hidden' },
  chartHeader:  { marginBottom: 8 },
  chartTitle:   { fontSize: '0.82rem', fontWeight: 600, color: '#323130' },
  chartDesc:    { fontSize: '0.68rem', color: '#8a8886', marginTop: 2 },
};
