import { useState, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuditLogModal from '../components/AuditLogModal.jsx';

// ─── Column definitions ───────────────────────────────────────────────────────

const EDITABLE_COLUMNS = [
  { key: 'est_no',             label: 'Est. No'                },
  { key: 'establishment',      label: 'Establishment'          },
  { key: 'substance',          label: 'Substance'              },
  { key: 'specie',             label: 'Specie'                 },
  { key: 'sample_type',        label: 'Sample Type'            },
  { key: 'sample_ref',         label: 'Sample Ref.'            },
  { key: 'job_number',         label: 'Job Number'             },
  { key: 'sample_id',          label: 'Sample ID'              },
  { key: 'pooled_or_single',   label: 'Pooled / Single'        },
  { key: 'farm_name',          label: 'Farm Name'              },
  { key: 'district',           label: 'District'               },
  { key: 'state_vet_area',     label: 'State Vet Area'         },
  { key: 'province',           label: 'Province'               },
  { key: 'authorised_person',  label: 'Authorised Person'      },
  { key: 'owner',              label: 'Owner'                  },
  { key: 'authority_sampling', label: 'Authority for Sampling' },
  { key: 'date_collected',     label: 'Date Collected'         },
  { key: 'date_signed',        label: 'Date Signed'            },
  { key: 'date_received_lab',  label: 'Date Received in Lab'   },
  { key: 'date_registered',    label: 'Date Registered'        },
  { key: 'date_captured',      label: 'Date Captured'          },
  { key: 'reason_not_analysed',label: 'Reason Not Analysed'   },
  { key: 'date_completed_1',   label: 'Date Completed 1'       },
  { key: 'date_completed_2',   label: 'Date Completed 2'       },
  { key: 'date_completed_3',   label: 'Date Completed 3'       },
  { key: 'date_completed_4',   label: 'Date Completed 4'       },
  { key: 'date_completed_5',   label: 'Date Completed 5'       },
  { key: 'date_completed_6',   label: 'Date Completed 6'       },
  { key: 'date_completed_7',   label: 'Date Completed 7'       },
  { key: 'results_1',              label: 'Results 1'              },
  { key: 'substance_results_1',   label: 'Substance Results 1'   },
  { key: 'ppb_results_1',         label: 'ppb Results 1'         },
  { key: 'results_2',              label: 'Results 2'              },
  { key: 'substance_results_2',   label: 'Substance Results 2'   },
  { key: 'ppb_results_2',         label: 'ppb Results 2'         },
  { key: 'results_3',              label: 'Results 3'              },
  { key: 'substance_results_3',   label: 'Substance Results 3'   },
  { key: 'ppb_results_3',         label: 'ppb Results 3'         },
  { key: 'results_4',              label: 'Results 4'              },
  { key: 'substance_results_4',   label: 'Substance Results 4'   },
  { key: 'ppb_results_4',         label: 'ppb Results 4'         },
  { key: 'results_5',              label: 'Results 5'              },
  { key: 'substance_results_5',   label: 'Substance Results 5'   },
  { key: 'ppb_results_5',         label: 'ppb Results 5'         },
  { key: 'results_6',              label: 'Results 6'              },
  { key: 'substance_results_6',   label: 'Substance Results 6'   },
  { key: 'ppb_results_6',         label: 'ppb Results 6'         },
  { key: 'results_7',              label: 'Results 7'              },
  { key: 'substance_results_7',   label: 'Substance Results 7'   },
  { key: 'ppb_results_7',         label: 'ppb Results 7'         },
  { key: 'comments',           label: 'Comments'               },
  { key: 'non_compliant',      label: 'Non-Compliant?'         },
  { key: 'cost_screening',     label: 'Cost Screening'         },
  { key: 'cost_confirmation',  label: 'Cost Confirmation'      },
  { key: 'admin_cost',         label: 'Admin'                  },
];

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

const SPECIES_OPTS    = ['Bovine', 'Ovine', 'Porcine', 'Poultry'];
const SAMPLE_TYPE_OPTS = ['Fat', 'Kidney', 'Liver', 'Muscle'];
const PROVINCE_OPTS   = [
  'Eastern Cape', 'Free State', 'Gauteng',
  'KZN', 'KwaZulu-Natal', 'KwaZulu Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
];

const RULES = {
  est_no:            { required: true },
  establishment:     { required: true },
  specie:            { required: true, enum: SPECIES_OPTS },
  sample_type:       { required: true, enum: SAMPLE_TYPE_OPTS },
  sample_ref:        { required: true },
  farm_name:         { required: true },
  province:          { required: true, enum: PROVINCE_OPTS },
  date_collected:    { required: true, date: true },
  date_signed:       { date: true },
  date_received_lab: { date: true },
  date_registered:   { date: true },
  date_captured:     { date: true },
  date_completed_1:  { date: true },
  date_completed_2:  { date: true },
  date_completed_3:  { date: true },
  date_completed_4:  { date: true },
  date_completed_5:  { date: true },
  date_completed_6:  { date: true },
  date_completed_7:  { date: true },
};

function validateCell(key, value) {
  const rule = RULES[key];
  if (!rule) return null;
  const val = (value || '').trim();
  if (rule.required && !val) return 'Required';
  if (val) {
    if (rule.enum) {
      const match = rule.enum.some(e => e.toLowerCase() === val.toLowerCase());
      if (!match) return `Must be: ${rule.enum.slice(0, 4).join(' / ')}${rule.enum.length > 4 ? '…' : ''}`;
    }
    if (rule.date && !DATE_RE.test(val)) return 'Format: dd/mm/yyyy';
  }
  return null;
}

function computeRowErrors(rows) {
  const out = {};
  for (const row of rows) {
    const errs = {};
    for (const col of EDITABLE_COLUMNS) {
      const e = validateCell(col.key, row[col.key]);
      if (e) errs[col.key] = e;
    }
    if (Object.keys(errs).length > 0) out[row.id] = errs;
  }
  return out;
}

// ─── Memoised preview row ─────────────────────────────────────────────────────

const EMPTY_ERRS = {};

const PreviewRow = memo(function PreviewRow({ row, isDiscard, rowErrs, toggleStatus, handleCellEdit }) {
  const hasErrs  = Object.keys(rowErrs).length > 0;
  const stickyBg = isDiscard ? '#2a0f0f' : hasErrs ? '#1a1500' : '#0b1e38';
  return (
    <tr style={{ background: isDiscard ? 'rgba(239,68,68,0.07)' : 'transparent' }}>
      <td style={{ ...s.td, ...s.stickyCol1, background: stickyBg, textAlign: 'center', padding: '3px 4px' }}>
        <button onClick={() => toggleStatus(row.id)} style={isDiscard ? s.btnRowDiscard : s.btnRowCommit}>
          {isDiscard ? '✗ Discard' : '✓ Commit'}
        </button>
        {hasErrs && !isDiscard && (
          <div style={s.errBadge} title={Object.values(rowErrs).join('; ')}>
            ⚠ {Object.keys(rowErrs).length}
          </div>
        )}
      </td>
      <td style={{ ...s.td, ...s.stickyCol2, background: stickyBg }}>
        <span style={s.keyCell}>
          <span style={s.keyPart}>{row.species}</span>
          <span style={s.keySep}>·</span>
          <span style={s.keyPart}>{row.sample_ref}</span>
          <span style={s.keySep}>·</span>
          <span style={s.keyPart}>{row.date_collected}</span>
          <span style={s.keySep}>·</span>
          <span style={s.keyPart}>{row.sample_type}</span>
        </span>
      </td>
      {EDITABLE_COLUMNS.map(col => {
        const errMsg = rowErrs[col.key];
        return (
          <td
            key={col.key}
            style={{
              ...s.td,
              background: errMsg ? 'rgba(239,68,68,0.12)' : undefined,
              borderBottom: errMsg ? '1px solid rgba(239,68,68,0.35)' : s.td.borderBottom,
            }}
            title={errMsg || ''}
          >
            <input
              className="cell-input"
              style={{ ...s.cellInput, color: errMsg ? '#fca5a5' : '#e2e8f0' }}
              value={row[col.key] || ''}
              onChange={e => handleCellEdit(row.id, col.key, e.target.value)}
            />
            {errMsg && <div style={s.cellErrTip}>{errMsg}</div>}
          </td>
        );
      })}
    </tr>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResidueMonitoring() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const uploadXhrRef = useRef(null);

  const [step, setStep]               = useState('idle');
  const [batchId, setBatchId]         = useState(null);
  const [localRows, setLocalRows]     = useState([]);
  const [rowStatus, setRowStatus]     = useState({});
  const [filterSpecies, setFilterSpecies] = useState('All');
  const [colFilters, setColFilters]   = useState({});
  const [keyFilter, setKeyFilter]     = useState('');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [error, setError]             = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [fileName, setFileName]       = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('');
  const [previewPageNum, setPreviewPageNum] = useState(1);

  // ── Committed data viewer ──
  const [viewOpen, setViewOpen]         = useState(false);
  const [committedRows, setCommittedRows] = useState([]);
  const [committedTotal, setCommittedTotal] = useState(0);
  const [viewLoading, setViewLoading]   = useState(false);
  const [viewError, setViewError]       = useState('');
  const [viewFilters, setViewFilters]   = useState({});
  const [viewPage, setViewPage]         = useState(1);
  const [pendingEdits, setPendingEdits] = useState({});
  const [savingId, setSavingId]         = useState(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const viewPageSize = 100;
  const viewFilterTimer = useRef(null);

  const loadCommitted = useCallback(async (pg) => {
    const p = pg || viewPage;
    setViewLoading(true);
    setViewError('');
    try {
      const params = new URLSearchParams({ page: p, size: viewPageSize });
      for (const [k, v] of Object.entries(viewFilters)) {
        if (v && k !== '_uniqueKey') params.set(k, v);
      }
      const res  = await fetch('/api/residue/committed?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCommittedRows(data.rows);
      setCommittedTotal(data.total);
      setPendingEdits({});
    } catch (err) {
      setViewError('Failed to load data: ' + err.message);
    }
    setViewLoading(false);
  }, [viewPage, viewFilters]);

  const toggleView = () => {
    if (!viewOpen) loadCommitted(1);
    setViewOpen(v => !v);
  };

  const handleViewPageChange = (pg) => {
    setViewPage(pg);
    loadCommitted(pg);
  };

  const handleViewCellEdit = useCallback((id, key, value) => {
    setPendingEdits(prev => {
      const row = prev[id] || {};
      return { ...prev, [id]: { ...row, [key]: value } };
    });
  }, []);

  const saveViewRow = useCallback(async (row) => {
    const edits = pendingEdits[row.id];
    if (!edits || Object.keys(edits).length === 0) return;
    setSavingId(row.id);
    try {
      const changedFields = Object.keys(edits);
      const oldVals = {};
      const newVals = {};
      changedFields.forEach(f => { oldVals[f] = row[f] || ''; newVals[f] = edits[f]; });
      const merged = { ...row, ...edits,
        modified_by: user?.name || user?.username || '',
        modified_time: new Date().toLocaleString(),
        modified_fields: changedFields.join(', '),
        old_values: JSON.stringify(oldVals),
        new_values: JSON.stringify(newVals),
      };
      const res = await fetch(`/api/residue/committed/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setCommittedRows(prev => prev.map(r => r.id === row.id ? merged : r));
      setPendingEdits(prev => { const next = { ...prev }; delete next[row.id]; return next; });
    } catch (err) {
      setViewError('Save failed: ' + err.message);
    }
    setSavingId(null);
  }, [pendingEdits, user]);

  const exportCommittedExcel = async () => {
    try {
      const { exportStyledExcel } = await import('../utils/exportStyledExcel.js');
      const params = new URLSearchParams({ page: 1, size: 99999 });
      for (const [k, v] of Object.entries(viewFilters)) {
        if (v && k !== '_uniqueKey') params.set(k, v);
      }
      const res = await fetch('/api/residue/committed?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const rows = data.rows || [];
      const cols = rows.length > 0
        ? Object.keys(rows[0]).filter(k => k !== 'id').map(k => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
        : [];
      await exportStyledExcel({
        columns: cols,
        rows,
        sheetName: 'Residue Monitoring',
        fileName: 'Residue_Monitoring_Export.xlsx',
      });
    } catch (err) {
      setViewError('Export failed: ' + err.message);
    }
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // ── Validation (memoised) ──
  const rowErrors = useMemo(() => computeRowErrors(localRows), [localRows]);

  const errorRowCount = useMemo(() => Object.keys(rowErrors).length, [rowErrors]);

  const hasBlockingErrors = useMemo(() =>
    localRows.some(r => rowStatus[r.id] !== 'discard' && rowErrors[r.id]),
    [localRows, rowStatus, rowErrors]
  );

  // ── Filtered rows (memoised) ──
  const visibleRows = useMemo(() => {
    let rows = filterSpecies === 'All' ? localRows : localRows.filter(r => r.species === filterSpecies);

    if (showOnlyErrors) rows = rows.filter(r => rowErrors[r.id]);

    if (keyFilter.trim()) {
      const kf = keyFilter.toLowerCase();
      rows = rows.filter(r =>
        `${r.species} ${r.sample_ref} ${r.date_collected} ${r.sample_type}`.toLowerCase().includes(kf)
      );
    }

    for (const [k, fv] of Object.entries(colFilters)) {
      if (fv.trim()) {
        const lv = fv.toLowerCase();
        rows = rows.filter(r => (r[k] || '').toLowerCase().includes(lv));
      }
    }
    return rows;
  }, [localRows, filterSpecies, showOnlyErrors, keyFilter, colFilters, rowErrors]);

  // ── Counts ──
  const commitCount  = useMemo(() => Object.values(rowStatus).filter(v => v !== 'discard').length, [rowStatus]);
  const discardCount = useMemo(() => Object.values(rowStatus).filter(v => v === 'discard').length,  [rowStatus]);
  const speciesList  = useMemo(() => ['All', ...Array.from(new Set(localRows.map(r => r.species).filter(Boolean)))], [localRows]);

  // ── Handlers ──
  const handleCellEdit = useCallback((id, key, value) => {
    setLocalRows(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
  }, []);

  const toggleStatus = useCallback((id) => {
    setRowStatus(prev => ({ ...prev, [id]: prev[id] === 'discard' ? 'commit' : 'discard' }));
  }, []);

  const markAll = (status) => {
    const next = {};
    localRows.forEach(r => { next[r.id] = status; });
    setRowStatus(next);
  };

  const handleColFilter = useCallback((key, value) => {
    setColFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const cancelUpload = useCallback(() => {
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
    }
    setStep('idle');
    setUploadProgress(0);
    setUploadPhase('');
    setError('Upload cancelled.');
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setSuccessMsg('');
    setColFilters({});
    setKeyFilter('');
    setShowOnlyErrors(false);
    setStep('uploading');
    setUploadProgress(0);
    setUploadPhase('Uploading file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Phase 1: Upload with progress via XHR
      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXhrRef.current = xhr;

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 60)); // 0-60%
          }
        };

        xhr.onload = () => {
          uploadXhrRef.current = null;
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.message || 'Upload failed'));
            }
          } catch {
            reject(new Error('Invalid server response'));
          }
        };

        xhr.onerror = () => { uploadXhrRef.current = null; reject(new Error('Network error')); };
        xhr.onabort = () => { uploadXhrRef.current = null; reject(new Error('__cancelled__')); };

        xhr.open('POST', '/api/residue/upload');
        xhr.send(formData);
      });

      // Phase 2: Loading preview data
      setUploadPhase('Processing rows...');
      setUploadProgress(70);

      const prev = await fetch(`/api/residue/temp/${uploadResult.batchId}`);
      const rows = await prev.json();

      setUploadProgress(90);
      setUploadPhase('Preparing preview...');

      const statusMap = {};
      rows.forEach(r => { statusMap[r.id] = 'commit'; });

      setUploadProgress(100);
      setBatchId(uploadResult.batchId);
      setLocalRows(rows);
      setRowStatus(statusMap);
      setFilterSpecies('All');
      setPreviewPageNum(1);
      setStep('preview');
      setUploadProgress(0);
      setUploadPhase('');
    } catch (err) {
      if (err.message === '__cancelled__') return;
      setError('Upload failed: ' + err.message);
      setStep('idle');
      setUploadProgress(0);
      setUploadPhase('');
    }
    e.target.value = '';
  };

  const handleCommit = async () => {
    if (hasBlockingErrors) return;
    const rowsToCommit = localRows.filter(r => rowStatus[r.id] !== 'discard');
    const discarded    = localRows.length - rowsToCommit.length;
    setStep('committing');
    setError('');
    try {
      const res  = await fetch('/api/residue/commit-rows', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ batchId, rows: rowsToCommit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      let msg = `${data.committed} records committed`;
      if (discarded > 0) msg += `, ${discarded} discarded`;
      if (data.duplicates > 0) msg += `, ${data.duplicates} duplicate(s) skipped`;
      msg += '.';
      setSuccessMsg(msg);
      setLocalRows([]);
      setBatchId(null);
      setStep('done');
    } catch (err) {
      setError('Commit failed: ' + err.message);
      setStep('preview');
    }
  };

  const handleDiscard = async () => {
    if (batchId) {
      try { await fetch(`/api/residue/temp/${batchId}`, { method: 'DELETE' }); } catch (_) {}
    }
    setLocalRows([]);
    setBatchId(null);
    setFileName('');
    setRowStatus({});
    setColFilters({});
    setKeyFilter('');
    setShowOnlyErrors(false);
    setStep('idle');
    setError('');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>Residue Monitoring Report</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.name || user?.username}</span>
          <div style={s.avatar} title={user?.name || user?.username}>
            {(user?.name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.content}>

        {/* Upload card */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>📤 Upload New Data</h2>
          <p style={s.cardDesc}>Download the official template, fill it in, then upload for review before saving.</p>
          <div style={s.actionRow}>
            <button onClick={() => window.open('/api/residue/template', '_blank')} style={s.btnOutline}>
              ⬇ Download Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={s.btnPrimary}
              disabled={step === 'uploading' || step === 'committing'}
            >
              📂 Upload Excel File
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
            <button onClick={toggleView} style={s.btnOutline}>
              {viewOpen ? '✕ Close Database View' : '🗄 View Committed Data'}
            </button>
          </div>
          {fileName && step !== 'idle' && step !== 'done' && (
            <p style={s.fileLabel}>File: <strong>{fileName}</strong></p>
          )}
          {step === 'uploading' && (
            <div style={s.progressWrap}>
              <div style={s.progressHeader}>
                <span style={s.progressLabel}>{uploadPhase} ({uploadProgress}%)</span>
                <button onClick={cancelUpload} style={s.btnCancel}>Cancel</button>
              </div>
              <div style={s.progressBarBg}>
                <div style={{ ...s.progressBarFill, width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          {error      && <div style={s.errorMsg}>{error}</div>}
          {successMsg && <div style={s.successMsg}>✅ {successMsg}</div>}
        </div>

        {/* Preview + edit */}
        {step === 'preview' && localRows.length > 0 && (
          <div style={s.card}>
            {/* Toolbar */}
            <div style={s.toolbar}>
              <div style={s.toolbarLeft}>
                <h2 style={{ ...s.cardTitle, marginBottom: 2 }}>🔍 Verify Data Before Saving</h2>
                <div style={s.toolbarMeta}>
                  <span style={s.metaChip}>{localRows.length} records</span>
                  <span style={{ ...s.metaChip, background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>
                    ✓ {commitCount} commit
                  </span>
                  {discardCount > 0 && (
                    <span style={{ ...s.metaChip, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                      ✗ {discardCount} discard
                    </span>
                  )}
                  {errorRowCount > 0 && (
                    <span style={{ ...s.metaChip, background: 'rgba(251,191,36,0.15)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.3)' }}>
                      ⚠ {errorRowCount} with errors
                    </span>
                  )}
                </div>
              </div>
              <div style={s.toolbarRight}>
                {speciesList.length > 2 && (
                  <select value={filterSpecies} onChange={e => setFilterSpecies(e.target.value)} style={s.select}>
                    {speciesList.map(sp => (
                      <option key={sp} value={sp}>
                        {sp === 'All' ? `All (${localRows.length})` : `${sp} (${localRows.filter(r => r.species === sp).length})`}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setShowOnlyErrors(v => !v)}
                  style={showOnlyErrors ? s.btnFilterActive : s.btnFilter}
                  disabled={errorRowCount === 0}
                >
                  {showOnlyErrors ? '👁 Show All' : `⚠ Show Errors (${errorRowCount})`}
                </button>
                <button onClick={() => markAll('commit')}  style={s.btnMarkCommit}>✓ All Commit</button>
                <button onClick={() => markAll('discard')} style={s.btnMarkDiscard}>✗ All Discard</button>
                <button onClick={handleDiscard} style={s.btnDanger}>Cancel</button>
                <button
                  onClick={handleCommit}
                  style={{ ...s.btnSuccess, opacity: hasBlockingErrors ? 0.45 : 1, cursor: hasBlockingErrors ? 'not-allowed' : 'pointer' }}
                  disabled={hasBlockingErrors}
                  title={hasBlockingErrors ? 'Fix all validation errors before committing' : ''}
                >
                  ✔ Commit {commitCount} Record{commitCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>

            {hasBlockingErrors && (
              <div style={s.blockingBanner}>
                ⛔ <strong>{errorRowCount} row{errorRowCount !== 1 ? 's' : ''}</strong> have validation errors.
                &nbsp;Use <strong>⚠ Show Errors</strong> to filter them, fix the highlighted cells, then commit.
              </div>
            )}

            {/* Table (paginated client-side for performance) */}
            {(() => {
              const PREVIEW_PAGE_SIZE = 100;
              const totalPreviewPages = Math.ceil(visibleRows.length / PREVIEW_PAGE_SIZE) || 1;
              const previewPage = Math.min(Math.max(1, previewPageNum), totalPreviewPages);
              const pageRows = visibleRows.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE);
              return (
                <>
                  {totalPreviewPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => setPreviewPageNum(1)} disabled={previewPage === 1} style={s.pageBtn}>First</button>
                      <button onClick={() => setPreviewPageNum(p => p - 1)} disabled={previewPage === 1} style={s.pageBtn}>Prev</button>
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem', padding: '6px 8px' }}>
                        Page {previewPage} of {totalPreviewPages} ({visibleRows.length} rows)
                      </span>
                      <button onClick={() => setPreviewPageNum(p => p + 1)} disabled={previewPage === totalPreviewPages} style={s.pageBtn}>Next</button>
                      <button onClick={() => setPreviewPageNum(totalPreviewPages)} disabled={previewPage === totalPreviewPages} style={s.pageBtn}>Last</button>
                    </div>
                  )}
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, ...s.stickyCol1, width: 90, zIndex: 6, top: 0 }}>
                            <div style={s.thLabel}>Status</div>
                          </th>
                          <th style={{ ...s.th, ...s.stickyCol2, zIndex: 6, top: 0 }}>
                            <div style={s.thLabel}>Unique Key</div>
                            <input
                              style={s.thSearch}
                              placeholder="Search key…"
                              value={keyFilter}
                              onChange={e => setKeyFilter(e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                          </th>
                          {EDITABLE_COLUMNS.map(col => {
                            const hasFilter = !!(colFilters[col.key] || '').trim();
                            const isRequired = !!(RULES[col.key]?.required);
                            return (
                              <th key={col.key} style={{ ...s.th, top: 0, background: hasFilter ? '#1a3a80' : '#0b1e45' }}>
                                <div style={s.thLabel}>
                                  {col.label}
                                  {isRequired && <span style={s.requiredDot} title="Required">*</span>}
                                </div>
                                <input
                                  style={s.thSearch}
                                  placeholder="Search…"
                                  value={colFilters[col.key] || ''}
                                  onChange={e => handleColFilter(col.key, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                />
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => (
                          <PreviewRow
                            key={row.id}
                            row={row}
                            isDiscard={rowStatus[row.id] === 'discard'}
                            rowErrs={rowErrors[row.id] || EMPTY_ERRS}
                            toggleStatus={toggleStatus}
                            handleCellEdit={handleCellEdit}
                          />
                        ))}
                        {pageRows.length === 0 && (
                          <tr>
                            <td colSpan={EDITABLE_COLUMNS.length + 2} style={{ ...s.td, textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              No rows match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Committed data viewer */}
        {viewOpen && (() => {
          const VIEW_COLS = [
            { key: 'est_no', label: 'Est. No' },
            { key: 'establishment', label: 'Establishment' },
            { key: 'substance', label: 'Substance' },
            { key: 'specie', label: 'Specie' },
            { key: 'sample_type', label: 'Sample Type' },
            { key: 'sample_ref', label: 'Sample Ref.' },
            { key: 'job_number', label: 'Job Number' },
            { key: 'sample_id', label: 'Sample ID' },
            { key: 'pooled_or_single', label: 'Pooled/Single' },
            { key: 'farm_name', label: 'Farm Name' },
            { key: 'district', label: 'District' },
            { key: 'state_vet_area', label: 'State Vet Area' },
            { key: 'province', label: 'Province' },
            { key: 'authorised_person', label: 'Authorised Person' },
            { key: 'owner', label: 'Owner' },
            { key: 'authority_sampling', label: 'Authority Sampling' },
            { key: 'date_collected', label: 'Date Collected' },
            { key: 'date_signed', label: 'Date Signed' },
            { key: 'date_received_lab', label: 'Date Rcvd Lab' },
            { key: 'date_registered', label: 'Date Registered' },
            { key: 'date_captured', label: 'Date Captured' },
            { key: 'reason_not_analysed', label: 'Reason Not Analysed' },
            { key: 'date_completed_1', label: 'Date Comp 1' },
            { key: 'date_completed_2', label: 'Date Comp 2' },
            { key: 'date_completed_3', label: 'Date Comp 3' },
            { key: 'date_completed_4', label: 'Date Comp 4' },
            { key: 'date_completed_5', label: 'Date Comp 5' },
            { key: 'date_completed_6', label: 'Date Comp 6' },
            { key: 'date_completed_7', label: 'Date Comp 7' },
            { key: 'results_1', label: 'Results 1' },
            { key: 'substance_results_1', label: 'Substance Results 1' },
            { key: 'ppb_results_1', label: 'ppb Results 1' },
            { key: 'results_2', label: 'Results 2' },
            { key: 'substance_results_2', label: 'Substance Results 2' },
            { key: 'ppb_results_2', label: 'ppb Results 2' },
            { key: 'results_3', label: 'Results 3' },
            { key: 'substance_results_3', label: 'Substance Results 3' },
            { key: 'ppb_results_3', label: 'ppb Results 3' },
            { key: 'results_4', label: 'Results 4' },
            { key: 'substance_results_4', label: 'Substance Results 4' },
            { key: 'ppb_results_4', label: 'ppb Results 4' },
            { key: 'results_5', label: 'Results 5' },
            { key: 'substance_results_5', label: 'Substance Results 5' },
            { key: 'ppb_results_5', label: 'ppb Results 5' },
            { key: 'results_6', label: 'Results 6' },
            { key: 'substance_results_6', label: 'Substance Results 6' },
            { key: 'ppb_results_6', label: 'ppb Results 6' },
            { key: 'results_7', label: 'Results 7' },
            { key: 'substance_results_7', label: 'Substance Results 7' },
            { key: 'ppb_results_7', label: 'ppb Results 7' },
            { key: 'comments', label: 'Comments' },
            { key: 'non_compliant', label: 'Non-Compliant?' },
            { key: 'cost_screening', label: 'Cost Screening' },
            { key: 'cost_confirmation', label: 'Cost Confirm.' },
            { key: 'admin_cost', label: 'Admin Cost' },
            { key: 'modified_by', label: 'Modified By' },
            { key: 'modified_time', label: 'Modified Time' },
            { key: 'modified_fields', label: 'Modified Fields' },
            { key: 'old_values', label: 'Old Values' },
            { key: 'new_values', label: 'New Values' },
          ];
          const totalPages = Math.ceil(committedTotal / viewPageSize) || 1;
          const handleFilterChange = (key, value) => {
            setViewFilters(prev => ({ ...prev, [key]: value }));
            clearTimeout(viewFilterTimer.current);
            viewFilterTimer.current = setTimeout(() => { setViewPage(1); loadCommitted(1); }, 400);
          };
          return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ ...s.cardTitle, marginBottom: 2 }}>Committed Residue Monitoring Data</h2>
                {!viewLoading && !viewError && (
                  <span style={s.metaChip}>{committedTotal} total records (page {viewPage} of {totalPages})</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowAuditLog(true)} style={s.btnOutline}>Change Log</button>
                <button onClick={exportCommittedExcel} style={s.btnExport}>Export Excel</button>
                <button onClick={() => loadCommitted()} style={s.btnOutline} disabled={viewLoading}>
                  {viewLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
            {viewError && <div style={s.errorMsg}>{viewError}</div>}
            {viewLoading && <p style={s.cardDesc}>Loading records...</p>}
            {!viewLoading && !viewError && committedRows.length === 0 && (
              <p style={s.cardDesc}>No committed records found.</p>
            )}
            {!viewLoading && committedRows.length > 0 && (
              <>
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, ...s.stickyCol1View, top: 0, zIndex: 6 }}>
                          <div style={s.thLabel}>Save</div>
                        </th>
                        <th style={{ ...s.th, ...s.stickyCol2View, top: 0, zIndex: 6 }}>
                          <div style={s.thLabel}>Unique Key</div>
                        </th>
                        {VIEW_COLS.map(col => {
                          const hf = !!(viewFilters[col.key] || '').trim();
                          return (
                            <th key={col.key} style={{ ...s.th, top: 0, background: hf ? '#106ebe' : '#0078d4' }}>
                              <div style={s.thLabel}>{col.label}</div>
                              <input
                                style={s.thSearch}
                                placeholder="Search..."
                                value={viewFilters[col.key] || ''}
                                onChange={e => handleFilterChange(col.key, e.target.value)}
                                onClick={e => e.stopPropagation()}
                              />
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {committedRows.map((row) => {
                        const edits = pendingEdits[row.id] || {};
                        const hasEdits = Object.keys(edits).length > 0;
                        const stickyBg = hasEdits ? '#fff4ce' : '#f3f2f1';
                        return (
                          <tr key={row.id}>
                            <td style={{ ...s.td, ...s.stickyCol1View, background: stickyBg, textAlign: 'center' }}>
                              {hasEdits && (
                                <button
                                  onClick={() => saveViewRow(row)}
                                  style={s.btnSave}
                                  disabled={savingId === row.id}
                                >
                                  {savingId === row.id ? '...' : 'Save'}
                                </button>
                              )}
                            </td>
                            <td style={{ ...s.td, ...s.stickyCol2View, background: stickyBg }}>
                              <span style={s.keyCell}>
                                <span style={s.keyPart}>{row.species}</span>
                                <span style={s.keySep}>·</span>
                                <span style={s.keyPart}>{row.sample_ref}</span>
                                <span style={s.keySep}>·</span>
                                <span style={s.keyPart}>{row.date_collected}</span>
                                <span style={s.keySep}>·</span>
                                <span style={s.keyPart}>{row.sample_type}</span>
                              </span>
                            </td>
                            {VIEW_COLS.map(col => {
                              const val = edits[col.key] !== undefined ? edits[col.key] : (row[col.key] ?? '');
                              const isModified = edits[col.key] !== undefined;
                              return (
                                <td key={col.key} style={{ ...s.td, background: isModified ? '#fff4ce' : '#ffffff' }}>
                                  <input
                                    className="cell-input"
                                    style={{ ...s.cellInput, color: isModified ? '#8a6914' : '#323130' }}
                                    value={val}
                                    onChange={e => handleViewCellEdit(row.id, col.key, e.target.value)}
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
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => handleViewPageChange(1)} disabled={viewPage === 1} style={s.pageBtn}>First</button>
                    <button onClick={() => handleViewPageChange(viewPage - 1)} disabled={viewPage === 1} style={s.pageBtn}>Prev</button>
                    <span style={{ color: '#605e5c', fontSize: '0.82rem', padding: '6px 8px' }}>Page {viewPage} of {totalPages}</span>
                    <button onClick={() => handleViewPageChange(viewPage + 1)} disabled={viewPage === totalPages} style={s.pageBtn}>Next</button>
                    <button onClick={() => handleViewPageChange(totalPages)} disabled={viewPage === totalPages} style={s.pageBtn}>Last</button>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })()}

        {step === 'committing' && (
          <div style={s.card}><p style={s.cardDesc}>⏳ Committing records to the Residue Monitoring Database…</p></div>
        )}

        {step === 'done' && (
          <div style={s.card}>
            <div style={s.successMsg}>✅ {successMsg}</div>
            <button
              onClick={() => { setStep('idle'); setFileName(''); setSuccessMsg(''); }}
              style={{ ...s.btnPrimary, marginTop: '16px' }}
            >
              Upload Another File
            </button>
          </div>
        )}
      </div>
      <footer style={s.footer} />
      {showAuditLog && <AuditLogModal tableName="ResidueMonitoring" title="Residue Monitoring" onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  footer: { background: '#0078d4', height: '40px', marginTop: 'auto', flexShrink: 0 },
  page: { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#ffffff', overflow: 'hidden' },
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
  content: { padding: '10px 16px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' },
  card: { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '4px', padding: '22px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  cardTitle: { margin: '0 0 6px', color: '#323130', fontSize: '1.1rem', fontWeight: 600 },
  cardDesc: { margin: '0 0 16px', color: '#605e5c', fontSize: '0.85rem', lineHeight: 1.5 },
  actionRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  btnPrimary: { background: '#0078d4', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  btnOutline: { background: '#ffffff', border: '1px solid #0078d4', color: '#0078d4', borderRadius: '2px', padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  btnSuccess: { background: '#107c10', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto', transition: 'opacity 150ms' },
  btnDanger:  { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  btnMarkCommit:  { background: '#dff6dd', border: '1px solid #107c10', color: '#107c10', borderRadius: '2px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto' },
  btnMarkDiscard: { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto' },
  btnFilter:       { background: '#fff4ce', border: '1px solid #f7c948', color: '#8a6914', borderRadius: '2px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto' },
  btnFilterActive: { background: '#f7c948', border: '1px solid #d39300', color: '#3d2900', borderRadius: '2px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', width: 'auto' },
  fileLabel: { marginTop: '10px', color: '#605e5c', fontSize: '0.82rem' },
  errorMsg:   { color: '#a4262c', fontSize: '0.85rem', marginTop: '10px', background: '#fde7e9', border: '1px solid #f1707b', borderRadius: '2px', padding: '9px 14px' },
  successMsg: { color: '#107c10', fontSize: '0.9rem',  marginTop: '10px', background: '#dff6dd', border: '1px solid #107c10', borderRadius: '2px', padding: '9px 14px' },
  blockingBanner: { color: '#8a6914', fontSize: '0.84rem', background: '#fff4ce', border: '1px solid #f7c948', borderRadius: '2px', padding: '9px 14px', marginBottom: '14px' },
  toolbar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' },
  toolbarLeft: { display: 'flex', flexDirection: 'column', gap: '6px' },
  toolbarRight:{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' },
  toolbarMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  metaChip: { fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: '#f3f2f1', border: '1px solid #edebe9', color: '#323130' },
  select: { background: '#ffffff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px', padding: '6px 10px', fontSize: '0.82rem', width: 'auto', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, borderRadius: '2px', border: '1px solid #edebe9' },
  table: { borderCollapse: 'collapse', fontSize: '0.65rem', width: 'max-content', minWidth: '100%' },
  th: {
    background: '#0078d4',
    color: '#ffffff', padding: '6px 8px 4px', textAlign: 'left',
    whiteSpace: 'nowrap', fontWeight: 700,
    borderRight: '1px solid rgba(255,255,255,0.2)',
    borderBottom: '2px solid #005a9e',
    position: 'sticky', top: 0, zIndex: 3,
  },
  thLabel: { fontSize: '0.65rem', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' },
  thSearch: {
    background: '#ffffff', border: '1px solid #d0d0d0',
    borderRadius: '2px', color: '#323130', fontSize: '0.7rem',
    padding: '2px 6px', width: '100%', minWidth: '80px', outline: 'none',
  },
  requiredDot: { color: '#a4262c', fontSize: '0.85rem', lineHeight: 1 },
  stickyCol1: { position: 'sticky', left: 0,      zIndex: 4, minWidth: '90px',  maxWidth: '90px',  borderRight: '2px solid #edebe9', background: '#f3f2f1' },
  stickyCol2: { position: 'sticky', left: '90px', zIndex: 4, minWidth: '280px', maxWidth: '280px', borderRight: '2px solid #edebe9', background: '#f3f2f1' },
  td: { padding: '1px 5px', color: '#323130', whiteSpace: 'nowrap', borderRight: '1px solid #edebe9', borderBottom: '1px solid #edebe9' },
  cellInput: { background: 'transparent', border: 'none', fontSize: '0.63rem', fontFamily: 'inherit', width: '100%', minWidth: '70px', padding: '1px 2px', outline: 'none', borderRadius: '2px', color: '#323130' },
  cellErrTip: { color: '#a4262c', fontSize: '0.65rem', marginTop: '1px', lineHeight: 1.2 },
  keyCell: { display: 'flex', flexWrap: 'wrap', gap: '2px', alignItems: 'center', fontSize: '0.7rem' },
  keyPart: { color: '#0078d4', fontWeight: 600 },
  keySep:  { color: '#605e5c', fontSize: '0.65rem' },
  errBadge: { color: '#8a6914', fontSize: '0.65rem', marginTop: '2px', cursor: 'help' },
  btnRowCommit:  { background: '#107c10', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnRowDiscard: { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  stickyCol1View: { position: 'sticky', left: 0,      zIndex: 4, minWidth: '60px',  maxWidth: '60px',  borderRight: '2px solid #edebe9', background: '#f3f2f1' },
  stickyCol2View: { position: 'sticky', left: '60px', zIndex: 4, minWidth: '280px', maxWidth: '280px', borderRight: '2px solid #edebe9', background: '#f3f2f1' },
  btnSave: { background: '#107c10', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '2px 8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.67rem', width: 'auto', whiteSpace: 'nowrap' },
  btnExport: { background: '#0078d4', border: 'none', color: '#ffffff', borderRadius: '2px', padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: 'auto' },
  pageBtn: { background: '#ffffff', border: '1px solid #8a8886', color: '#0078d4', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', width: 'auto' },
  progressWrap: { marginTop: '12px' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  progressLabel: { color: '#0078d4', fontSize: '0.82rem', fontWeight: 600 },
  btnCancel: { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '4px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', width: 'auto' },
  progressBarBg: { background: '#f3f2f1', borderRadius: '2px', height: '10px', overflow: 'hidden', border: '1px solid #edebe9' },
  progressBarFill: { background: '#0078d4', height: '100%', borderRadius: '2px', transition: 'width 0.3s ease' },
};
