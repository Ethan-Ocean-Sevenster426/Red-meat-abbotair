import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const PROVINCE_OPTS = ['','Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];

export default function QuotationSystem() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // Steps: 'form' → 'review' → 'done'
  const [step, setStep] = useState('form');

  // Abattoir list
  const [abattoirList, setAbattoirList] = useState({ registered: [], custom: [] });
  useEffect(() => {
    fetch('/api/abattoir/names').then(r => r.json()).then(d => {
      if (Array.isArray(d.registered)) setAbattoirList(d);
    }).catch(() => {});
  }, []);

  // Form state
  const [clientName, setClientName]       = useState('');
  const [province, setProvince]           = useState('');
  const [rmaaMember, setRmaaMember]       = useState('');
  const [rc, setRc]                       = useState('');
  const [throughput, setThroughput]       = useState('');
  const [vatNumber, setVatNumber]         = useState('');
  const [clientContact, setClientContact] = useState('');
  const [telephone, setTelephone]         = useState('');
  const [cell, setCell]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [postalAddress, setPostalAddress] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [rmaaContact, setRmaaContact]     = useState('');
  const [lineItems, setLineItems]         = useState([
    { date: '', skillsProgramme: '', qty: '', slaughterTechnique: '', serviceCost: '', distance: '', accommodation: '' },
  ]);

  const [customAbattoirInput, setCustomAbattoirInput] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sending, setSending]   = useState(false);
  const [pdfData, setPdfData]   = useState(null); // { pdfBase64, fileName }
  const [success, setSuccess]   = useState('');

  // When abattoir is selected, fetch details
  const handleAbattoirSelect = async (name) => {
    setClientName(name);
    if (name === '__add_new__') return;
    if (!name) return;
    try {
      const res = await fetch(`/api/quotation/abattoir-details?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.found) {
        setRmaaMember(data.is_member || '');
        setRc(data.rc_nr || '');
        setThroughput(data.thru_put || '');
        setVatNumber(data.vat_number || '');
        if (data.province) setProvince(data.province);
      } else {
        setRmaaMember(''); setRc(''); setThroughput('');
      }
    } catch {}
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
      if (!res.ok) throw new Error(data.message || 'Failed to add');
      setAbattoirList(prev => ({ ...prev, custom: [...prev.custom, data] }));
      setClientName(data.name);
      setCustomAbattoirInput('');
    } catch (e) {
      setError('Failed to add abattoir: ' + e.message);
    }
    setAddingCustom(false);
  };

  const updateLineItem = (idx, field, value) => {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => {
    if (lineItems.length >= 3) return;
    setLineItems(prev => [...prev, { date: '', skillsProgramme: '', qty: '', slaughterTechnique: '', serviceCost: '', distance: '', accommodation: '' }]);
  };

  const removeLineItem = (idx) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const calcTotal = (item) => {
    const sc = Number(item.serviceCost) || 0;
    const dist = (Number(item.distance) || 0) * 5.5;
    const acc = Number(item.accommodation) || 0;
    return sc + dist + acc;
  };

  const grandTotal = lineItems.reduce((sum, item) => sum + calcTotal(item), 0);

  // Validate and generate PDF for review
  const handleReview = async () => {
    const missing = [];
    if (!clientName || clientName === '__add_new__') missing.push('Client Name');
    if (!province) missing.push('Province');
    if (!rmaaMember) missing.push('RMAA Member');
    if (!rc) missing.push('RC Nr');
    if (!throughput) missing.push('Throughput');
    if (!vatNumber) missing.push('VAT Number');
    if (!clientContact) missing.push('Client Contact');
    if (!telephone) missing.push('Telephone');
    if (!cell) missing.push('Cell');
    if (!email) missing.push('E-mail');
    if (!postalAddress) missing.push('Postal Address');
    if (!streetAddress) missing.push('Street Address');
    if (!rmaaContact) missing.push('RMAA Contact');
    if (lineItems.every(li => !li.date && !li.skillsProgramme)) missing.push('At least one line item');
    if (missing.length) { setError('Required: ' + missing.join(', ')); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/quotation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName, province, rmaaMember, rc, throughput, vatNumber,
          clientContact, telephone, cell, email, postalAddress, streetAddress,
          rmaaContact, lineItems: lineItems.filter(li => li.date || li.skillsProgramme),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPdfData({ pdfBase64: data.pdfBase64, xlsxBase64: data.xlsxBase64, fileName: data.fileName, folderName: data.folderName });
      setStep('review');
    } catch (e) {
      setError('Failed to generate: ' + e.message);
    }
    setLoading(false);
  };

  // Send email
  const handleSend = async () => {
    if (!pdfData) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/quotation/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, clientName, province, pdfBase64: pdfData.pdfBase64, xlsxBase64: pdfData.xlsxBase64, fileName: pdfData.fileName, folderName: pdfData.folderName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccess(`Quotation sent to ${email} and saved to Document Library.`);
      setStep('done');
    } catch (e) {
      setError('Failed to send: ' + e.message);
    }
    setSending(false);
  };

  const resetForm = () => {
    setStep('form');
    setClientName(''); setProvince(''); setRmaaMember(''); setRc(''); setThroughput('');
    setVatNumber(''); setClientContact(''); setTelephone(''); setCell(''); setEmail('');
    setPostalAddress(''); setStreetAddress(''); setRmaaContact('');
    setLineItems([{ date: '', skillsProgramme: '', qty: '', slaughterTechnique: '', serviceCost: '', distance: '', accommodation: '' }]);
    setPdfData(null); setError(''); setSuccess(''); setCustomAbattoirInput('');
  };

  const fmtCurrency = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>Finances</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={step === 'review' ? s.bodyFull : s.body}>
        <div style={step === 'review' ? s.containerFull : s.container}>

          {/* ── STEP 1: FORM ── */}
          {step === 'form' && (
            <>
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span style={s.cardIcon}>📝</span>
                  <div>
                    <div style={s.cardTitle}>New Quotation</div>
                    <div style={s.cardSub}>Fill in client and training details</div>
                  </div>
                </div>
                <div style={s.cardBody}>
                  {/* Client Details */}
                  <div style={s.sectionTitle}>Client Details</div>

                  {/* Abattoir + Province row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                    <div>
                      <label style={s.label}>Name of Client <span style={s.req}>*</span></label>
                      <select value={clientName} onChange={e => handleAbattoirSelect(e.target.value)} style={s.select}>
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
                        <option value="__add_new__">— Not in list? Add new —</option>
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Province <span style={s.req}>*</span></label>
                      <select value={province} onChange={e => setProvince(e.target.value)} style={s.select}>
                        {PROVINCE_OPTS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Add custom abattoir — uses inline style tag to avoid global CSS conflicts */}
                  <style>{`.q-add-row{display:grid;grid-template-columns:1fr 70px;margin-bottom:12px}.q-add-row input{border:1px solid #c8c6c4;border-radius:2px 0 0 2px;padding:6px 10px;font-size:.82rem;color:#323130;outline:none;background:#fff;width:100%;box-sizing:border-box;margin:0}.q-add-row .q-add-btn{background:#0078d4;color:#fff;border-radius:0 2px 2px 0;font-size:.78rem;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}`}</style>
                  <div className="q-add-row" style={{ opacity: clientName === '__add_new__' ? 1 : 0.35, pointerEvents: clientName === '__add_new__' ? 'auto' : 'none' }}>
                    <input
                      type="text"
                      placeholder="Type new abattoir name and click Add..."
                      value={customAbattoirInput}
                      onChange={e => setCustomAbattoirInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCustomAbattoir()}
                      disabled={clientName !== '__add_new__'}
                    />
                    <div className="q-add-btn" onClick={() => { if (clientName === '__add_new__' && !addingCustom) handleAddCustomAbattoir(); }}>
                      {addingCustom ? '...' : '+ Add'}
                    </div>
                  </div>

                  <div style={s.grid3}>
                    <div>
                      <label style={s.label}>RMAA Member <span style={s.req}>*</span></label>
                      <input type="text" value={rmaaMember} onChange={e => setRmaaMember(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>RC Nr <span style={s.req}>*</span></label>
                      <input type="text" value={rc} onChange={e => setRc(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Throughput (L/H) <span style={s.req}>*</span></label>
                      <input type="text" value={throughput} onChange={e => setThroughput(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>VAT Number <span style={s.req}>*</span></label>
                      <input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Client Contact <span style={s.req}>*</span></label>
                      <input type="text" value={clientContact} onChange={e => setClientContact(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Telephone <span style={s.req}>*</span></label>
                      <input type="text" value={telephone} onChange={e => setTelephone(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Cell <span style={s.req}>*</span></label>
                      <input type="text" value={cell} onChange={e => setCell(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>E-mail <span style={s.req}>*</span></label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={s.input} />
                    </div>
                    <div style={s.fieldSpan2}>
                      <label style={s.label}>Postal Address <span style={s.req}>*</span></label>
                      <input type="text" value={postalAddress} onChange={e => setPostalAddress(e.target.value)} style={s.input} />
                    </div>
                    <div style={s.fieldSpan2}>
                      <label style={s.label}>Street Address <span style={s.req}>*</span></label>
                      <input type="text" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>RMAA Contact <span style={s.req}>*</span></label>
                      <input type="text" value={rmaaContact} onChange={e => setRmaaContact(e.target.value)} style={s.input} />
                    </div>
                  </div>

                  {/* Line Items */}
                  <div style={{ ...s.sectionTitle, marginTop: 24 }}>Training Line Items</div>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Date</th>
                        <th style={s.th}>Skills Programme</th>
                        <th style={{ ...s.th, width: 50 }}>Qty</th>
                        <th style={s.th}>Slaughter Technique</th>
                        <th style={s.th}>Service Cost (R)</th>
                        <th style={s.th}>Distance (km)</th>
                        <th style={s.th}>Accomm (R)</th>
                        <th style={s.th}>Total</th>
                        <th style={{ ...s.th, width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, i) => (
                        <tr key={i}>
                          <td style={s.td}>{i + 1}</td>
                          <td style={s.td}><input type="date" value={item.date} onChange={e => updateLineItem(i, 'date', e.target.value)} style={s.cellInput} /></td>
                          <td style={s.td}><input type="text" value={item.skillsProgramme} onChange={e => updateLineItem(i, 'skillsProgramme', e.target.value)} style={s.cellInput} /></td>
                          <td style={s.td}><input type="number" value={item.qty} onChange={e => updateLineItem(i, 'qty', e.target.value)} style={{ ...s.cellInput, width: 50 }} placeholder="x" /></td>
                          <td style={s.td}><input type="text" value={item.slaughterTechnique} onChange={e => updateLineItem(i, 'slaughterTechnique', e.target.value)} style={s.cellInput} /></td>
                          <td style={s.td}><input type="number" value={item.serviceCost} onChange={e => updateLineItem(i, 'serviceCost', e.target.value)} style={{ ...s.cellInput, width: 90 }} /></td>
                          <td style={s.td}><input type="number" value={item.distance} onChange={e => updateLineItem(i, 'distance', e.target.value)} style={{ ...s.cellInput, width: 80 }} /></td>
                          <td style={s.td}><input type="number" value={item.accommodation} onChange={e => updateLineItem(i, 'accommodation', e.target.value)} style={{ ...s.cellInput, width: 90 }} /></td>
                          <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtCurrency(calcTotal(item))}</td>
                          <td style={s.td}>
                            {lineItems.length > 1 && <button onClick={() => removeLineItem(i)} style={s.removeBtn}>✕</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={8} style={{ ...s.td, textAlign: 'right', fontWeight: 700, background: '#f3f2f1' }}>Grand Total (excl. VAT)</td>
                        <td style={{ ...s.td, fontWeight: 700, background: '#f3f2f1', whiteSpace: 'nowrap' }}>{fmtCurrency(grandTotal)}</td>
                        <td style={{ ...s.td, background: '#f3f2f1' }}></td>
                      </tr>
                    </tfoot>
                  </table>
                  {lineItems.length < 3 && (
                    <button onClick={addLineItem} style={s.addLineBtn}>+ Add Line Item</button>
                  )}
                </div>
              </div>

              {error && <div style={s.errorBanner}>{error}</div>}

              <div style={s.actions}>
                <button onClick={resetForm} style={s.btnCancel}>Clear</button>
                <button onClick={handleReview} style={s.btnPrimary} disabled={loading}>
                  {loading ? 'Generating...' : 'Review Quotation'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: REVIEW (PDF Preview) ── */}
          {step === 'review' && (
            <>
              <div style={{ ...s.card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={s.cardHeader}>
                  <span style={s.cardIcon}>📄</span>
                  <div>
                    <div style={s.cardTitle}>Review Quotation</div>
                    <div style={s.cardSub}>{pdfData?.fileName} — Review before sending to {email}</div>
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  {pdfData && (
                    <iframe
                      title="Quotation PDF Preview"
                      src={`data:application/pdf;base64,${pdfData.pdfBase64}`}
                      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    />
                  )}
                </div>
              </div>

              {error && <div style={s.errorBanner}>{error}</div>}

              <div style={s.actions}>
                <button onClick={() => { setStep('form'); setPdfData(null); setError(''); }} style={s.btnCancel}>← Back to Edit</button>
                {pdfData && (
                  <button onClick={() => {
                    const blob = new Blob([Uint8Array.from(atob(pdfData.pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = pdfData.fileName; a.click();
                    URL.revokeObjectURL(url);
                  }} style={s.btnOutline}>
                    Download PDF
                  </button>
                )}
                <button onClick={handleSend} style={s.btnPrimary} disabled={sending}>
                  {sending ? 'Sending...' : `Send to ${email}`}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: DONE ── */}
          {step === 'done' && (
            <>
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span style={s.cardIcon}>✅</span>
                  <div>
                    <div style={s.cardTitle}>Quotation Sent</div>
                    <div style={s.cardSub}>Emailed to {email} and saved to Document Library</div>
                  </div>
                </div>
                <div style={{ ...s.cardBody, textAlign: 'center', padding: '40px 24px' }}>
                  {success && <div style={s.successBanner}>{success}</div>}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={resetForm} style={s.btnPrimary}>New Quotation</button>
                    <button onClick={() => navigate('/dashboard')} style={s.btnOutline}>Back to Dashboard</button>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const s = {
  page:        { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#f3f2f1', overflow: 'hidden' },
  header:      { background: '#0078d4', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
  topBarLeft:  { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' },
  backBtn:     { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '2px', padding: '0 10px', cursor: 'pointer', fontSize: '0.9rem', width: 'auto', height: '28px', display: 'flex', alignItems: 'center', lineHeight: 1 },
  waffle:      { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' },
  waffleIcon:  { color: '#fff', fontSize: '1.1rem', letterSpacing: '-1px' },
  siteLabel:   { color: '#fff', fontSize: '0.95rem', fontWeight: 600 },
  topBarCenter:{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' },
  pageTitle:   { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 400 },
  topBarRight: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px', justifyContent: 'flex-end' },
  userName:    { color: '#fff', fontSize: '0.85rem' },
  avatar:      { width: '32px', height: '32px', borderRadius: '50%', background: '#005a9e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.4)' },
  signOutBtn:  { background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '4px 12px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', width: 'auto', margin: 0 },

  body:        { flex: 1, overflow: 'auto', padding: '16px' },
  bodyFull:    { flex: 1, overflow: 'hidden', padding: '8px', display: 'flex', flexDirection: 'column' },
  container:   { maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 },
  containerFull: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 },

  // Card
  card:        { background: '#fff', border: '1px solid #edebe9', borderRadius: '2px', overflow: 'hidden' },
  cardHeader:  { background: '#0078d4', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 },
  cardIcon:    { fontSize: '1.3rem', filter: 'grayscale(1) brightness(10)' },
  cardTitle:   { color: '#fff', fontWeight: 600, fontSize: '0.95rem' },
  cardSub:     { color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 1 },
  cardBody:    { padding: '18px 20px' },

  sectionTitle:{ fontSize: '0.78rem', fontWeight: 700, color: '#0078d4', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #0078d4' },

  grid3:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px' },
  fieldSpan2:  { gridColumn: 'span 2', minWidth: 0, overflow: 'hidden' },
  label:       { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#605e5c', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.02em' },
  req:         { color: '#d13438' },
  input:       { width: '100%', boxSizing: 'border-box', border: '1px solid #c8c6c4', borderRadius: '2px', padding: '6px 10px', fontSize: '0.82rem', color: '#323130', outline: 'none', background: '#fff' },
  select:      { width: '100%', boxSizing: 'border-box', border: '1px solid #c8c6c4', borderRadius: '2px', padding: '6px 10px', fontSize: '0.82rem', color: '#323130', outline: 'none', background: '#fff', cursor: 'pointer' },

  // Table
  table:       { borderCollapse: 'collapse', width: '100%', marginTop: 8 },
  th:          { background: '#0078d4', color: '#fff', padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.18)' },
  td:          { padding: '4px 8px', borderBottom: '1px solid #edebe9', borderRight: '1px solid #f5f4f3', fontSize: '0.78rem', color: '#323130', verticalAlign: 'middle' },
  cellInput:   { border: '1px solid #edebe9', borderRadius: '2px', padding: '4px 6px', fontSize: '0.78rem', outline: 'none', background: '#fafafa', width: '100%', boxSizing: 'border-box' },
  removeBtn:   { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.7rem' },
  addLineBtn:  { background: '#fff', border: '1px solid #0078d4', color: '#0078d4', borderRadius: '2px', padding: '5px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, marginTop: 8 },
  btnAddCustom:{ background: '#0078d4', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '2px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, width: 'auto', lineHeight: 1 },

  // Review
  reviewGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 16px' },
  reviewItem:  { display: 'flex', flexDirection: 'column', gap: 2 },
  reviewLabel: { fontSize: '0.68rem', fontWeight: 600, color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.02em' },
  reviewVal:   { fontSize: '0.85rem', color: '#323130', fontWeight: 500 },

  // Actions
  actions:     { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '4px 0' },
  btnPrimary:  { background: '#107c10', border: 'none', color: '#fff', borderRadius: '2px', padding: '8px 24px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  btnCancel:   { background: '#fff', border: '1px solid #8a8886', color: '#323130', borderRadius: '2px', padding: '8px 20px', cursor: 'pointer', fontSize: '0.85rem' },
  btnOutline:  { background: '#fff', border: '1px solid #0078d4', color: '#0078d4', borderRadius: '2px', padding: '8px 20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 },

  // Banners
  errorBanner:   { background: '#fde7e9', border: '1px solid #f1707b', color: '#a4262c', borderRadius: '2px', padding: '8px 14px', fontSize: '0.82rem' },
  successBanner: { background: '#dff6dd', border: '1px solid #107c10', color: '#107c10', borderRadius: '2px', padding: '8px 14px', fontSize: '0.82rem', marginBottom: 8 },
};
