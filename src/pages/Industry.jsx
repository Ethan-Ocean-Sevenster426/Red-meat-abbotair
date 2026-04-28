import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import ColFilterDropdown from '../components/ColFilterDropdown.jsx';
import ColVisibilityPanel from '../components/ColVisibilityPanel.jsx';
import AuditLogModal from '../components/AuditLogModal.jsx';

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'id', label: 'ID', w: 50, readonly: true },
  { key: 'company', label: 'Company', w: 200 },
  { key: 'number', label: 'Number', w: 120 },
  { key: 'number_1', label: 'Number 1', w: 120 },
  { key: 'fax', label: 'Fax', w: 120 },
  { key: 'vat_number', label: 'VAT Number', w: 130 },
  { key: 'postal_address', label: 'Postal Address', w: 200 },
  { key: 'physical_address', label: 'Physical Address', w: 200 },
  { key: 'contact_1', label: 'Contact 1', w: 150 },
  { key: 'position_1', label: 'Position', w: 150 },
  { key: 'email_1', label: 'Email', w: 180 },
  { key: 'cell_1', label: 'Cell', w: 120 },
  { key: 'contact_2', label: 'Contact 2', w: 150 },
  { key: 'position_2', label: 'Position 2', w: 150 },
  { key: 'email_2', label: 'Email 2', w: 180 },
  { key: 'cell_2', label: 'Cell 2', w: 120 },
  { key: 'contact_3', label: 'Contact 3', w: 150 },
  { key: 'position_3', label: 'Position 3', w: 150 },
  { key: 'email_3', label: 'Email 3', w: 180 },
  { key: 'cell_3', label: 'Cell 3', w: 120 },
  { key: 'contact_4', label: 'Contact 4', w: 150 },
  { key: 'position_4', label: 'Position 4', w: 150 },
  { key: 'email_4', label: 'Email 4', w: 180 },
  { key: 'cell_4', label: 'Cell 4', w: 120 },
  { key: 'diary_2022', label: 'Diary 2022', w: 100 },
  { key: 'calendar_2023', label: 'Calendar 2023', w: 110 },
  { key: 'modified_by', label: 'Modified By', w: 130, readonly: true },
  { key: 'modified_time', label: 'Modified Time', w: 140, readonly: true },
  { key: 'modified_fields', label: 'Modified Fields', w: 180, readonly: true },
  { key: 'old_values', label: 'Old Values', w: 180, readonly: true },
  { key: 'new_values', label: 'New Values', w: 180, readonly: true },
];

const WRAP_COLS = new Set(['modified_fields', 'old_values', 'new_values']);

const PAGE_SIZE = 50;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Industry() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [colFilters, setColFilters] = useState({});
  const [pending, setPending]     = useState({});
  const [originals, setOriginals] = useState({});
  const [saving, setSaving]       = useState({});
  const [saveErr, setSaveErr]     = useState({});
  const [dbCount, setDbCount]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const filterTimer = useRef(null);
  const [appliedFilters, setAppliedFilters] = useState({});
  const sortColRef = useRef('');
  const sortDirRef = useRef('asc');
  const [sortCol, setSortCol]         = useState('');
  const [sortDir, setSortDir]         = useState('asc');
  const [hiddenCols, setHiddenCols]   = useState(new Set());
  const [colOrder, setColOrder]       = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // ── Load rows ──
  const loadRows = useCallback(async (pg, filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, size: PAGE_SIZE });
      if (sortColRef.current) { params.set('sortCol', sortColRef.current); params.set('sortDir', sortDirRef.current); }
      for (const [k, v] of Object.entries(filters)) { if (v) params.set(k, v); }
      const res  = await fetch(`/api/industry?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRows(page, appliedFilters); }, [page, appliedFilters, sortCol, sortDir]);

  useEffect(() => {
    fetch('/api/industry/count').then(r => r.json()).then(d => setDbCount(d.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user-prefs?page=Industry&userId=${user.id}`)
      .then(r => r.json()).then(d => { setHiddenCols(new Set(d.hiddenColumns || [])); if (d.columnOrder?.length) setColOrder(d.columnOrder); }).catch(() => {});
  }, [user?.id]);

  const handleSort = (key) => {
    const newDir = sortColRef.current === key && sortDirRef.current === 'asc' ? 'desc' : 'asc';
    sortColRef.current = key; sortDirRef.current = newDir;
    setSortCol(key); setSortDir(newDir); setPage(1);
  };

  const savePrefs = (hidden, order) => {
    if (user?.id) fetch(`/api/user-prefs?page=Industry&userId=${user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hiddenColumns: [...hidden], columnOrder: order }) }).catch(() => {});
  };

  const toggleCol = (key) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      savePrefs(next, colOrder);
      return next;
    });
  };

  const reorderCols = (orderedKeys) => {
    setColOrder(orderedKeys);
    savePrefs(hiddenCols, orderedKeys);
  };

  const orderedColumns = colOrder.length > 0
    ? [...colOrder.map(k => COLUMNS.find(c => c.key === k)).filter(Boolean), ...COLUMNS.filter(c => !colOrder.includes(c.key))]
    : COLUMNS;

  // ── Column filter change (debounced) ──
  const handleColFilter = (key, val) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
    clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, [key]: val }));
      setPage(1);
    }, 400);
  };

  const cellVal = (row, key) => pending[row.id]?.[key] ?? row[key] ?? '';

  const editCell = useCallback((rowId, key, value, originalRow) => {
    setPending(prev => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));
    setOriginals(prev => prev[rowId] ? prev : { ...prev, [rowId]: originalRow });
  }, []);

  // ── Save row ──
  const saveRow = async (row) => {
    const edits = pending[row.id] || {};
    const orig  = originals[row.id] || row;
    const changedFields = Object.keys(edits).filter(k => edits[k] !== (orig[k] ?? ''));
    const oldVals = changedFields.map(k => `${k}: ${orig[k] ?? ''}`).join('; ');
    const newVals = changedFields.map(k => `${k}: ${edits[k]}`).join('; ');

    const merged = {
      ...row, ...edits,
      modified_by:     user?.displayName || user?.username || 'Unknown',
      modified_time:   new Date().toLocaleString('en-ZA'),
      modified_fields: changedFields.join(', '),
      old_values:      oldVals,
      new_values:      newVals,
    };

    setSaving(prev => ({ ...prev, [row.id]: true }));
    setSaveErr(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    try {
      const res = await fetch(`/api/industry/${row.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.map(r => r.id === row.id ? merged : r));
      setPending(prev  => { const n = { ...prev };  delete n[row.id]; return n; });
      setOriginals(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    } catch (e) {
      setSaveErr(prev => ({ ...prev, [row.id]: e.message }));
    }
    setSaving(prev => { const n = { ...prev }; delete n[row.id]; return n; });
  };

  const revertRow = (rowId) => {
    setPending(prev  => { const n = { ...prev };  delete n[rowId]; return n; });
    setOriginals(prev => { const n = { ...prev }; delete n[rowId]; return n; });
    setSaveErr(prev  => { const n = { ...prev };  delete n[rowId]; return n; });
  };

  // ── Export Excel ──
  const exportExcel = async () => {
    try {
      const { exportStyledExcel } = await import('../utils/exportStyledExcel.js');
      const params = new URLSearchParams({ page: 1, size: 99999 });
      for (const [k, v] of Object.entries(appliedFilters)) { if (v) params.set(k, v); }
      const res = await fetch(`/api/industry?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await exportStyledExcel({
        columns: orderedColumns,
        rows: data.rows,
        sheetName: 'Industry',
        fileName: 'Industry.xlsx',
      });
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  // ── Add new row (modal) ──
  const [adding, setAdding]       = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry]   = useState({});
  const [addError, setAddError]   = useState('');

  const openAddModal = () => {
    const blank = {};
    for (const col of COLUMNS) if (!col.readonly) blank[col.key] = '';
    setNewEntry(blank);
    setAddError('');
    setShowAddModal(true);
  };

  const submitNewEntry = async () => {
    if (!newEntry.company?.trim()) {
      setAddError('Company is required.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const payload = { ...newEntry };
      payload.modified_by = user?.displayName || user?.username || 'Unknown';
      payload.modified_time = new Date().toLocaleString('en-ZA');
      const res = await fetch('/api/industry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowAddModal(false);
      setDbCount(prev => (prev || 0) + 1);
      loadRows(page, appliedFilters);
    } catch (e) {
      setAddError('Failed to add: ' + e.message);
    }
    setAdding(false);
  };

  // ── History ──
  const [historyRow, setHistoryRow]   = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (row) => {
    setHistoryRow(row);
    setHistoryData([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/industry/${row.id}/history`);
      const data = await res.json();
      setHistoryData(data.entries || []);
    } catch { /* show empty */ }
    setHistoryLoading(false);
  };

  // ── Delete row ──
  const [deleting, setDeleting] = useState({});
  const deleteRow = async (rowId) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    setDeleting(prev => ({ ...prev, [rowId]: true }));
    try {
      const res = await fetch(`/api/industry/${rowId}?user=${encodeURIComponent(user?.displayName || user?.username || '')}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.filter(r => r.id !== rowId));
      setTotal(prev => prev - 1);
      setDbCount(prev => (prev || 1) - 1);
      setPending(prev  => { const n = { ...prev };  delete n[rowId]; return n; });
      setOriginals(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      setSaveErr(prev  => { const n = { ...prev };  delete n[rowId]; return n; });
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
    setDeleting(prev => { const n = { ...prev }; delete n[rowId]; return n; });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPending = (id) => pending[id] && Object.keys(pending[id]).length > 0;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/master-database')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>Industry</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar} title={user?.displayName || user?.username}>
            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
          </div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.content}>
        <div style={s.toolbar}>
          <div style={s.toolbarLeft}>
            <span style={s.metaChip}>{total} records</span>
            {Object.values(colFilters).some(Boolean) && (
              <button onClick={() => { setColFilters({}); setAppliedFilters({}); setPage(1); }} style={s.btnClearFilters}>
                Clear Filters
              </button>
            )}
          </div>
          <div style={s.toolbarRight}>
            <button onClick={exportExcel} style={s.btnExport}>Export Excel</button>
            <button onClick={openAddModal} style={s.btnAdd}>+ Add New Entry</button>
            <button onClick={() => setShowAuditLog(true)} style={s.btnRefresh}>Change Log</button>
            <button onClick={() => loadRows(page, appliedFilters)} style={s.btnRefresh}>Refresh</button>
            <ColVisibilityPanel columns={COLUMNS} hiddenCols={hiddenCols} onToggle={toggleCol} columnOrder={colOrder} onReorder={reorderCols} />
          </div>
        </div>

        <div style={s.tableWrap}>
          {loading && <div style={s.loadOverlay}>Loading…</div>}
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.stickyAct, background: '#0078d4', zIndex: 6 }}>
                  <div style={s.thLabel}>Actions</div>
                </th>
                {orderedColumns.map(col => {
                  if (hiddenCols.has(col.key)) return null;
                  const hasFilter = !!(colFilters[col.key] || '').trim();
                  const isSorted  = sortCol === col.key;
                  const isStickyName = col.key === 'company';
                  return (
                    <th key={col.key} style={{
                      ...s.th,
                      minWidth: col.w, maxWidth: col.w,
                      background: hasFilter ? '#106ebe' : '#0078d4',
                      ...(isStickyName ? { left: 130, zIndex: 5, borderRight: '2px solid #005a9e' } : {}),
                    }}>
                      <div style={{ ...s.thLabel, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col.key)}>
                        {col.label}{isSorted && <span style={{ marginLeft: 3, fontSize: '0.55rem', opacity: 0.85 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                      <ColFilterDropdown
                        col={col}
                        value={colFilters[col.key] || ''}
                        onChange={val => handleColFilter(col.key, val)}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ ...s.td, textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  {dbCount === 0 ? 'No data yet — click "+ Add New Entry" to get started.' : 'No rows match the current filters.'}
                </td></tr>
              )}
              {rows.map((row, ri) => {
                const dirty = hasPending(row.id);
                const isSaving = saving[row.id];
                const err = saveErr[row.id];
                return (
                  <tr key={row.id} style={{ background: dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1' }}>
                    <td style={{ ...s.td, ...s.stickyAct, background: dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1', textAlign: 'center', padding: '2px 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dirty ? (
                          <>
                            <button onClick={() => saveRow(row)} style={s.btnSave} disabled={isSaving}>{isSaving ? '…' : '✔ Save'}</button>
                            <button onClick={() => revertRow(row.id)} style={s.btnRevert} disabled={isSaving}>✕ Revert</button>
                            {err && <div style={{ color: '#a4262c', fontSize: '0.6rem', marginTop: 1 }} title={err}>⚠ Error</div>}
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => deleteRow(row.id)} style={s.btnDelete} disabled={deleting[row.id]}>
                              {deleting[row.id] ? '…' : 'Delete'}
                            </button>
                            <button onClick={() => openHistory(row)} style={s.btnHistory}>History</button>
                          </div>
                        )}
                      </div>
                    </td>
                    {orderedColumns.map(col => {
                      if (hiddenCols.has(col.key)) return null;
                      const val = cellVal(row, col.key);
                      const isStickyName = col.key === 'company';
                      const rowBg = dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1';
                      const stickyStyle = isStickyName ? { position: 'sticky', left: 130, zIndex: 3, background: rowBg, borderRight: '2px solid #edebe9' } : {};
                      if (col.readonly) {
                        const wrap = WRAP_COLS.has(col.key);
                        return (
                          <td key={col.key} title={val} style={{
                            ...s.td, minWidth: wrap ? 280 : col.w, maxWidth: wrap ? 360 : col.w,
                            color: '#605e5c', fontStyle: 'italic',
                            ...(wrap ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'visible' } : {}),
                            ...stickyStyle,
                          }}>
                            <span style={s.roCell}>{val}</span>
                          </td>
                        );
                      }
                      if (col.opts) {
                        return (
                          <td key={col.key} title={val} style={{ ...s.td, minWidth: col.w, maxWidth: col.w, ...stickyStyle }}>
                            <select style={s.cellSelect} value={val} onChange={e => editCell(row.id, col.key, e.target.value, row)}>
                              {col.opts.map(o => <option key={o} value={o}>{o || ''}</option>)}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} title={val} style={{ ...s.td, minWidth: col.w, maxWidth: col.w, ...stickyStyle }}>
                          <input className="cell-input" style={s.cellInput} value={val} onChange={e => editCell(row.id, col.key, e.target.value, row)} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ ...s.pagination, marginTop: 8 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={s.pgBtn}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={s.pgBtn}>‹</button>
          <span style={s.pgInfo}>Page {page} of {totalPages || 1} — {total} total records</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={s.pgBtn}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={s.pgBtn}>»</button>
        </div>
      </div>

      {/* ── Add New Entry Modal ── */}
      {showAddModal && (
        <div style={s.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Add New Industry Entry</h2>
              <button onClick={() => setShowAddModal(false)} style={s.modalClose}>✕</button>
            </div>
            {addError && <div style={s.errorMsg}>{addError}</div>}
            <div style={s.modalBody}>
              {COLUMNS.filter(c => !c.readonly).map(col => (
                <div key={col.key} style={s.modalField}>
                  <label style={s.modalLabel}>{col.label}</label>
                  {col.opts ? (
                    <select style={s.modalInput} value={newEntry[col.key] || ''} onChange={e => setNewEntry(prev => ({ ...prev, [col.key]: e.target.value }))}>
                      {col.opts.map(o => <option key={o} value={o}>{o || '-- Select --'}</option>)}
                    </select>
                  ) : (
                    <input style={s.modalInput} value={newEntry[col.key] || ''} onChange={e => setNewEntry(prev => ({ ...prev, [col.key]: e.target.value }))} placeholder={col.label} />
                  )}
                </div>
              ))}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setShowAddModal(false)} style={s.btnRevert}>Cancel</button>
              <button onClick={submitNewEntry} style={s.btnSaveModal} disabled={adding}>
                {adding ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer style={s.footer} />

      {/* ── History Modal ── */}
      {historyRow && (
        <div style={s.modalOverlay} onClick={() => setHistoryRow(null)}>
          <div style={{ ...s.modalBox, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Change History</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#605e5c' }}>
                  Full audit trail for this record — all users, all changes
                </p>
              </div>
              <button onClick={() => setHistoryRow(null)} style={s.modalClose}>✕</button>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {historyLoading ? (
                <p style={{ color: '#605e5c', fontSize: '0.85rem' }}>Loading history…</p>
              ) : historyData.length === 0 ? (
                <p style={{ color: '#605e5c', fontSize: '0.85rem' }}>No change history recorded for this record.</p>
              ) : (
                historyData.map((entry, ei) => {
                  const fields   = entry.modified_fields?.split(', ').filter(Boolean) || [];
                  const oldParts = entry.old_values?.split('; ') || [];
                  const newParts = entry.new_values?.split('; ') || [];
                  const colLabel = (key) => COLUMNS.find(c => c.key === key)?.label || key;
                  const changes  = fields.map((f, i) => ({
                    label: colLabel(f),
                    old: (oldParts[i] || '').replace(`${f}: `, ''),
                    new: (newParts[i] || '').replace(`${f}: `, ''),
                  }));
                  return (
                    <div key={ei} style={{ marginBottom: '20px', border: '1px solid #edebe9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ background: '#f3f2f1', padding: '7px 12px', borderBottom: '1px solid #edebe9', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#0078d4', fontSize: '0.8rem' }}>👤 {entry.modified_by || 'Unknown'}</span>
                        <span style={{ color: '#605e5c', fontSize: '0.78rem' }}>🕒 {entry.modified_time || entry.created_at}</span>
                      </div>
                      {changes.length === 0 ? (
                        <p style={{ padding: '8px 12px', color: '#605e5c', fontSize: '0.8rem', margin: 0 }}>No field details recorded.</p>
                      ) : (
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              {['Field', 'Old Value', 'New Value'].map(h => (
                                <th key={h} style={{ background: '#0078d4', color: '#fff', padding: '5px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map((c, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                                <td style={{ padding: '4px 10px', borderBottom: '1px solid #edebe9', fontWeight: 600, color: '#323130' }}>{c.label}</td>
                                <td style={{ padding: '4px 10px', borderBottom: '1px solid #edebe9', color: '#a4262c' }}>{c.old || '—'}</td>
                                <td style={{ padding: '4px 10px', borderBottom: '1px solid #edebe9', color: '#107c10' }}>{c.new || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setHistoryRow(null)} style={s.btnSaveModal}>Close</button>
            </div>
          </div>
        </div>
      )}
      {showAuditLog && <AuditLogModal tableName="IndustryMaster" title="Industry" onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page:       { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#ffffff', overflow: 'hidden' },
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
  content:    { padding: '10px 16px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' },
  toolbar:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  toolbarLeft:{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  toolbarRight:{ display: 'flex', gap: '8px', alignItems: 'center' },
  metaChip:   { fontSize: '0.75rem', padding: '3px 10px', borderRadius: '2px', background: '#f3f2f1', border: '1px solid #edebe9', color: '#323130' },
  btnRefresh: { background: '#ffffff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnExport:  { background: '#0078d4', border: '1px solid #0078d4', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  errorMsg:   { color: '#a4262c', fontSize: '0.85rem', background: '#fde7e9', border: '1px solid #f1707b', borderRadius: '2px', padding: '9px 14px' },
  pagination: { display: 'flex', alignItems: 'center', gap: '6px' },
  pgBtn:      { background: '#ffffff', border: '1px solid #8a8886', color: '#0078d4', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', width: 'auto' },
  pgInfo:     { color: '#605e5c', fontSize: '0.82rem', padding: '0 6px' },
  tableWrap:  { overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, borderRadius: '2px', border: '1px solid #edebe9', position: 'relative' },
  loadOverlay:{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0078d4', fontSize: '0.9rem', zIndex: 10, borderRadius: '2px' },
  table:      { borderCollapse: 'collapse', fontSize: '0.65rem', width: 'max-content', minWidth: '100%' },
  th:         { background: '#0078d4', color: '#ffffff', padding: '6px 8px', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '2px solid #005a9e', position: 'sticky', top: 0, zIndex: 3 },
  td:         { padding: '1px 5px', color: '#323130', whiteSpace: 'nowrap', borderRight: '1px solid #edebe9', borderBottom: '1px solid #edebe9', overflow: 'hidden', textOverflow: 'ellipsis' },
  stickyAct:  { position: 'sticky', left: 0, zIndex: 4, minWidth: '130px', maxWidth: '130px', background: '#ffffff', borderRight: '2px solid #edebe9' },
  cellInput:  { background: 'transparent', border: 'none', fontSize: '0.63rem', fontFamily: 'inherit', width: '100%', padding: '1px 2px', outline: 'none', color: '#323130', borderRadius: '2px' },
  cellSelect: { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '2px', color: '#323130', fontSize: '0.63rem', padding: '1px 2px', width: '100%', cursor: 'pointer' },
  roCell:     { fontSize: '0.63rem', color: '#605e5c', whiteSpace: 'inherit' },
  thLabel:    { fontSize: '0.65rem', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' },
  thSearch:   { background: '#ffffff', border: '1px solid #d0d0d0', borderRadius: '2px', color: '#323130', fontSize: '0.63rem', padding: '2px 4px', width: '100%', outline: 'none', boxSizing: 'border-box' },
  btnClearFilters:{ background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnSave:    { background: '#107c10', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnRevert:  { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnDelete:  { background: 'transparent', border: '1px solid #c8c6c4', color: '#a4262c', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', whiteSpace: 'nowrap' },
  btnHistory: { background: 'transparent', border: '1px solid #c8c6c4', color: '#0078d4', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', whiteSpace: 'nowrap' },
  btnAdd:     { background: '#107c10', border: '1px solid #107c10', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnSaveModal:{ background: '#0078d4', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '8px 24px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  modalOverlay:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:    { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '4px', width: '90%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #edebe9' },
  modalTitle:  { color: '#323130', fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  modalClose:  { background: 'none', border: 'none', color: '#605e5c', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px', width: 'auto' },
  modalBody:   { padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  modalField:  { display: 'flex', flexDirection: 'column', gap: '3px' },
  modalLabel:  { color: '#323130', fontSize: '0.75rem', fontWeight: 600, margin: 0 },
  modalInput:  { background: '#ffffff', border: '1px solid #8a8886', borderRadius: '2px', color: '#323130', padding: '7px 10px', fontSize: '0.82rem', outline: 'none', width: '100%', margin: 0 },
  footer:       { background: '#0078d4', height: '40px', marginTop: 'auto', flexShrink: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid #edebe9' },
};
