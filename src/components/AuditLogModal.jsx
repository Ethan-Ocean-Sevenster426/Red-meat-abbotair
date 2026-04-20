import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MONTHS = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Feb' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Apr' }, { v: 5, l: 'May' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Aug' }, { v: 9, l: 'Sep' },
  { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dec' },
];
const curYear = new Date().getFullYear();
const YEARS = [];
for (let y = curYear; y >= 2020; y--) YEARS.push(y);

// ─── Multi-select dropdown ───────────────────────────────────────────────────

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
  const filtered = search ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} style={{
        background: '#fff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px',
        padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 400,
        display: 'flex', alignItems: 'center', gap: '5px', lineHeight: 1, whiteSpace: 'nowrap',
      }}>
        <span>{has ? `${label} (${selected.length})` : label}</span>
        {has && <span style={{ background: '#0078d4', color: '#fff', borderRadius: 10, fontSize: '0.6rem', padding: '0 5px', lineHeight: '1.5', fontWeight: 700 }}>{selected.length}</span>}
        <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>▼</span>
      </button>
      {open && rect && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed', top: rect.bottom + 3, left: rect.left,
            minWidth: Math.max(rect.width, 200), maxWidth: 280, zIndex: 10000,
            background: '#fff', border: '1px solid #d0d7de', borderRadius: 5,
            boxShadow: '0 6px 18px rgba(0,0,0,0.16)', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '7px 10px 5px', borderBottom: '1px solid #edebe9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: '0.73rem', color: '#323130' }}>{label}</span>
              {has && <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: '#0078d4', padding: 0 }} onClick={() => onChange([])}>Clear all</button>}
            </div>
            {options.length > 6 && (
              <div style={{ padding: '5px 8px', borderBottom: '1px solid #edebe9' }}>
                <input autoFocus style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #c8c6c4', borderRadius: 3, padding: '3px 7px', fontSize: '0.72rem', outline: 'none', color: '#323130' }}
                  placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
              </div>
            )}
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
              {filtered.map(opt => {
                const checked = selected.includes(opt.value);
                return (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 12px', cursor: 'pointer', background: 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f2f1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 14, height: 14, flexShrink: 0,
                      border: `1.5px solid ${checked ? '#0078d4' : '#8a8886'}`,
                      borderRadius: 2, background: checked ? '#0078d4' : '#fff',
                      marginRight: 8, fontSize: '0.6rem', color: '#fff', transition: 'all 0.1s',
                    }}>{checked ? '✓' : ''}</span>
                    <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: '#323130', userSelect: 'none', lineHeight: '1.4' }}>{opt.label}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#888', fontStyle: 'italic' }}>No matches</div>}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogModal({ tableName, title, onClose }) {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [userOpts, setUserOpts] = useState([]);
  const [nameLabel, setNameLabel] = useState(null);

  const [fUsers, setFUsers]   = useState([]);
  const [fYears, setFYears]   = useState([]);
  const [fMonths, setFMonths] = useState([]);
  const [fDays, setFDays]     = useState('');

  const PAGE_SIZE = 50;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ table: tableName, page, size: PAGE_SIZE });
      if (fUsers.length === 1) params.set('user', fUsers[0]);
      if (fYears.length) params.set('year', fYears.join(','));
      if (fMonths.length) params.set('month', fMonths.join(','));
      if (fDays) params.set('days', fDays);
      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(data.rows || []);
      setTotal(data.total || 0);
      if (data.users) setUserOpts(data.users);
      if (data.nameLabel) setNameLabel(data.nameLabel);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, fUsers, fYears, fMonths, fDays]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilter = fUsers.length > 0 || fYears.length > 0 || fMonths.length > 0 || fDays;
  const clearAll = () => { setFUsers([]); setFYears([]); setFMonths([]); setFDays(''); setPage(1); };

  const colCount = nameLabel ? 7 : 6;

  const exportExcel = async () => {
    try {
      const { exportStyledExcel } = await import('../utils/exportStyledExcel.js');
      const params = new URLSearchParams({ table: tableName, page: 1, size: 99999 });
      if (fUsers.length === 1) params.set('user', fUsers[0]);
      if (fYears.length) params.set('year', fYears.join(','));
      if (fMonths.length) params.set('month', fMonths.join(','));
      if (fDays) params.set('days', fDays);
      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();
      const cols = [
        { key: 'created_at', label: 'Date/Time' },
        { key: 'modified_by', label: 'User' },
        { key: 'record_id', label: 'Record ID' },
        ...(nameLabel ? [{ key: 'record_name', label: nameLabel }] : []),
        { key: 'modified_fields', label: 'Fields Changed' },
        { key: 'old_values', label: 'Old Values' },
        { key: 'new_values', label: 'New Values' },
      ];
      const exportRows = (data.rows || []).map(r => ({
        created_at: fmtDate(r.created_at),
        modified_by: r.modified_by,
        record_id: r.record_id,
        record_name: r.record_name || '',
        modified_fields: r.modified_fields,
        old_values: r.old_values,
        new_values: r.new_values,
      }));
      await exportStyledExcel({ columns: cols, rows: exportRows, sheetName: 'Change Log', fileName: `${title.replace(/\s+/g, '_')}_Change_Log.xlsx` });
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  return createPortal(
    <div style={s.overlay}>
      <div style={s.shell}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <button onClick={onClose} style={s.backBtn}>←</button>
            <span style={s.headerTitle}>Change Log — {title}</span>
          </div>
          <div style={s.headerRight}>
            <button disabled style={s.countChip}>{total} change{total !== 1 ? 's' : ''}</button>
            <button onClick={exportExcel} style={s.exportBtn}>Export Excel</button>
          </div>
        </div>

        {/* Filters */}
        <div style={s.filterBar}>
          <MultiFilter label="User" options={userOpts.map(u => ({ value: u, label: u }))} selected={fUsers} onChange={v => { setFUsers(v); setPage(1); }} />
          <MultiFilter label="Year" options={YEARS.map(y => ({ value: y, label: String(y) }))} selected={fYears} onChange={v => { setFYears(v); setPage(1); }} />
          <MultiFilter label="Month" options={MONTHS.map(m => ({ value: m.v, label: m.l }))} selected={fMonths} onChange={v => { setFMonths(v); setPage(1); }} />
          <button onClick={() => { setFDays(fDays === '7' ? '' : '7'); setPage(1); }} style={fDays === '7' ? s.quickActive : s.quickBtn}>Past 7 days</button>
          <button onClick={() => { setFDays(fDays === '30' ? '' : '30'); setPage(1); }} style={fDays === '30' ? s.quickActive : s.quickBtn}>Past 30 days</button>
          {hasFilter && <button onClick={clearAll} style={s.clearBtn}>Clear all</button>}
        </div>

        {/* Table */}
        <div style={s.tableWrap}>
          {loading && <div style={s.loadOverlay}>Loading...</div>}
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, minWidth: 120 }}>Date / Time</th>
                <th style={{ ...s.th, minWidth: 110 }}>User</th>
                <th style={{ ...s.th, minWidth: 50, textAlign: 'center' }}>ID</th>
                {nameLabel && <th style={{ ...s.th, minWidth: 140 }}>{nameLabel}</th>}
                <th style={{ ...s.th, minWidth: 160 }}>Fields Changed</th>
                <th style={s.th}>Previous Values</th>
                <th style={s.th}>New Values</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', padding: '40px 16px', color: '#8a8886', fontSize: '0.85rem', fontStyle: 'italic', borderBottom: 'none' }}>
                    No changes recorded{hasFilter ? ' for the selected filters' : ' yet'}.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#faf9f8' }}>
                  <td style={s.td}><span style={s.dateText}>{fmtDate(row.created_at)}</span></td>
                  <td style={s.td}>
                    <div style={s.userCell}>
                      <span style={s.userAvatar}>{(row.modified_by || '?')[0].toUpperCase()}</span>
                      <span>{row.modified_by}</span>
                    </div>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}><span style={s.idBadge}>{row.record_id}</span></td>
                  {nameLabel && <td style={{ ...s.td, fontWeight: 500 }}>{row.record_name || '—'}</td>}
                  <td style={s.td}>
                    <div style={s.fieldsCell}>
                      {(row.modified_fields || '').split(',').filter(Boolean).map((f, fi) => (
                        <span key={fi} style={s.fieldTag}>{f.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...s.td, ...s.valCol }}><div style={s.oldVal}>{row.old_values}</div></td>
                  <td style={{ ...s.td, ...s.valCol }}><div style={s.newVal}>{row.new_values}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <span style={s.footerCount}>
            {total > 0 ? `${Math.min((page - 1) * PAGE_SIZE + 1, total)} – ${Math.min(page * PAGE_SIZE, total)} of ${total}` : '0 records'}
          </span>
          <div style={s.pgRow}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={s.pgBtn}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={s.pgBtn}>‹</button>
            <span style={s.pgInfo}>Page&nbsp;&nbsp;{page}&nbsp;&nbsp;of&nbsp;&nbsp;{totalPages || 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={s.pgBtn}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={s.pgBtn}>»</button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

const s = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 },
  shell:       { background: '#fff', borderRadius: '2px', boxShadow: '0 12px 48px rgba(0,0,0,0.3)', width: '96vw', maxWidth: 1400, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },

  // Header
  header:      { background: '#0078d4', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, height: 48 },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  backBtn:     { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '2px', padding: '0 10px', cursor: 'pointer', fontSize: '0.9rem', width: 'auto', height: 28, display: 'flex', alignItems: 'center', lineHeight: 1 },
  headerTitle: { color: '#fff', fontWeight: 600, fontSize: '0.92rem' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  countChip:   { fontSize: '0.78rem', padding: '5px 14px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'default', fontFamily: 'inherit', lineHeight: 1 },
  exportBtn:   { fontSize: '0.78rem', padding: '5px 14px', borderRadius: '2px', background: '#107c10', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 },

  // Filters
  filterBar:   { padding: '8px 16px', borderBottom: '1px solid #edebe9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: '#faf9f8' },
  quickBtn:    { background: '#fff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, whiteSpace: 'nowrap' },
  quickActive: { background: '#e8f4fd', border: '1px solid #0078d4', color: '#0078d4', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' },
  clearBtn:    { background: 'none', border: 'none', color: '#a4262c', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 500, padding: '5px 4px', whiteSpace: 'nowrap' },

  // Table
  tableWrap:   { flex: 1, overflow: 'auto', minHeight: 0, position: 'relative' },
  loadOverlay: { position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0078d4', fontSize: '0.88rem', fontWeight: 500, zIndex: 2 },
  table:       { borderCollapse: 'collapse', width: '100%' },
  th:          { background: '#0078d4', color: '#fff', padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.02em', borderRight: '1px solid rgba(255,255,255,0.18)', borderBottom: '2px solid #005a9e', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td:          { padding: '5px 10px', borderBottom: '1px solid #edebe9', borderRight: '1px solid #f5f4f3', fontSize: '0.7rem', color: '#323130', verticalAlign: 'top' },
  valCol:      { maxWidth: 360 },

  // Cell styles
  dateText:    { fontSize: '0.7rem', color: '#605e5c', fontWeight: 500, whiteSpace: 'nowrap' },
  userCell:    { display: 'flex', alignItems: 'center', gap: 6 },
  userAvatar:  { width: 20, height: 20, borderRadius: '50%', background: '#0078d4', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700, flexShrink: 0 },
  idBadge:     { background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: '2px', padding: '1px 7px', fontSize: '0.68rem', color: '#605e5c', fontWeight: 500 },
  fieldsCell:  { display: 'flex', flexWrap: 'wrap', gap: 3 },
  fieldTag:    { background: '#e8f4fd', color: '#0078d4', borderRadius: 2, padding: '1px 6px', fontSize: '0.64rem', fontWeight: 500, whiteSpace: 'nowrap' },
  oldVal:      { color: '#a4262c', fontSize: '0.68rem', background: '#fef0f0', borderRadius: 2, padding: '4px 8px', border: '1px solid #fde7e9', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 60, overflow: 'auto', minWidth: 180 },
  newVal:      { color: '#107c10', fontSize: '0.68rem', background: '#f0faf0', borderRadius: 2, padding: '4px 8px', border: '1px solid #dff6dd', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 60, overflow: 'auto', minWidth: 180 },

  // Footer
  footer:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid #edebe9', flexShrink: 0, background: '#faf9f8' },
  footerCount: { fontSize: '0.75rem', color: '#605e5c' },
  pgRow:       { display: 'flex', alignItems: 'center', gap: 6 },
  pgBtn:       { background: '#fff', border: '1px solid #8a8886', color: '#0078d4', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem', lineHeight: 1 },
  pgInfo:      { color: '#605e5c', fontSize: '0.78rem', padding: '0 4px', whiteSpace: 'nowrap' },
};
