import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuditLogModal from '../components/AuditLogModal.jsx';

const CATEGORY_OPTS = [
  'Membership Fees',
  'Slaughter Techniques',
  'Support Services',
  'Contracts',
  'Audits',
  'Laboratory Sampling & Analysis',
  'Skills Development Facilitation (SDF)',
  'Industry Information',
  'Advertisements',
  'Annual Conference',
  'Learnerships (AgriSETA)',
  'Credit Bearing (AgriSETA)',
  'Non-Credit Bearing',
  'Workshops (per person per day)',
  'Certificates',
  'Traveling',
];

// Only allow digits, spaces, dots, and commas in price fields
function sanitisePrice(val) {
  return val.replace(/[^0-9 .,]/g, '');
}

function formatR(val) {
  if (!val || val === '0' || val === '0.00') return '';
  return `R ${val}`;
}

export default function FeeStructure() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [pending, setPending]     = useState({});
  const [originals, setOriginals] = useState({});
  const [saving, setSaving]       = useState({});
  const [saveErr, setSaveErr]     = useState({});
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [deleting, setDeleting]   = useState({});

  const [showAdd, setShowAdd]     = useState(false);
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState('');
  const [newEntry, setNewEntry]   = useState({ category: '', description: '', days: '', rmaa_members: '', non_members: '', sort_order: '' });

  const loadRows = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fee-structure?page=1&size=200&sortCol=sort_order&sortDir=asc');
      const data = await res.json();
      setRows(data.rows || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadRows(); }, []);

  const cellVal = (row, key) => pending[row.id]?.[key] ?? row[key] ?? '';

  const editCell = useCallback((rowId, key, value, originalRow) => {
    setPending(prev => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));
    setOriginals(prev => prev[rowId] ? prev : { ...prev, [rowId]: originalRow });
  }, []);

  const saveRow = async (row) => {
    const edits = pending[row.id] || {};
    const orig = originals[row.id] || row;
    const changedFields = Object.keys(edits).filter(k => edits[k] !== (orig[k] ?? ''));
    const oldVals = changedFields.map(k => `${k}: ${orig[k] ?? ''}`).join('; ');
    const newVals = changedFields.map(k => `${k}: ${edits[k]}`).join('; ');
    const merged = { ...row, ...edits, modified_by: user?.displayName || user?.username || 'Unknown', modified_time: new Date().toLocaleString('en-ZA'), modified_fields: changedFields.join(', '), old_values: oldVals, new_values: newVals };
    setSaving(prev => ({ ...prev, [row.id]: true }));
    setSaveErr(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    try {
      const res = await fetch(`/api/fee-structure/${row.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
      if (!res.ok) throw new Error((await res.json()).message);
      setRows(prev => prev.map(r => r.id === row.id ? merged : r));
      setPending(prev => { const n = { ...prev }; delete n[row.id]; return n; });
      setOriginals(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    } catch (e) { setSaveErr(prev => ({ ...prev, [row.id]: e.message })); }
    setSaving(prev => { const n = { ...prev }; delete n[row.id]; return n; });
  };

  const revertRow = (rowId) => {
    setPending(prev => { const n = { ...prev }; delete n[rowId]; return n; });
    setOriginals(prev => { const n = { ...prev }; delete n[rowId]; return n; });
    setSaveErr(prev => { const n = { ...prev }; delete n[rowId]; return n; });
  };

  const deleteRow = async (rowId) => {
    if (!confirm('Delete this service?')) return;
    setDeleting(prev => ({ ...prev, [rowId]: true }));
    try {
      await fetch(`/api/fee-structure/${rowId}?user=${encodeURIComponent(user?.displayName || user?.username || '')}`, { method: 'DELETE' });
      setRows(prev => prev.filter(r => r.id !== rowId));
    } catch (e) { alert('Failed: ' + e.message); }
    setDeleting(prev => { const n = { ...prev }; delete n[rowId]; return n; });
  };

  const submitNew = async () => {
    if (!newEntry.category || !newEntry.description) { setAddError('Category and Description are required.'); return; }
    setAdding(true); setAddError('');
    try {
      const payload = { ...newEntry, sort_order: newEntry.sort_order || String(rows.length + 1), modified_by: user?.displayName || user?.username || 'Unknown', modified_time: new Date().toLocaleString('en-ZA') };
      const res = await fetch('/api/fee-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).message);
      setShowAdd(false);
      setNewEntry({ category: '', description: '', days: '', rmaa_members: '', non_members: '', sort_order: '' });
      loadRows();
    } catch (e) { setAddError(e.message); }
    setAdding(false);
  };

  const exportExcel = async () => {
    try {
      const { exportStyledExcel } = await import('../utils/exportStyledExcel.js');
      const cols = [
        { key: 'category', label: 'Category' },
        { key: 'description', label: 'Description' },
        { key: 'days', label: 'Days' },
        { key: 'rmaa_members', label: 'RMAA Members' },
        { key: 'non_members', label: 'Non-Members' },
      ];
      await exportStyledExcel({ columns: cols, rows, sheetName: 'Fee Structure', fileName: 'Fee_Structure.xlsx' });
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  const hasPending = (id) => pending[id] && Object.keys(pending[id]).length > 0;

  // Group rows by category
  const grouped = {};
  rows.forEach(r => {
    const cat = r.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/quotation-system')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}><span style={s.pageTitle}>Fee Structure</span></div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.content}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <span style={s.title}>SKILLS PROGRAMMES — Fee Structure</span>
          <div style={s.toolbarRight}>
            <button onClick={() => setShowAdd(true)} style={s.btnAdd}>+ Add Service</button>
            <button onClick={exportExcel} style={s.btnExport}>Export Excel</button>
            <button onClick={() => setShowAuditLog(true)} style={s.btnChangeLog}>Change Log</button>
            <button onClick={loadRows} style={s.btnRefresh}>Refresh</button>
          </div>
        </div>

        {/* Table */}
        <div style={s.tableWrap}>
          {loading && <div style={s.loadOverlay}>Loading…</div>}

          <table style={s.table}>
            {Object.entries(grouped).map(([category, catRows]) => (
              <tbody key={category}>
                {/* Category header row */}
                <tr>
                  <td colSpan={5} style={s.catHeader}>
                    <span style={s.catTitle}>{category}</span>
                  </td>
                </tr>
                {/* Column labels */}
                <tr>
                  <th style={s.colHead}></th>
                  <th style={{ ...s.colHead, width: 100, textAlign: 'center' }}>Duration</th>
                  <th style={{ ...s.colHead, width: 130, textAlign: 'right' }}>RMAA Members</th>
                  <th style={{ ...s.colHead, width: 130, textAlign: 'right' }}>Non-Members</th>
                  <th style={{ ...s.colHead, width: 80, textAlign: 'center' }}></th>
                </tr>
                {/* Data rows */}
                {catRows.map((row, ri) => {
                  const dirty = hasPending(row.id);
                  const isSaving = saving[row.id];
                  const err = saveErr[row.id];
                  return (
                    <tr key={row.id} style={{ background: dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={s.tdDesc}>
                        <input style={s.inputDesc} value={cellVal(row, 'description')}
                          onChange={e => editCell(row.id, 'description', e.target.value, row)} />
                      </td>
                      <td style={s.tdCenter}>
                        <input style={s.inputDays} value={cellVal(row, 'days')}
                          onChange={e => editCell(row.id, 'days', e.target.value, row)} />
                      </td>
                      <td style={s.tdRight}>
                        <input style={s.inputPrice} value={cellVal(row, 'rmaa_members')}
                          onChange={e => editCell(row.id, 'rmaa_members', sanitisePrice(e.target.value), row)}
                          inputMode="decimal" />
                      </td>
                      <td style={s.tdRight}>
                        <input style={s.inputPrice} value={cellVal(row, 'non_members')}
                          onChange={e => editCell(row.id, 'non_members', sanitisePrice(e.target.value), row)}
                          inputMode="decimal" />
                      </td>
                      <td style={s.tdAction}>
                        {dirty ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => saveRow(row)} style={s.btnSave} disabled={isSaving}>{isSaving ? '…' : 'Save'}</button>
                            <button onClick={() => revertRow(row.id)} style={s.btnRevertSmall} disabled={isSaving}>✕</button>
                            {err && <span style={{ color: '#a4262c', fontSize: '0.6rem' }} title={err}>⚠</span>}
                          </div>
                        ) : (
                          <button onClick={() => deleteRow(row.id)} style={s.btnDel} disabled={deleting[row.id]}
                            title="Delete service">{deleting[row.id] ? '…' : '✕'}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>

          {rows.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#605e5c', fontStyle: 'italic', fontSize: '0.85rem' }}>No services defined yet.</div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={s.modalOverlay} onClick={() => setShowAdd(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeaderBar}>
              <h2 style={s.modalTitle}>Add New Service</h2>
              <button onClick={() => setShowAdd(false)} style={s.modalClose}>✕</button>
            </div>
            {addError && <div style={s.errorMsg}>{addError}</div>}
            <div style={s.modalBody}>
              <div style={s.modalField}>
                <label style={s.modalLabel}>Category *</label>
                <select style={s.modalInput} value={newEntry.category} onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}>
                  <option value="">-- Select Category --</option>
                  {CATEGORY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={s.modalField}>
                <label style={s.modalLabel}>Description *</label>
                <input style={s.modalInput} value={newEntry.description} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} placeholder="Service name" />
              </div>
              <div style={s.modalRow}>
                <div style={s.modalField}>
                  <label style={s.modalLabel}>Duration</label>
                  <input style={s.modalInput} value={newEntry.days} onChange={e => setNewEntry(p => ({ ...p, days: e.target.value }))} placeholder="e.g. 2 Days" />
                </div>
                <div style={s.modalField}>
                  <label style={s.modalLabel}>Sort Order</label>
                  <input style={s.modalInput} type="number" value={newEntry.sort_order} onChange={e => setNewEntry(p => ({ ...p, sort_order: e.target.value }))} placeholder="Position" />
                </div>
              </div>
              <div style={s.modalRow}>
                <div style={s.modalField}>
                  <label style={s.modalLabel}>RMAA Members (R)</label>
                  <input style={s.modalInput} value={newEntry.rmaa_members}
                    onChange={e => setNewEntry(p => ({ ...p, rmaa_members: sanitisePrice(e.target.value) }))}
                    inputMode="decimal" placeholder="e.g. 3 100.00" />
                </div>
                <div style={s.modalField}>
                  <label style={s.modalLabel}>Non-Members (R)</label>
                  <input style={s.modalInput} value={newEntry.non_members}
                    onChange={e => setNewEntry(p => ({ ...p, non_members: sanitisePrice(e.target.value) }))}
                    inputMode="decimal" placeholder="e.g. 3 800.00" />
                </div>
              </div>
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setShowAdd(false)} style={s.btnCancel}>Cancel</button>
              <button onClick={submitNew} style={s.btnSaveModal} disabled={adding}>{adding ? 'Saving...' : 'Save Service'}</button>
            </div>
          </div>
        </div>
      )}

      <footer style={s.footer} />
      {showAuditLog && <AuditLogModal tableName="FeeStructure" title="Fee Structure" onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}

const BLUE = '#2e4b8a';

const s = {
  page:        { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#f3f4f6', overflow: 'hidden' },
  header:      { background: '#0078d4', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', position: 'sticky', top: 0, zIndex: 200 },
  topBarLeft:  { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' },
  backBtn:     { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '2px', padding: '0 10px', cursor: 'pointer', fontSize: '0.9rem', width: 'auto', height: '28px', display: 'flex', alignItems: 'center', lineHeight: 1 },
  waffle:      { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' },
  waffleIcon:  { color: '#ffffff', fontSize: '1.1rem', letterSpacing: '-1px' },
  siteLabel:   { color: '#ffffff', fontSize: '0.95rem', fontWeight: 600 },
  topBarCenter:{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' },
  pageTitle:   { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 400 },
  topBarRight: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px', justifyContent: 'flex-end' },
  userName:    { color: '#ffffff', fontSize: '0.85rem' },
  avatar:      { width: '32px', height: '32px', borderRadius: '50%', background: '#005a9e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.4)' },
  signOutBtn:  { background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#ffffff', padding: '4px 12px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', width: 'auto', margin: 0 },

  content:     { padding: '16px 24px', width: '100%', maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0, overflow: 'auto' },

  toolbar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  toolbarRight:{ display: 'flex', gap: '6px', alignItems: 'center' },
  title:       { fontSize: '0.95rem', fontWeight: 700, color: '#323130' },

  btnAdd:      { background: '#107c10', border: '1px solid #107c10', color: '#fff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnExport:   { background: '#0078d4', border: '1px solid #0078d4', color: '#fff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnChangeLog:{ background: '#008272', border: '1px solid #008272', color: '#fff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnRefresh:  { background: '#605e5c', border: '1px solid #605e5c', color: '#fff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },

  // Table
  tableWrap:   { background: '#fff', border: '1px solid #d0d5dd', borderRadius: '4px', overflow: 'auto', flex: 1, minHeight: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  loadOverlay: { padding: 40, textAlign: 'center', color: '#0078d4' },
  table:       { borderCollapse: 'collapse', width: '100%' },

  catHeader:   { background: BLUE, padding: '10px 14px', color: '#fff', fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.02em', borderBottom: `2px solid #1a3570` },
  catTitle:    { fontWeight: 700 },

  colHead:     { background: '#e8ecf4', padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #d0d5dd', textAlign: 'left' },

  tdDesc:      { padding: '4px 6px', borderBottom: '1px solid #edebe9' },
  tdCenter:    { padding: '4px 6px', borderBottom: '1px solid #edebe9', width: 100, textAlign: 'center' },
  tdRight:     { padding: '4px 6px', borderBottom: '1px solid #edebe9', width: 130, textAlign: 'right' },
  tdAction:    { padding: '4px 6px', borderBottom: '1px solid #edebe9', width: 80, textAlign: 'center' },

  inputDesc:   { background: 'transparent', border: '1px solid transparent', fontSize: '0.82rem', fontFamily: 'inherit', width: '100%', padding: '5px 8px', outline: 'none', color: '#323130', borderRadius: '2px', transition: 'border-color 0.15s' },
  inputDays:   { background: 'transparent', border: '1px solid transparent', fontSize: '0.82rem', fontFamily: 'inherit', width: '100%', padding: '5px 8px', outline: 'none', color: '#605e5c', borderRadius: '2px', textAlign: 'center', transition: 'border-color 0.15s' },
  inputPrice:  { background: 'transparent', border: '1px solid transparent', fontSize: '0.82rem', fontFamily: "'Consolas', 'Courier New', monospace", width: '100%', padding: '5px 8px', outline: 'none', color: '#323130', borderRadius: '2px', textAlign: 'right', fontWeight: 600, transition: 'border-color 0.15s' },

  btnSave:     { background: '#107c10', border: 'none', color: '#fff', borderRadius: '2px', padding: '3px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem', width: 'auto' },
  btnRevertSmall: { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '3px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem', width: 'auto' },
  btnDel:      { background: 'transparent', border: '1px solid transparent', color: '#c8c6c4', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem', width: 'auto', transition: 'color 0.15s' },

  // Modal
  errorMsg:    { color: '#a4262c', fontSize: '0.82rem', background: '#fde7e9', border: '1px solid #f1707b', borderRadius: '2px', padding: '8px 14px', margin: '0 24px' },
  modalOverlay:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:    { background: '#fff', border: '1px solid #edebe9', borderRadius: '6px', width: '90%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  modalHeaderBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #edebe9', background: '#faf9f8' },
  modalTitle:  { color: '#323130', fontSize: '1.05rem', fontWeight: 600, margin: 0 },
  modalClose:  { background: 'none', border: 'none', color: '#605e5c', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px', width: 'auto' },
  modalBody:   { padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' },
  modalField:  { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  modalRow:    { display: 'flex', gap: '14px' },
  modalLabel:  { color: '#323130', fontSize: '0.75rem', fontWeight: 600 },
  modalInput:  { background: '#fff', border: '1px solid #c8c6c4', borderRadius: '3px', color: '#323130', padding: '8px 10px', fontSize: '0.82rem', outline: 'none', width: '100%', margin: 0, boxSizing: 'border-box', transition: 'border-color 0.15s' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid #edebe9', background: '#faf9f8' },
  btnCancel:   { background: '#fff', border: '1px solid #8a8886', color: '#323130', borderRadius: '3px', padding: '8px 20px', cursor: 'pointer', fontSize: '0.85rem', width: 'auto' },
  btnSaveModal:{ background: '#0078d4', border: 'none', color: '#fff', borderRadius: '3px', padding: '8px 24px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', width: 'auto' },

  footer:      { background: '#0078d4', height: '40px', marginTop: 'auto', flexShrink: 0 },
};

// Add hover effects via a style tag
const styleTag = document.createElement('style');
styleTag.textContent = `
  .fee-input:hover, .fee-input:focus { border-color: #0078d4 !important; background: #fafcff !important; }
  .fee-del:hover { color: #a4262c !important; border-color: #a4262c !important; }
`;
if (!document.getElementById('fee-styles')) { styleTag.id = 'fee-styles'; document.head.appendChild(styleTag); }
