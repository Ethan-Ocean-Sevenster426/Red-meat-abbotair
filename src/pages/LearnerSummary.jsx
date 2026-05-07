import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import ColFilterDropdown from '../components/ColFilterDropdown.jsx';
import ColVisibilityPanel from '../components/ColVisibilityPanel.jsx';
import AuditLogModal from '../components/AuditLogModal.jsx';
import { deriveDobAge } from '../utils/saId.js';

const COLUMNS = [
  { key: 'id',             label: 'ID',              w: 50,  readonly: true },
  { key: 'surname',        label: 'Surname',         w: 140 },
  { key: 'name',           label: 'Name',            w: 130 },
  { key: 'id_number',      label: 'ID Number',       w: 150 },
  { key: 'year_of_birth',  label: 'Date Of Birth',   w: 110, readonly: true },
  { key: 'age',            label: 'Age',             w: 60,  readonly: true },
  { key: 'citizen',        label: 'Citizen',         w: 100 },
  { key: 'race_gender',    label: 'Race & Gender',   w: 120 },
  { key: 'work_stations',  label: 'Work Stations',   w: 280 },
  { key: 'modified_by',    label: 'Modified By',     w: 130, readonly: true },
  { key: 'modified_time',  label: 'Modified Time',   w: 140, readonly: true },
];

const WRAP_COLS = new Set(['work_stations']);
const MODAL_EXCLUDE = new Set(['year_of_birth', 'age', 'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values']);
const PAGE_SIZE = 50;

export default function LearnerSummary() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [colFilters, setColFilters] = useState({});
  const [pending, setPending]       = useState({});
  const [originals, setOriginals]   = useState({});
  const [saving, setSaving]         = useState({});
  const [saveErr, setSaveErr]       = useState({});
  const [loading, setLoading]       = useState(false);
  const [dbCount, setDbCount]       = useState(null);
  const filterTimer = useRef(null);
  const [appliedFilters, setAppliedFilters] = useState({});
  const sortColRef = useRef('');
  const sortDirRef = useRef('asc');
  const [sortCol, setSortCol]       = useState('');
  const [sortDir, setSortDir]       = useState('asc');
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [colOrder, setColOrder]     = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [idCheck, setIdCheck]       = useState('');
  const [deleting, setDeleting]     = useState({});
  const [selected, setSelected]     = useState(new Set());
  const [merging, setMerging]       = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const loadRows = useCallback(async (pg, filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, size: PAGE_SIZE });
      if (sortColRef.current) { params.set('sortCol', sortColRef.current); params.set('sortDir', sortDirRef.current); }
      for (const [k, v] of Object.entries(filters)) { if (v) params.set(k, v); }
      if (idCheck) params.set('_idCheck', idCheck);
      const res  = await fetch(`/api/learners?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [idCheck]);

  useEffect(() => { loadRows(page, appliedFilters); }, [page, appliedFilters, sortCol, sortDir, idCheck]);
  useEffect(() => { fetch('/api/learners/count').then(r => r.json()).then(d => setDbCount(d.count)).catch(() => {}); }, []);
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user-prefs?page=LearnerSummary&userId=${user.id}`)
      .then(r => r.json()).then(d => { setHiddenCols(new Set(d.hiddenColumns || [])); if (d.columnOrder?.length) setColOrder(d.columnOrder); }).catch(() => {});
  }, [user?.id]);

  const handleSort = (key) => {
    const newDir = sortColRef.current === key && sortDirRef.current === 'asc' ? 'desc' : 'asc';
    sortColRef.current = key; sortDirRef.current = newDir;
    setSortCol(key); setSortDir(newDir); setPage(1);
  };

  const savePrefs = (hidden, order) => {
    if (user?.id) fetch(`/api/user-prefs?page=LearnerSummary&userId=${user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hiddenColumns: [...hidden], columnOrder: order }) }).catch(() => {});
  };
  const toggleCol = (key) => { setHiddenCols(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); savePrefs(next, colOrder); return next; }); };
  const reorderCols = (orderedKeys) => { setColOrder(orderedKeys); savePrefs(hiddenCols, orderedKeys); };

  const orderedColumns = colOrder.length > 0
    ? [...colOrder.map(k => COLUMNS.find(c => c.key === k)).filter(Boolean), ...COLUMNS.filter(c => !colOrder.includes(c.key))]
    : COLUMNS;

  const handleColFilter = (key, val) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
    clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => { setAppliedFilters(prev => ({ ...prev, [key]: val })); setPage(1); }, 400);
  };

  const cellVal = (row, key) => {
    const pendingVal = pending[row.id]?.[key];
    if (pendingVal !== undefined) return pendingVal;
    const stored = row[key];
    if (stored) return stored;
    if (key === 'year_of_birth' || key === 'age') {
      const idNum = pending[row.id]?.id_number ?? row.id_number;
      const derived = deriveDobAge(idNum);
      if (derived) return derived[key];
    }
    return '';
  };
  const editCell = useCallback((rowId, key, value, originalRow) => {
    setPending(prev => {
      const updated = { ...prev[rowId], [key]: value };
      let dobAge = {};
      if (key === 'id_number') {
        const derived = deriveDobAge(value);
        if (derived) dobAge = derived;
      }
      return { ...prev, [rowId]: { ...updated, ...dobAge } };
    });
    setOriginals(prev => prev[rowId] ? prev : { ...prev, [rowId]: originalRow });
  }, []);

  const saveRow = async (row) => {
    const edits = pending[row.id] || {};
    const orig  = originals[row.id] || row;
    const changedFields = Object.keys(edits).filter(k => edits[k] !== (orig[k] ?? ''));
    const oldVals = changedFields.map(k => `${k}: ${orig[k] ?? ''}`).join('; ');
    const newVals = changedFields.map(k => `${k}: ${edits[k]}`).join('; ');
    const merged = { ...row, ...edits, modified_by: user?.displayName || user?.username || 'Unknown', modified_time: new Date().toLocaleString('en-ZA'), modified_fields: changedFields.join(', '), old_values: oldVals, new_values: newVals };
    setSaving(prev => ({ ...prev, [row.id]: true }));
    setSaveErr(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    try {
      const res = await fetch(`/api/learners/${row.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
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
    if (!confirm('Are you sure you want to delete this learner?')) return;
    setDeleting(prev => ({ ...prev, [rowId]: true }));
    try {
      const res = await fetch(`/api/learners/${rowId}?user=${encodeURIComponent(user?.displayName || user?.username || '')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).message);
      setRows(prev => prev.filter(r => r.id !== rowId));
      setTotal(prev => prev - 1);
      setSelected(prev => { const n = new Set(prev); n.delete(rowId); return n; });
    } catch (e) { alert('Failed to delete: ' + e.message); }
    setDeleting(prev => { const n = { ...prev }; delete n[rowId]; return n; });
  };

  // ── Merge ──
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 2) next.add(id);
      return next;
    });
  };

  const selectedArr = [...selected];
  const canMerge = selectedArr.length === 2;
  const mergeRowA = canMerge ? rows.find(r => r.id === selectedArr[0]) : null;
  const mergeRowB = canMerge ? rows.find(r => r.id === selectedArr[1]) : null;

  const handleMerge = async (primaryId) => {
    const secondaryId = primaryId === selectedArr[0] ? selectedArr[1] : selectedArr[0];
    setMerging(true);
    try {
      const res = await fetch('/api/learners/merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_id: primaryId, secondary_id: secondaryId, modified_by: user?.displayName || user?.username || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSelected(new Set());
      setShowMergeModal(false);
      loadRows(page, appliedFilters);
    } catch (e) { alert('Merge failed: ' + e.message); }
    setMerging(false);
  };

  // ── Add modal ──
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({});
  const [addError, setAddError] = useState('');

  const openAddModal = () => {
    const blank = {};
    for (const col of COLUMNS) { if (!col.readonly && !MODAL_EXCLUDE.has(col.key)) blank[col.key] = ''; }
    setNewEntry(blank); setAddError(''); setShowAddModal(true);
  };

  const submitNewEntry = async () => {
    setAdding(true); setAddError('');
    try {
      const dobAge = deriveDobAge(newEntry.id_number) || {};
      const payload = { ...newEntry, ...dobAge, modified_by: user?.displayName || user?.username || 'Unknown', modified_time: new Date().toLocaleString('en-ZA') };
      const res = await fetch('/api/learners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).message);
      setShowAddModal(false);
      loadRows(page, appliedFilters);
    } catch (e) { setAddError('Failed to add: ' + e.message); }
    setAdding(false);
  };

  // ── History ──
  const [historyRow, setHistoryRow] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (row) => {
    setHistoryRow(row); setHistoryData([]); setHistoryLoading(true);
    try { const res = await fetch(`/api/learners/${row.id}/history`); setHistoryData((await res.json()).entries || []); } catch {}
    setHistoryLoading(false);
  };

  // ── Export ──
  const exportExcel = async () => {
    try {
      const { exportStyledExcel } = await import('../utils/exportStyledExcel.js');
      const params = new URLSearchParams({ page: 1, size: 99999 });
      if (sortColRef.current) { params.set('sortCol', sortColRef.current); params.set('sortDir', sortDirRef.current); }
      for (const [k, v] of Object.entries(appliedFilters)) { if (v) params.set(k, v); }
      if (idCheck) params.set('_idCheck', idCheck);
      const res = await fetch(`/api/learners?${params}`);
      const data = await res.json();
      const visibleCols = orderedColumns.filter(c => !hiddenCols.has(c.key));
      await exportStyledExcel({ columns: visibleCols, rows: data.rows, sheetName: 'Learner Summary', fileName: 'Learner_Summary.xlsx' });
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPending = (id) => pending[id] && Object.keys(pending[id]).length > 0;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/training-report')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}><span style={s.pageTitle}>Learner Summary</span></div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.content}>
        <div style={s.toolbar}>
          <div style={s.toolbarLeft}>
            <span style={s.metaChip}>{total} learners</span>
            {selected.size > 0 && <span style={s.metaChip}>{selected.size} selected</span>}
            {Object.values(colFilters).some(Boolean) && (
              <button onClick={() => { setColFilters({}); setAppliedFilters({}); setPage(1); }} style={s.btnClearFilters}>Clear Filters</button>
            )}
          </div>
          <div style={s.toolbarRight}>
            <button onClick={openAddModal} style={s.btnAdd}>+ Add Learner</button>
            {canMerge && <button onClick={() => setShowMergeModal(true)} style={s.btnMerge}>Merge Selected</button>}
            <button onClick={() => { const modes = ['', 'duplicate', 'incorrect', 'missing']; setIdCheck(modes[(modes.indexOf(idCheck) + 1) % modes.length]); setPage(1); }}
              style={idCheck ? s.btnIdCheckActive : s.btnIdCheck}>
              {idCheck === 'duplicate' ? 'Duplicate IDs' : idCheck === 'incorrect' ? 'Incorrect IDs' : idCheck === 'missing' ? 'Missing IDs' : 'ID Check'}
            </button>
            <button onClick={exportExcel} style={s.btnExport}>Export Excel</button>
            <button onClick={() => setShowAuditLog(true)} style={s.btnChangeLog}>Change Log</button>
            <button onClick={() => loadRows(page, appliedFilters)} style={s.btnRefresh}>Refresh</button>
            <ColVisibilityPanel columns={COLUMNS} hiddenCols={hiddenCols} onToggle={toggleCol} columnOrder={colOrder} onReorder={reorderCols} />
          </div>
        </div>

        <div style={s.tableWrap}>
          {loading && <div style={s.loadOverlay}>Loading…</div>}
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: 30, minWidth: 30, maxWidth: 30, textAlign: 'center', background: '#0078d4', zIndex: 6 }}><div style={s.thLabel}></div></th>
                <th style={{ ...s.th, ...s.stickyAct, left: 30, background: '#0078d4', zIndex: 6 }}><div style={s.thLabel}>Actions</div></th>
                {orderedColumns.map(col => {
                  if (hiddenCols.has(col.key)) return null;
                  const hasFilter = !!(colFilters[col.key] || '').trim();
                  const isSorted  = sortCol === col.key;
                  return (
                    <th key={col.key} style={{ ...s.th, minWidth: col.w, maxWidth: col.w, background: hasFilter ? '#106ebe' : '#0078d4' }}>
                      <div style={{ ...s.thLabel, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col.key)}>
                        {col.label}{isSorted && <span style={{ marginLeft: 3, fontSize: '0.55rem', opacity: 0.85 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                      {!col.readonly && <ColFilterDropdown col={col} value={colFilters[col.key] || ''} onChange={val => handleColFilter(col.key, val)} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={COLUMNS.length + 2} style={{ ...s.td, textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  {dbCount === 0 ? 'No learner data yet.' : 'No learners match the current filters.'}
                </td></tr>
              )}
              {rows.map((row, ri) => {
                const dirty = hasPending(row.id);
                const isSaving = saving[row.id];
                const err = saveErr[row.id];
                const isSelected = selected.has(row.id);
                return (
                  <tr key={row.id} style={{ background: isSelected ? '#e8f0fe' : dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1' }}>
                    <td style={{ ...s.td, width: 30, minWidth: 30, maxWidth: 30, textAlign: 'center', padding: '2px', background: isSelected ? '#e8f0fe' : dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(row.id)}
                        style={{ width: 14, height: 14, cursor: 'pointer', margin: 0, accentColor: '#0078d4' }} title="Select for merge" />
                    </td>
                    <td style={{ ...s.td, ...s.stickyAct, left: 30, background: isSelected ? '#e8f0fe' : dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1', textAlign: 'center', padding: '2px 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dirty ? (
                          <>
                            <button onClick={() => saveRow(row)} style={s.btnSave} disabled={isSaving}>{isSaving ? '…' : '✔ Save'}</button>
                            <button onClick={() => revertRow(row.id)} style={s.btnRevert} disabled={isSaving}>✕ Revert</button>
                            {err && <div style={{ color: '#a4262c', fontSize: '0.6rem' }} title={err}>⚠</div>}
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => deleteRow(row.id)} style={s.btnDelete} disabled={deleting[row.id]}>{deleting[row.id] ? '…' : 'Delete'}</button>
                            <button onClick={() => openHistory(row)} style={s.btnHistory}>History</button>
                          </div>
                        )}
                      </div>
                    </td>
                    {orderedColumns.map(col => {
                      if (hiddenCols.has(col.key)) return null;
                      const val = cellVal(row, col.key);
                      const isWrap = WRAP_COLS.has(col.key);
                      if (col.readonly) return <td key={col.key} title={val} style={{ ...s.td, minWidth: col.w, maxWidth: col.w, color: '#a8b8cc', fontStyle: 'italic' }}><span style={s.roCell}>{val}</span></td>;
                      return (
                        <td key={col.key} title={val} style={{ ...s.td, minWidth: col.w, maxWidth: isWrap ? 400 : col.w, ...(isWrap ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : {}) }}>
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
          <span style={s.pgInfo}>Page {page} of {totalPages || 1} — {total} total learners</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={s.pgBtn}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={s.pgBtn}>»</button>
        </div>
      </div>

      {/* Merge Modal */}
      {showMergeModal && mergeRowA && mergeRowB && (
        <div style={s.modalOverlay} onClick={() => setShowMergeModal(false)}>
          <div style={{ ...s.modalBox, maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Merge Learners</h2>
              <button onClick={() => setShowMergeModal(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
              <p style={{ fontSize: '0.82rem', color: '#605e5c', margin: '0 0 16px' }}>
                Select which learner to keep as primary. Their work stations will be combined and the other record will be deleted.
              </p>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#0078d4', color: '#fff', padding: '7px 10px', textAlign: 'left', fontWeight: 600 }}>Field</th>
                    <th style={{ background: '#0078d4', color: '#fff', padding: '7px 10px', textAlign: 'left', fontWeight: 600 }}>Learner A (#{mergeRowA.id})</th>
                    <th style={{ background: '#0078d4', color: '#fff', padding: '7px 10px', textAlign: 'left', fontWeight: 600 }}>Learner B (#{mergeRowB.id})</th>
                  </tr>
                </thead>
                <tbody>
                  {['surname', 'name', 'id_number', 'year_of_birth', 'age', 'citizen', 'race_gender', 'work_stations'].map((k, i) => {
                    const label = COLUMNS.find(c => c.key === k)?.label || k;
                    const diff = (mergeRowA[k] || '') !== (mergeRowB[k] || '');
                    return (
                      <tr key={k} style={{ background: diff ? '#fff8e1' : i % 2 === 0 ? '#fff' : '#faf9f8' }}>
                        <td style={{ padding: '5px 10px', borderBottom: '1px solid #edebe9', fontWeight: 600, color: '#323130' }}>{label}</td>
                        <td style={{ padding: '5px 10px', borderBottom: '1px solid #edebe9', color: '#323130', ...(k === 'work_stations' ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 280 } : {}) }}>{mergeRowA[k] || '—'}</td>
                        <td style={{ padding: '5px 10px', borderBottom: '1px solid #edebe9', color: '#323130', ...(k === 'work_stations' ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 280 } : {}) }}>{mergeRowB[k] || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #edebe9', gap: 10 }}>
              <button onClick={() => setShowMergeModal(false)} style={s.btnRevert}>Cancel</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => handleMerge(mergeRowA.id)} disabled={merging} style={s.btnMergeConfirm}>
                  {merging ? '…' : `Keep A (#${mergeRowA.id})`}
                </button>
                <button onClick={() => handleMerge(mergeRowB.id)} disabled={merging} style={s.btnMergeConfirm}>
                  {merging ? '…' : `Keep B (#${mergeRowB.id})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div style={s.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Add New Learner</h2>
              <button onClick={() => setShowAddModal(false)} style={s.modalClose}>✕</button>
            </div>
            {addError && <div style={s.errorMsg}>{addError}</div>}
            <div style={s.modalBody}>
              {COLUMNS.filter(c => !c.readonly && !MODAL_EXCLUDE.has(c.key)).map(col => (
                <div key={col.key} style={s.modalField}>
                  <label style={s.modalLabel}>{col.label}</label>
                  <input style={s.modalInput} value={newEntry[col.key] || ''} onChange={e => {
                    const val = e.target.value;
                    setNewEntry(prev => {
                      const updated = { ...prev, [col.key]: val };
                      if (col.key === 'id_number') {
                        const derived = deriveDobAge(val);
                        if (derived) return { ...updated, ...derived };
                      }
                      return updated;
                    });
                  }} placeholder={col.label} />
                </div>
              ))}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setShowAddModal(false)} style={s.btnRevert}>Cancel</button>
              <button onClick={submitNewEntry} style={s.btnSaveModal} disabled={adding}>{adding ? 'Saving...' : 'Save Learner'}</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyRow && (
        <div style={s.modalOverlay} onClick={() => setHistoryRow(null)}>
          <div style={{ ...s.modalBox, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Change History</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#605e5c' }}>{historyRow.name} {historyRow.surname} — {historyRow.id_number || 'No ID'}</p>
              </div>
              <button onClick={() => setHistoryRow(null)} style={s.modalClose}>✕</button>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {historyLoading ? <p style={{ color: '#605e5c' }}>Loading…</p> : historyData.length === 0 ? <p style={{ color: '#605e5c' }}>No history.</p> : (
                historyData.map((entry, ei) => {
                  const fields = entry.modified_fields?.split(', ').filter(Boolean) || [];
                  const oldParts = entry.old_values?.split('; ') || [];
                  const newParts = entry.new_values?.split('; ') || [];
                  const colLabel = (key) => COLUMNS.find(c => c.key === key)?.label || key;
                  const changes = fields.map((f, i) => ({ label: colLabel(f), old: (oldParts[i] || '').replace(`${f}: `, ''), new: (newParts[i] || '').replace(`${f}: `, '') }));
                  return (
                    <div key={ei} style={{ marginBottom: 20, border: '1px solid #edebe9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ background: '#f3f2f1', padding: '7px 12px', borderBottom: '1px solid #edebe9', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#0078d4', fontSize: '0.8rem' }}>👤 {entry.modified_by || 'Unknown'}</span>
                        <span style={{ color: '#605e5c', fontSize: '0.78rem' }}>🕒 {entry.modified_time || entry.created_at}</span>
                        {entry.action_type && <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: entry.action_type === 'ADD' ? '#dff6dd' : entry.action_type === 'DELETE' ? '#fde7e9' : '#e8f4fd', color: entry.action_type === 'ADD' ? '#107c10' : entry.action_type === 'DELETE' ? '#a4262c' : '#0078d4' }}>{entry.action_type}</span>}
                      </div>
                      {changes.length === 0 ? <p style={{ padding: '8px 12px', color: '#605e5c', fontSize: '0.8rem', margin: 0 }}>No field details.</p> : (
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.78rem' }}>
                          <thead><tr>{['Field', 'Old Value', 'New Value'].map(h => <th key={h} style={{ background: '#0078d4', color: '#fff', padding: '5px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                          <tbody>{changes.map((c, i) => <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}><td style={{ padding: '4px 10px', borderBottom: '1px solid #edebe9', fontWeight: 600 }}>{c.label}</td><td style={{ padding: '4px 10px', borderBottom: '1px solid #edebe9', color: '#a4262c' }}>{c.old || '—'}</td><td style={{ padding: '4px 10px', borderBottom: '1px solid #edebe9', color: '#107c10' }}>{c.new || '—'}</td></tr>)}</tbody>
                        </table>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div style={s.modalFooter}><button onClick={() => setHistoryRow(null)} style={s.btnSaveModal}>Close</button></div>
          </div>
        </div>
      )}

      <footer style={s.footer} />
      {showAuditLog && <AuditLogModal tableName="Learners" title="Learner Summary" onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}

const s = {
  page:        { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#ffffff', overflow: 'hidden' },
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
  content:     { padding: '10px 16px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' },
  toolbar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' },
  toolbarLeft: { display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 },
  toolbarRight:{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap' },
  metaChip:    { fontSize: '0.75rem', padding: '3px 10px', borderRadius: '2px', background: '#f3f2f1', border: '1px solid #edebe9', color: '#323130' },
  btnAdd:      { background: '#107c10', border: '1px solid #107c10', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnMerge:    { background: '#ca5010', border: '1px solid #ca5010', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnIdCheck:  { background: '#986f0b', border: '1px solid #986f0b', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnIdCheckActive: { background: '#fff4ce', border: '1px solid #f7c948', color: '#8a6914', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, width: 'auto', lineHeight: 1 },
  btnExport:   { background: '#0078d4', border: '1px solid #0078d4', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnChangeLog:{ background: '#008272', border: '1px solid #008272', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnRefresh:  { background: '#605e5c', border: '1px solid #605e5c', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnClearFilters: { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  tableWrap:   { overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, borderRadius: '2px', border: '1px solid #edebe9', position: 'relative' },
  loadOverlay: { position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0078d4', fontSize: '0.9rem', zIndex: 10 },
  table:       { borderCollapse: 'collapse', fontSize: '0.72rem', width: 'max-content', minWidth: '100%' },
  th:          { background: '#0078d4', color: '#ffffff', padding: '6px 8px', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '2px solid #005a9e', position: 'sticky', top: 0, zIndex: 3 },
  td:          { padding: '1px 5px', color: '#323130', whiteSpace: 'nowrap', borderRight: '1px solid #edebe9', borderBottom: '1px solid #edebe9', overflow: 'hidden', textOverflow: 'ellipsis' },
  stickyAct:   { position: 'sticky', left: 0, zIndex: 4, minWidth: '130px', maxWidth: '130px', background: '#ffffff', borderRight: '2px solid #edebe9' },
  thLabel:     { fontSize: '0.68rem', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' },
  cellInput:   { background: 'transparent', border: 'none', fontSize: '0.63rem', fontFamily: 'inherit', width: '100%', padding: '1px 2px', outline: 'none', color: '#323130', borderRadius: '2px' },
  roCell:      { fontSize: '0.63rem', color: '#605e5c' },
  btnSave:     { background: '#107c10', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnRevert:   { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnDelete:   { background: 'transparent', border: '1px solid #c8c6c4', color: '#a4262c', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', whiteSpace: 'nowrap' },
  btnHistory:  { background: 'transparent', border: '1px solid #c8c6c4', color: '#0078d4', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', whiteSpace: 'nowrap' },
  btnMergeConfirm: { background: '#ca5010', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', width: 'auto' },
  pagination:  { display: 'flex', alignItems: 'center', gap: '6px' },
  pgBtn:       { background: '#ffffff', border: '1px solid #8a8886', color: '#0078d4', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', width: 'auto' },
  pgInfo:      { color: '#605e5c', fontSize: '0.82rem', padding: '0 6px' },
  errorMsg:    { color: '#a4262c', fontSize: '0.85rem', background: '#fde7e9', border: '1px solid #f1707b', borderRadius: '2px', padding: '9px 14px', margin: '0 24px' },
  modalOverlay:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:    { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '4px', width: '90%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #edebe9' },
  modalTitle:  { color: '#323130', fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  modalClose:  { background: 'none', border: 'none', color: '#605e5c', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px', width: 'auto' },
  modalBody:   { padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  modalField:  { display: 'flex', flexDirection: 'column', gap: '3px' },
  modalLabel:  { color: '#323130', fontSize: '0.75rem', fontWeight: 600, margin: 0 },
  modalInput:  { background: '#ffffff', border: '1px solid #8a8886', borderRadius: '2px', color: '#323130', padding: '7px 10px', fontSize: '0.82rem', outline: 'none', width: '100%', margin: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid #edebe9' },
  btnSaveModal:{ background: '#0078d4', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '8px 24px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  footer:      { background: '#0078d4', height: '40px', marginTop: 'auto', flexShrink: 0 },
};
