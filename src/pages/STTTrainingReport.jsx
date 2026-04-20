import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import ColFilterDropdown from '../components/ColFilterDropdown.jsx';
import ColVisibilityPanel from '../components/ColVisibilityPanel.jsx';
import AuditLogModal from '../components/AuditLogModal.jsx';

// ─── Column definitions ───────────────────────────────────────────────────────

const PROVINCE_OPTS  = ['','Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
const DISABILITY_OPTS = ['', 'Yes', 'No'];
const ONE_OPTS       = ['', '1'];

const COLUMNS = [
  { key: 'id',                  label: 'ID',                   w: 50,  readonly: true },
  { key: 'province',            label: 'Province',             w: 130, opts: PROVINCE_OPTS },
  { key: 'municipality',        label: 'Municipality',          w: 150 },
  { key: 'name',                label: 'Name',                  w: 120 },
  { key: 'surname',             label: 'Surname',               w: 120 },
  { key: 'id_number',           label: 'ID Number',             w: 140 },
  { key: 'year_of_birth',       label: 'Year Of Birth',         w: 100 },
  { key: 'age',                 label: 'Age',                   w: 60  },
  { key: 'citizen',             label: 'Citizen',               w: 100 },
  { key: 'race_gender',         label: 'Race & Gender',         w: 120 },
  { key: 'training_start_date', label: 'Start Date',            w: 110 },
  { key: 'training_end_date',   label: 'End Date',              w: 110 },
  { key: 'abattoir_name',       label: 'Abattoir Name',         w: 200 },
  { key: 'thru_put',            label: 'Thru-Put (L/H)',        w: 100 },
  { key: 'specie',              label: 'Specie',                w: 100 },
  { key: 'work_station',        label: 'Work Station',          w: 130 },
  { key: 'report_to_client',    label: 'Report To Client',      w: 130 },
  { key: 'reported_by',         label: 'Reported By',           w: 130 },
  { key: 'sample_take',         label: 'Sample Take',           w: 110 },
  { key: 'lab_report_received', label: 'Lab Report Received',   w: 150 },
  { key: 'am',                  label: 'AM',                    w: 50,  opts: ONE_OPTS },
  { key: 'af',                  label: 'AF',                    w: 50,  opts: ONE_OPTS },
  { key: 'ad',                  label: 'AD',                    w: 50,  opts: ONE_OPTS },
  { key: 'cm',                  label: 'CM',                    w: 50,  opts: ONE_OPTS },
  { key: 'cf',                  label: 'CF',                    w: 50,  opts: ONE_OPTS },
  { key: 'cd',                  label: 'CD',                    w: 50,  opts: ONE_OPTS },
  { key: 'im',                  label: 'IM',                    w: 50,  opts: ONE_OPTS },
  { key: 'if_',                 label: 'IF',                    w: 50,  opts: ONE_OPTS },
  { key: 'id_2',                label: 'ID',                    w: 50,  opts: ONE_OPTS },
  { key: 'wm',                  label: 'WM',                    w: 50,  opts: ONE_OPTS },
  { key: 'wf',                  label: 'WF',                    w: 50,  opts: ONE_OPTS },
  { key: 'wd',                  label: 'WD',                    w: 50,  opts: ONE_OPTS },
  { key: 'tot_m',               label: 'TOT M',                 w: 60,  readonly: true },
  { key: 'tot_f',               label: 'TOT F',                 w: 60,  readonly: true },
  { key: 'tot_d',               label: 'TOT D',                 w: 60,  readonly: true },
  { key: 'age_lt35',            label: '< 35',                  w: 55,  opts: ONE_OPTS },
  { key: 'age_35_55',           label: '35 > 55',               w: 65,  opts: ONE_OPTS },
  { key: 'age_gt55',            label: '55 >',                  w: 55,  opts: ONE_OPTS },
  { key: 'age_2',               label: 'Age 2',                 w: 80  },
  { key: 'total_race_gender',   label: 'Total Race & Gender',   w: 140, opts: ONE_OPTS },
  { key: 'total_male_female',   label: 'Total Male & Female',   w: 140, opts: ONE_OPTS },
  { key: 'total_per_age_group', label: 'Total Per Age Group',   w: 150, opts: ONE_OPTS },
  { key: 'disability',          label: 'Disability?',           w: 90,  opts: DISABILITY_OPTS },
  { key: 'modified_by',         label: 'Modified By',           w: 130, readonly: true },
  { key: 'modified_time',       label: 'Modified Time',         w: 140, readonly: true },
  { key: 'modified_fields',     label: 'Modified Fields',       w: 180, readonly: true },
  { key: 'old_values',          label: 'Old Values',            w: 180, readonly: true },
  { key: 'new_values',          label: 'New Values',            w: 180, readonly: true },
];

// Columns whose readonly cells should wrap text
const WRAP_COLS = new Set(['modified_fields', 'old_values', 'new_values']);

// Exclude from Add Entry modal
const MODAL_EXCLUDE = new Set(['tot_m', 'tot_f', 'tot_d', 'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values']);

const PAGE_SIZE = 50;

// ─── Computed column helpers ──────────────────────────────────────────────────

function computeTotals(data) {
  const get = (k) => (data[k] || '') === '1';
  return {
    tot_m: (get('am') || get('im') || get('cm') || get('wm')) ? '1' : '',
    tot_f: (get('af') || get('if_') || get('cf') || get('wf')) ? '1' : '',
    tot_d: (get('ad') || get('id_2') || get('cd') || get('wd')) ? '1' : '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function STTTrainingReport() {
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
  const [dbCount, setDbCount]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const filterTimer = useRef(null);
  const [appliedFilters, setAppliedFilters] = useState({});
  const sortColRef = useRef('');
  const sortDirRef = useRef('asc');
  const [sortCol, setSortCol]         = useState('');
  const [sortDir, setSortDir]         = useState('asc');
  const [hiddenCols, setHiddenCols]   = useState(new Set());
  const [colOrder, setColOrder]       = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [idCheck, setIdCheck] = useState('');  // '' | 'duplicate' | 'incorrect' | 'missing'

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // ── Load rows ──
  const loadRows = useCallback(async (pg, filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, size: PAGE_SIZE });
      if (sortColRef.current) { params.set('sortCol', sortColRef.current); params.set('sortDir', sortDirRef.current); }
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      if (idCheck) params.set('_idCheck', idCheck);
      const res  = await fetch(`/api/stt-training-report?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [idCheck]);

  useEffect(() => { loadRows(page, appliedFilters); }, [page, appliedFilters, sortCol, sortDir, idCheck]);

  // Check DB count on mount
  useEffect(() => {
    fetch('/api/stt-training-report/count').then(r => r.json()).then(d => setDbCount(d.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user-prefs?page=STTTrainingReport&userId=${user.id}`)
      .then(r => r.json()).then(d => { setHiddenCols(new Set(d.hiddenColumns || [])); if (d.columnOrder?.length) setColOrder(d.columnOrder); }).catch(() => {});
  }, [user?.id]);

  const handleSort = (key) => {
    const newDir = sortColRef.current === key && sortDirRef.current === 'asc' ? 'desc' : 'asc';
    sortColRef.current = key; sortDirRef.current = newDir;
    setSortCol(key); setSortDir(newDir); setPage(1);
  };

  const savePrefs = (hidden, order) => {
    if (user?.id) fetch(`/api/user-prefs?page=STTTrainingReport&userId=${user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hiddenColumns: [...hidden], columnOrder: order }) }).catch(() => {});
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

  // Build ordered columns list
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

  // ── Cell value (pending overrides row) ──
  const cellVal = (row, key) => pending[row.id]?.[key] ?? row[key] ?? '';

  // ── Edit cell — auto-compute tot_m / tot_f / tot_d ──
  const editCell = useCallback((rowId, key, value, originalRow) => {
    setPending(prev => {
      const updated = { ...prev[rowId], [key]: value };
      // Build a merged view for computing totals
      const merged = { ...originalRow, ...prev[rowId], [key]: value };
      const totals = computeTotals(merged);
      return { ...prev, [rowId]: { ...updated, ...totals } };
    });
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
      ...row,
      ...edits,
      modified_by:     user?.displayName || user?.username || 'Unknown',
      modified_time:   new Date().toLocaleString('en-ZA'),
      modified_fields: changedFields.join(', '),
      old_values:      oldVals,
      new_values:      newVals,
    };

    setSaving(prev => ({ ...prev, [row.id]: true }));
    setSaveErr(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    try {
      const res = await fetch(`/api/stt-training-report/${row.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(merged),
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

  // ── Revert row ──
  const revertRow = (rowId) => {
    setPending(prev  => { const n = { ...prev };  delete n[rowId]; return n; });
    setOriginals(prev => { const n = { ...prev }; delete n[rowId]; return n; });
    setSaveErr(prev  => { const n = { ...prev };  delete n[rowId]; return n; });
  };

  // ── Add new row (modal) ──
  const [adding, setAdding]             = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry]         = useState({});
  const [addError, setAddError]         = useState('');

  const openAddModal = () => {
    const blank = {};
    for (const col of COLUMNS) {
      if (!col.readonly && !MODAL_EXCLUDE.has(col.key)) blank[col.key] = '';
    }
    setNewEntry(blank);
    setAddError('');
    setShowAddModal(true);
  };

  const handleNewEntryChange = (key, value) => {
    setNewEntry(prev => {
      const updated = { ...prev, [key]: value };
      const totals  = computeTotals(updated);
      return { ...updated, ...totals };
    });
  };

  const submitNewEntry = async () => {
    setAdding(true);
    setAddError('');
    try {
      const totals  = computeTotals(newEntry);
      const payload = {
        ...newEntry,
        ...totals,
        tot_m: totals.tot_m,
        tot_f: totals.tot_f,
        tot_d: totals.tot_d,
        modified_by:   user?.displayName || user?.username || 'Unknown',
        modified_time: new Date().toLocaleString('en-ZA'),
      };
      const res = await fetch('/api/stt-training-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
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
  const [historyRow, setHistoryRow]         = useState(null);
  const [historyData, setHistoryData]       = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (row) => {
    setHistoryRow(row);
    setHistoryData([]);
    setHistoryLoading(true);
    try {
      const res  = await fetch(`/api/stt-training-report/${row.id}/history`);
      const data = await res.json();
      setHistoryData(data.entries || []);
    } catch { /* show empty */ }
    setHistoryLoading(false);
  };

  // Excel upload state
  const [showUploadModal, setShowUploadModal]       = useState(false);
  const [uploadRows, setUploadRows]                 = useState([]);       // extracted + editable rows
  const [uploadAbattoir, setUploadAbattoir]         = useState('');       // selected abattoir name
  const [uploadMunicipality, setUploadMunicipality] = useState('');
  const [uploadProgramme, setUploadProgramme]       = useState('');
  const [uploadSpecie, setUploadSpecie]             = useState('');
  const [uploadFacilitator, setUploadFacilitator]   = useState('');
  const [uploadContact, setUploadContact]           = useState('');
  const [abattoirList, setAbattoirList]             = useState({ registered: [], custom: [] });
  const [uploadProvince, setUploadProvince]         = useState('');
  const [uploadDateStart, setUploadDateStart]       = useState('');
  const [uploadDateEnd, setUploadDateEnd]           = useState('');
  const [uploadThruPut, setUploadThruPut]             = useState('');
  const [uploadFile, setUploadFile]                 = useState(null);
  const [uploadCommitting, setUploadCommitting]     = useState(false);
  const [uploadError, setUploadError]               = useState('');
  const [customAbattoirInput, setCustomAbattoirInput] = useState('');
  const [addingCustom, setAddingCustom]             = useState(false);

  // ── Delete row ──
  const [deleting, setDeleting] = useState({});
  const deleteRow = async (rowId) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    setDeleting(prev => ({ ...prev, [rowId]: true }));
    try {
      const res  = await fetch(`/api/stt-training-report/${rowId}`, { method: 'DELETE' });
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

  // ── Excel upload helpers ──
  const colIndex = (letter) => {
    let n = 0;
    for (let i = 0; i < letter.length; i++) n = n * 26 + letter.charCodeAt(i) - 64;
    return n - 1; // 0-based
  };

  const loadAbattoirNames = async () => {
    try {
      const res = await fetch('/api/abattoir/names');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.registered)) setAbattoirList(data);
    } catch {}
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    e.target.value = '';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/stt-training-report/parse-excel', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert('Failed to parse Excel: ' + (err.message || 'Unknown error'));
        return;
      }
      const { session, rows } = await res.json();

      // Auto-populate session fields from the spreadsheet
      if (session.programme) setUploadProgramme(session.programme);
      if (session.specie)     setUploadSpecie(session.specie);
      if (session.facilitator) setUploadFacilitator(session.facilitator);
      if (session.contact)    setUploadContact(String(session.contact));

      setUploadRows(rows);
      setUploadError('');
      loadAbattoirNames();
      setShowUploadModal(true);
    } catch (err) {
      alert('Error uploading file: ' + err.message);
    }
  };

  const handleAbattoirSelect = (name) => {
    setUploadAbattoir(name);
    if (name === '__add_new__') return;
    const found = abattoirList.registered.find(a => a.name === name);
    if (found?.municipality) setUploadMunicipality(found.municipality);
    if (found?.province)     setUploadProvince(found.province);
    if (found?.thru_put)     setUploadThruPut(found.thru_put);
    else                     setUploadThruPut('');
  };

  const handleAddCustomAbattoir = async () => {
    if (!customAbattoirInput.trim()) return;
    setAddingCustom(true);
    try {
      const res = await fetch('/api/abattoir/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customAbattoirInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add abattoir');
      setAbattoirList(prev => ({ ...prev, custom: [...prev.custom, data] }));
      setUploadAbattoir(data.name);
      setCustomAbattoirInput('');
    } catch (err) {
      setUploadError('Failed to add abattoir: ' + err.message);
    }
    setAddingCustom(false);
  };

  const handleDeleteCustomAbattoir = async (id) => {
    try {
      await fetch(`/api/abattoir/custom/${id}`, { method: 'DELETE' });
      setAbattoirList(prev => ({ ...prev, custom: prev.custom.filter(c => c.id !== id) }));
      if (abattoirList.custom.find(c => c.id === id)?.name === uploadAbattoir) setUploadAbattoir('');
    } catch {}
  };

  const handleUploadRowEdit = (idx, field, value) => {
    setUploadRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleRemoveUploadRow = (idx) => {
    setUploadRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleExportPdf = async (file, province, abattoir) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('province', province);
      formData.append('abattoir', abattoir);
      const res = await fetch('/api/stt-training-report/export-pdf', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('PDF export failed:', err.message);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'STT_Register.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  };

  const handleCommit = async () => {
    if (uploadRows.length === 0) { setUploadError('No rows to commit.'); return; }

    const missing = [];
    if (!uploadAbattoir || uploadAbattoir === '__add_new__') missing.push('Abattoir Name');
    if (!uploadProvince)    missing.push('Province');
    if (!uploadMunicipality.trim()) missing.push('District / Municipality');
    if (!uploadProgramme.trim())    missing.push('Training Programme');
    if (!uploadSpecie.trim())       missing.push('Specie');
    if (!uploadFacilitator.trim())  missing.push('Facilitator');
    if (!uploadContact.trim())      missing.push('Contact Number');
    if (!uploadDateStart)           missing.push('Training Start Date');
    if (!uploadDateEnd)             missing.push('Training End Date');
    if (missing.length > 0) {
      setUploadError('Required fields missing: ' + missing.join(', '));
      return;
    }

    setUploadCommitting(true);
    setUploadError('');
    let failed = 0;
    for (const row of uploadRows) {
      const payload = {
        ...row,
        province:          uploadProvince,
        abattoir_name:     uploadAbattoir,
        municipality:      uploadMunicipality,
        thru_put:          uploadThruPut,
        report_to_client:  uploadProgramme,
        reported_by:       uploadFacilitator,
        specie:            uploadSpecie,
        sample_take:       uploadContact,
        training_date:       uploadDateStart ? `${uploadDateStart}${uploadDateEnd ? ' – ' + uploadDateEnd : ''}` : '',
        training_start_date: uploadDateStart,
        training_end_date:   uploadDateEnd,
      };
      delete payload._rowKey;
      try {
        const res = await fetch('/api/stt-training-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) failed++;
      } catch { failed++; }
    }
    if (failed > 0) {
      setUploadError(`${failed} row(s) failed to save.`);
      setUploadCommitting(false);
    } else {
      // Save PDF to Document Library
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('province', uploadProvince);
        formData.append('abattoir', uploadAbattoir);
        try {
          const pdfRes = await fetch('/api/stt-training-report/export-pdf', { method: 'POST', body: formData });
          if (!pdfRes.ok) {
            const pdfErr = await pdfRes.json().catch(() => ({}));
            setUploadError(`Data saved but PDF failed: ${pdfErr.message || 'Unknown error'}`);
            setUploadCommitting(false);
            return;
          }
        } catch (pdfErr) {
          setUploadError(`Data saved but PDF failed: ${pdfErr.message}`);
          setUploadCommitting(false);
          return;
        }
      }
      setUploadCommitting(false);
      setShowUploadModal(false);
      setUploadRows([]);
      setUploadAbattoir('');
      setUploadMunicipality('');
      setUploadThruPut('');
      setUploadProgramme('');
      setUploadSpecie('');
      setUploadFacilitator('');
      setUploadContact('');
      setUploadProvince('');
      setUploadDateStart('');
      setUploadDateEnd('');
      setUploadFile(null);
      loadRows(1, appliedFilters);
    }
  };

  // ── Export Excel ──
  const exportExcel = async () => {
    try {
      const { exportStyledExcel } = await import('../utils/exportStyledExcel.js');
      const params = new URLSearchParams({ page: 1, size: 99999 });
      if (sortColRef.current) { params.set('sortCol', sortColRef.current); params.set('sortDir', sortDirRef.current); }
      for (const [k, v] of Object.entries(appliedFilters)) { if (v) params.set(k, v); }
      if (idCheck) params.set('_idCheck', idCheck);
      const res = await fetch(`/api/stt-training-report?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const visibleCols = orderedColumns.filter(c => !hiddenCols.has(c.key));
      await exportStyledExcel({
        columns: visibleCols,
        rows: data.rows,
        sheetName: 'STT Training Report',
        fileName: 'STT_Training_Report.xlsx',
      });
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPending = (id) => pending[id] && Object.keys(pending[id]).length > 0;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/training-report')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>STT Training Report</span>
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
        {/* Toolbar */}
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
            <button onClick={openAddModal} style={s.btnAdd}>+ Add New Entry</button>
            {/* Hidden file input */}
            <input
              type="file"
              accept=".xlsx,.xls"
              id="excel-upload-input"
              style={{ display: 'none' }}
              onChange={handleExcelUpload}
            />
            <button
              style={s.btnUpload}
              onClick={() => document.getElementById('excel-upload-input').click()}
            >
              Upload Excel Training Data
            </button>
            <button
              onClick={() => {
                const modes = ['', 'duplicate', 'incorrect', 'missing'];
                const next = modes[(modes.indexOf(idCheck) + 1) % modes.length];
                setIdCheck(next); setPage(1);
              }}
              style={idCheck ? s.btnIdCheckActive : s.btnRefresh}
            >
              {idCheck === 'duplicate' ? 'Duplicate IDs' : idCheck === 'incorrect' ? 'Incorrect IDs' : idCheck === 'missing' ? 'Missing IDs' : 'ID Check'}
            </button>
            <button onClick={exportExcel} style={s.btnExport}>Export Excel</button>
            <button onClick={() => navigate('/training-report/stt/breakdown')} style={s.btnReport}>📊 Breakdown Report</button>
            <button onClick={() => setShowAuditLog(true)} style={s.btnRefresh}>Change Log</button>
            <button onClick={() => loadRows(page, appliedFilters)} style={s.btnRefresh}>Refresh</button>
            <ColVisibilityPanel columns={COLUMNS} hiddenCols={hiddenCols} onToggle={toggleCol} columnOrder={colOrder} onReorder={reorderCols} />
          </div>
        </div>

        {/* Table */}
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
                  return (
                    <th key={col.key} style={{ ...s.th, minWidth: col.w, maxWidth: col.w, background: hasFilter ? '#106ebe' : '#0078d4' }}>
                      <div style={{ ...s.thLabel, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col.key)}>
                        {col.label}{isSorted && <span style={{ marginLeft: 3, fontSize: '0.55rem', opacity: 0.85 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                      {col.readonly ? null : (
                        <ColFilterDropdown
                          col={col}
                          value={colFilters[col.key] || ''}
                          onChange={val => handleColFilter(col.key, val)}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} style={{ ...s.td, textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    {dbCount === 0 ? 'No data yet — click "+ Add New Entry" to start.' : 'No rows match the current filters.'}
                  </td>
                </tr>
              )}
              {rows.map((row, ri) => {
                const dirty    = hasPending(row.id);
                const isSaving = saving[row.id];
                const err      = saveErr[row.id];
                return (
                  <tr key={row.id} style={{ background: dirty ? '#e8f4fd' : ri % 2 === 0 ? '#ffffff' : '#f3f2f1' }}>
                    {/* Actions */}
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
                    {/* Data cells */}
                    {orderedColumns.map(col => {
                      if (hiddenCols.has(col.key)) return null;
                      const val = cellVal(row, col.key);
                      if (col.readonly) {
                        const wrap = WRAP_COLS.has(col.key);
                        return (
                          <td key={col.key} title={val} style={{
                            ...s.td,
                            minWidth: wrap ? 280 : col.w,
                            maxWidth: wrap ? 360 : col.w,
                            color: '#a8b8cc',
                            fontStyle: 'italic',
                            ...(wrap ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'visible' } : {}),
                          }}>
                            <span style={s.roCell}>{val}</span>
                          </td>
                        );
                      }
                      if (col.opts) {
                        return (
                          <td key={col.key} title={val} style={{ ...s.td, minWidth: col.w, maxWidth: col.w }}>
                            <select
                              style={s.cellSelect}
                              value={val}
                              onChange={e => editCell(row.id, col.key, e.target.value, row)}
                            >
                              {col.opts.map(o => <option key={o} value={o}>{o || ''}</option>)}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} title={val} style={{ ...s.td, minWidth: col.w, maxWidth: col.w }}>
                          <input
                            className="cell-input"
                            style={s.cellInput}
                            value={val}
                            onChange={e => editCell(row.id, col.key, e.target.value, row)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom pagination */}
        <div style={{ ...s.pagination, marginTop: 8 }}>
          <button onClick={() => setPage(1)}       disabled={page === 1}          style={s.pgBtn}>«</button>
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
              <h2 style={s.modalTitle}>Add New Training Report Entry</h2>
              <button onClick={() => setShowAddModal(false)} style={s.modalClose}>✕</button>
            </div>

            {addError && <div style={s.errorMsg}>{addError}</div>}

            <div style={s.modalBody}>
              {COLUMNS.filter(c => !c.readonly && !MODAL_EXCLUDE.has(c.key)).map(col => (
                <div key={col.key} style={s.modalField}>
                  <label style={s.modalLabel}>{col.label}</label>
                  {col.opts ? (
                    <select
                      style={s.modalInput}
                      value={newEntry[col.key] || ''}
                      onChange={e => handleNewEntryChange(col.key, e.target.value)}
                    >
                      {col.opts.map(o => <option key={o} value={o}>{o || '-- Select --'}</option>)}
                    </select>
                  ) : (
                    <input
                      style={s.modalInput}
                      value={newEntry[col.key] || ''}
                      onChange={e => handleNewEntryChange(col.key, e.target.value)}
                      placeholder={col.label}
                    />
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

      {/* ── Excel Upload Preview Modal ── */}
      {showUploadModal && (
        <div style={s.modalOverlay}>
          <div style={su.shell}>

            {/* ── Modal Header ── */}
            <div style={su.header}>
              <div style={su.headerLeft}>
                <span style={su.headerIcon}>📂</span>
                <div>
                  <div style={su.headerTitle}>Import Excel Register</div>
                  <div style={su.headerSub}>Review extracted data and confirm session details before committing</div>
                </div>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div style={su.body}>

              {/* Session Details Card */}
              <div style={su.card}>
                <div style={su.cardHeader}>
                  <span style={su.cardHeaderIcon}>📋</span>
                  <span style={su.cardHeaderTitle}>Session Details</span>
                  <span style={su.cardHeaderSub}>Applied to every row on commit</span>
                </div>
                <div style={su.cardBody}>
                  <div style={su.fieldGrid}>

                    {/* Abattoir */}
                    <div style={su.fieldSpan2}>
                      <label style={su.label}>Abattoir Name <span style={{ color: '#d13438' }}>*</span></label>
                      <select value={uploadAbattoir} onChange={e => handleAbattoirSelect(e.target.value)} style={su.select}>
                        <option value="">— Select abattoir —</option>
                        {abattoirList.registered.length > 0 && (
                          <optgroup label="Registered Abattoirs">
                            {abattoirList.registered.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                          </optgroup>
                        )}
                        {abattoirList.custom.length > 0 && (
                          <optgroup label="Custom">
                            {abattoirList.custom.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                          </optgroup>
                        )}
                        <option value="__add_new__">— Not in list? Add new abattoir —</option>
                      </select>
                      {/* Add custom — only active when "add new" is selected */}
                      <div style={{ ...su.addCustomRow, opacity: uploadAbattoir === '__add_new__' ? 1 : 0.4, pointerEvents: uploadAbattoir === '__add_new__' ? 'auto' : 'none' }}>
                        <input
                          type="text"
                          placeholder="Type new abattoir name and click Add…"
                          value={customAbattoirInput}
                          onChange={e => setCustomAbattoirInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddCustomAbattoir()}
                          style={su.addCustomInput}
                          disabled={uploadAbattoir !== '__add_new__'}
                        />
                        <button style={su.addCustomBtn} onClick={handleAddCustomAbattoir} disabled={addingCustom || uploadAbattoir !== '__add_new__'}>
                          {addingCustom ? '…' : '+ Add'}
                        </button>
                      </div>
                      {abattoirList.custom.length > 0 && user?.role === 'admin' && (
                        <div style={su.customTags}>
                          {abattoirList.custom.map(a => (
                            <span key={a.id} style={su.customTag}>
                              {a.name}
                              <button onClick={() => handleDeleteCustomAbattoir(a.id)} style={su.customTagDel}>✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Province */}
                    <div>
                      <label style={su.label}>Province <span style={{ color: '#d13438' }}>*</span></label>
                      <select value={uploadProvince} onChange={e => setUploadProvince(e.target.value)} style={su.select}>
                        {PROVINCE_OPTS.map(o => <option key={o} value={o}>{o || '— Select province —'}</option>)}
                      </select>
                    </div>

                    {/* Municipality */}
                    <div>
                      <label style={su.label}>District / Municipality <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="text" value={uploadMunicipality} onChange={e => setUploadMunicipality(e.target.value)} style={su.input} placeholder="e.g. Cape Winelands" />
                    </div>

                    {/* Throughput */}
                    <div>
                      <label style={su.label}>Throughput (L/H)</label>
                      <input type="text" value={uploadThruPut} onChange={e => setUploadThruPut(e.target.value)} style={su.input} placeholder="e.g. L or H" />
                    </div>

                    {/* Training Programme */}
                    <div>
                      <label style={su.label}>Training Programme <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="text" value={uploadProgramme} onChange={e => setUploadProgramme(e.target.value)} style={su.input} placeholder="e.g. Slaughter Technique Training" />
                    </div>

                    {/* Specie */}
                    <div>
                      <label style={su.label}>Specie <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="text" value={uploadSpecie} onChange={e => setUploadSpecie(e.target.value)} style={su.input} placeholder="e.g. Cattle" />
                    </div>

                    {/* Facilitator */}
                    <div>
                      <label style={su.label}>Facilitator <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="text" value={uploadFacilitator} onChange={e => setUploadFacilitator(e.target.value)} style={su.input} placeholder="Full name" />
                    </div>

                    {/* Contact */}
                    <div>
                      <label style={su.label}>Contact Number <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="text" value={uploadContact} onChange={e => setUploadContact(e.target.value)} style={su.input} placeholder="e.g. 012 345 6789" />
                    </div>

                    {/* Training Start Date */}
                    <div>
                      <label style={su.label}>Training Start Date <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="date" value={uploadDateStart} onChange={e => setUploadDateStart(e.target.value)} style={su.input} />
                    </div>

                    {/* Training End Date */}
                    <div>
                      <label style={su.label}>Training End Date <span style={{ color: '#d13438' }}>*</span></label>
                      <input type="date" value={uploadDateEnd} onChange={e => setUploadDateEnd(e.target.value)} style={su.input} />
                    </div>

                  </div>
                </div>
              </div>

              {/* Extracted Rows Card */}
              <div style={su.card}>
                <div style={su.cardHeader}>
                  <span style={su.cardHeaderIcon}>👥</span>
                  <span style={su.cardHeaderTitle}>Extracted Attendees</span>
                  <span style={su.rowBadge}>{uploadRows.length} row{uploadRows.length !== 1 ? 's' : ''}</span>
                  <span style={su.cardHeaderSub}>Edit any cell or remove rows before committing</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {uploadRows.length === 0 ? (
                    <div style={su.emptyRows}>No attendees extracted — check the Excel file format.</div>
                  ) : (
                    <table style={su.table}>
                      <thead>
                        <tr>
                          <th style={{ ...su.th, width: '36px', textAlign: 'center' }}>#</th>
                          <th style={su.th}>Surname</th>
                          <th style={su.th}>Name</th>
                          <th style={su.th}>ID Number</th>
                          <th style={su.th}>Race &amp; Gender</th>
                          <th style={su.th}>Work Station</th>
                          <th style={{ ...su.th, width: '60px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadRows.map((row, idx) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9f8f7' }}>
                            <td style={su.tdNum}>{idx + 1}</td>
                            {[
                              { f: 'surname',     w: '120px' },
                              { f: 'name',        w: '120px' },
                              { f: 'id_number',   w: '140px' },
                              { f: 'race_gender', w: '80px'  },
                              { f: 'work_station',w: '160px' },
                            ].map(({ f, w }) => (
                              <td key={f} style={su.td}>
                                <input
                                  type="text"
                                  value={row[f] || ''}
                                  onChange={e => handleUploadRowEdit(idx, f, e.target.value)}
                                  style={{ ...su.cellInput, width: w }}
                                />
                              </td>
                            ))}
                            <td style={su.td}>
                              <button onClick={() => handleRemoveUploadRow(idx)} style={su.removeBtn} title="Remove row">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {uploadError && (
                <div style={su.errorBanner}>{uploadError}</div>
              )}
            </div>

            {/* ── Footer ── */}
            <div style={su.footer}>
              <div style={su.footerLeft}>
                <span style={su.footerCount}>
                  {uploadRows.length} attendee{uploadRows.length !== 1 ? 's' : ''} ready to commit
                </span>
              </div>
              <div style={su.footerRight}>
                <button style={su.cancelBtn} onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button
                  style={{ ...su.commitBtn, ...(uploadCommitting || uploadRows.length === 0 ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                  onClick={handleCommit}
                  disabled={uploadCommitting || uploadRows.length === 0}
                >
                  {uploadCommitting ? '⏳ Committing…' : `✓ Commit ${uploadRows.length} Row${uploadRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

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
                    old:   (oldParts[i] || '').replace(`${f}: `, ''),
                    new:   (newParts[i] || '').replace(`${f}: `, ''),
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
      {showAuditLog && <AuditLogModal tableName="STTTrainingReport" title="STT Training Report" onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  searchInput: { background: '#ffffff', border: '1px solid #8a8886', borderRadius: '2px', color: '#323130', padding: '6px 12px', fontSize: '0.85rem', width: '220px', outline: 'none' },
  filterSelect:{ background: '#ffffff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px', padding: '6px 10px', fontSize: '0.82rem', width: 'auto', cursor: 'pointer' },
  metaChip:    { fontSize: '0.75rem', padding: '3px 10px', borderRadius: '2px', background: '#f3f2f1', border: '1px solid #edebe9', color: '#323130' },
  btnImport:   { background: '#0078d4', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', width: 'auto' },
  btnImportSmall:{ background: '#ffffff', border: '1px solid #0078d4', color: '#0078d4', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto' },
  btnRefresh:  { background: '#ffffff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnExport:   { background: '#0078d4', border: '1px solid #0078d4', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  errorMsg:    { color: '#a4262c', fontSize: '0.85rem', background: '#fde7e9', border: '1px solid #f1707b', borderRadius: '2px', padding: '9px 14px' },
  pagination:  { display: 'flex', alignItems: 'center', gap: '6px' },
  pgBtn:       { background: '#ffffff', border: '1px solid #8a8886', color: '#0078d4', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', width: 'auto' },
  pgInfo:      { color: '#605e5c', fontSize: '0.82rem', padding: '0 6px' },
  tableWrap:   { overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, borderRadius: '2px', border: '1px solid #edebe9', position: 'relative' },
  loadOverlay: { position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0078d4', fontSize: '0.9rem', zIndex: 10, borderRadius: '2px' },
  table:       { borderCollapse: 'collapse', fontSize: '0.65rem', width: 'max-content', minWidth: '100%' },
  th:          { background: '#0078d4', color: '#ffffff', padding: '6px 8px', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '2px solid #005a9e', position: 'sticky', top: 0, zIndex: 3 },
  td:          { padding: '1px 5px', color: '#323130', whiteSpace: 'nowrap', borderRight: '1px solid #edebe9', borderBottom: '1px solid #edebe9', overflow: 'hidden', textOverflow: 'ellipsis' },
  stickyAct:   { position: 'sticky', left: 0, zIndex: 4, minWidth: '130px', maxWidth: '130px', background: '#ffffff', borderRight: '2px solid #edebe9' },
  cellInput:   { background: 'transparent', border: 'none', fontSize: '0.63rem', fontFamily: 'inherit', width: '100%', padding: '1px 2px', outline: 'none', color: '#323130', borderRadius: '2px' },
  cellSelect:  { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '2px', color: '#323130', fontSize: '0.63rem', padding: '1px 2px', width: '100%', cursor: 'pointer' },
  roCell:      { fontSize: '0.63rem', color: '#605e5c', whiteSpace: 'inherit' },
  thLabel:     { fontSize: '0.65rem', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' },
  thSearch:    { background: '#ffffff', border: '1px solid #d0d0d0', borderRadius: '2px', color: '#323130', fontSize: '0.63rem', padding: '2px 4px', width: '100%', outline: 'none', boxSizing: 'border-box' },
  btnClearFilters:{ background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnSave:     { background: '#107c10', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnRevert:   { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnDelete:   { background: 'transparent', border: '1px solid #c8c6c4', color: '#a4262c', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', whiteSpace: 'nowrap' },
  btnHistory:  { background: 'transparent', border: '1px solid #c8c6c4', color: '#0078d4', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', whiteSpace: 'nowrap' },
  btnAdd:      { background: '#107c10', border: '1px solid #107c10', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnUpload:   { background: '#5c2d91', border: '1px solid #5c2d91', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnIdCheckActive:{ background: '#fff4ce', border: '1px solid #f7c948', color: '#8a6914', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, width: 'auto', lineHeight: 1 },
  btnReport:   { background: '#2e4b8a', border: '1px solid #2e4b8a', color: '#ffffff', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto', lineHeight: 1 },
  btnSaveModal:{ background: '#0078d4', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '8px 24px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  // Modal
  modalOverlay:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:    { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '4px', width: '90%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #edebe9' },
  modalTitle:  { color: '#323130', fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  modalClose:  { background: 'none', border: 'none', color: '#605e5c', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px', width: 'auto' },
  modalBody:   { padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  modalField:  { display: 'flex', flexDirection: 'column', gap: '3px' },
  modalLabel:  { color: '#323130', fontSize: '0.75rem', fontWeight: 600, margin: 0 },
  modalInput:  { background: '#ffffff', border: '1px solid #8a8886', borderRadius: '2px', color: '#323130', padding: '7px 10px', fontSize: '0.82rem', outline: 'none', width: '100%', margin: 0 },
  footer:      { background: '#0078d4', height: '40px', marginTop: 'auto', flexShrink: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid #edebe9' },
};

// ─── Upload Modal Styles ──────────────────────────────────────────────────────
const su = {
  shell:          { background: '#fff', borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', width: '95vw', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', sans-serif" },
  header:         { background: '#0078d4', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '2px 2px 0 0' },
  headerLeft:     { display: 'flex', alignItems: 'center', gap: '12px' },
  headerIcon:     { fontSize: '1.4rem' },
  headerTitle:    { color: '#fff', fontWeight: 600, fontSize: '1rem' },
  headerSub:      { color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', marginTop: '2px' },
  closeBtn:       { background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 },
  body:           { overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  card:           { background: '#fff', border: '1px solid #edebe9', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  cardHeader:     { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#f9f8f7', borderBottom: '1px solid #edebe9' },
  cardHeaderIcon: { fontSize: '1rem' },
  cardHeaderTitle:{ fontWeight: 600, color: '#323130', fontSize: '0.88rem' },
  cardHeaderSub:  { color: '#a19f9d', fontSize: '0.78rem', marginLeft: '4px' },
  rowBadge:       { background: '#0078d4', color: '#fff', borderRadius: '10px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600 },
  cardBody:       { padding: '16px' },
  fieldGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' },
  fieldSpan2:     { gridColumn: 'span 2' },
  label:          { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#323130', marginBottom: '5px' },
  required:       { color: '#d13438' },
  select:         { width: '100%', border: '1px solid #8a8886', borderRadius: '2px', padding: '7px 10px', fontSize: '0.85rem', color: '#323130', outline: 'none', background: '#fff', boxSizing: 'border-box' },
  input:          { width: '100%', border: '1px solid #8a8886', borderRadius: '2px', padding: '7px 10px', fontSize: '0.85rem', color: '#323130', outline: 'none', boxSizing: 'border-box' },
  addCustomRow:   { display: 'flex', gap: '6px', marginTop: '8px', width: '100%', alignItems: 'center' },
  addCustomInput: { flex: 1, minWidth: 0, border: '1px solid #8a8886', borderRadius: '2px', padding: '7px 10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' },
  addCustomBtn:   { flexShrink: 0, width: 'auto', background: '#0078d4', border: 'none', color: '#fff', padding: '5px 8px', borderRadius: '2px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' },
  customTags:     { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' },
  customTag:      { background: '#edebe9', borderRadius: '2px', padding: '2px 6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#323130' },
  customTagDel:   { background: 'none', border: 'none', color: '#a4262c', cursor: 'pointer', padding: 0, fontSize: '0.75rem', lineHeight: 1 },
  table:          { borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' },
  th:             { background: '#0078d4', color: '#fff', padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)' },
  td:             { padding: '3px 6px', borderBottom: '1px solid #edebe9' },
  tdNum:          { padding: '3px 10px', borderBottom: '1px solid #edebe9', color: '#a19f9d', textAlign: 'center', width: '36px' },
  cellInput:      { border: '1px solid #edebe9', borderRadius: '2px', padding: '4px 6px', fontSize: '0.78rem', outline: 'none', background: '#fafafa' },
  removeBtn:      { background: 'none', border: '1px solid #fde7e9', color: '#a4262c', borderRadius: '2px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 },
  emptyRows:      { padding: '32px', textAlign: 'center', color: '#605e5c', fontSize: '0.88rem' },
  errorBanner:    { background: '#fde7e9', border: '1px solid #d13438', borderRadius: '2px', color: '#a4262c', padding: '10px 14px', fontSize: '0.85rem' },
  footer:         { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #edebe9', background: '#f9f8f7' },
  footerLeft:     { display: 'flex', alignItems: 'center' },
  footerCount:    { color: '#605e5c', fontSize: '0.85rem' },
  footerRight:    { display: 'flex', gap: '10px' },
  cancelBtn:      { background: '#fff', border: '1px solid #8a8886', color: '#323130', padding: '8px 20px', borderRadius: '2px', fontSize: '0.88rem', cursor: 'pointer' },
  commitBtn:      { background: '#107c10', border: 'none', color: '#fff', padding: '8px 24px', borderRadius: '2px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' },
};
