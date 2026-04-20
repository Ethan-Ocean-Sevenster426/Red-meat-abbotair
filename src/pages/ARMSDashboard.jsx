import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function ARMSDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>ARMS Dashboard</span>
        </div>
        <div style={s.topBarRight}>
          <a href="http://www.nahdis.co.za/Account/UserProfile" target="_blank" rel="noopener noreferrer" style={s.armsBtn}>
            Open ARMS System ↗
          </a>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.body}>
        <iframe
          title="ARMS Power BI Report"
          src="https://app.powerbi.com/view?r=eyJrIjoiYzA4NDExMTAtZjFiZC00YzJhLWFmNTctM2U0YzA4OTg0MmY3IiwidCI6ImIxNTA0YjFkLWQwOTYtNDA5YS1hMGYwLTZjYzU0NmRkZTk5MyJ9"
          style={s.iframe}
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
}

const s = {
  page:        { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#f3f2f1', overflow: 'hidden' },

  header:      { background: '#0078d4', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
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
  armsBtn:     { background: '#107c10', border: '1px solid #107c10', color: '#ffffff', padding: '5px 14px', borderRadius: '2px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', lineHeight: 1, whiteSpace: 'nowrap' },

  body:        { flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', minHeight: 0 },
  iframe:      { flex: 1, width: '100%', border: '1px solid #edebe9', borderRadius: '4px', background: '#fff' },
};
