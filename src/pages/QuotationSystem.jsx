import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const sections = [
  {
    title: 'New Quote Generation',
    description: 'Create and send quotations for training and support services.',
    icon: '📝',
    path: '/quotation-system/new-quote',
  },
  {
    title: 'Manage Fee Structure',
    description: 'View and manage skills programme pricing for RMAA and non-members.',
    icon: '💰',
    path: '/quotation-system/fee-structure',
  },
];

export default function QuotationSystem() {
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
        <div style={s.topBarCenter}><span style={s.pageTitle}>Finances</span></div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <main style={s.main}>
        <p style={s.sectionLabel}>Finances</p>
        <div style={s.grid}>
          {sections.map((section) => (
            <button
              key={section.path}
              onClick={() => navigate(section.path)}
              style={s.card}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'; e.currentTarget.style.borderColor = '#0078d4'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#edebe9'; }}
            >
              <div style={s.cardImageArea}>
                <span style={s.cardIcon}>{section.icon}</span>
              </div>
              <div style={s.cardBody}>
                <h2 style={s.cardTitle}>{section.title}</h2>
                <p style={s.cardDesc}>{section.description}</p>
              </div>
            </button>
          ))}
        </div>
      </main>

      <footer style={s.footer} />
    </div>
  );
}

const s = {
  page:        { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#ffffff' },
  header:      { background: '#0078d4', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', position: 'sticky', top: 0, zIndex: 100 },
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
  main:        { maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 48px', width: '100%' },
  sectionLabel:{ fontSize: '1rem', fontWeight: 600, color: '#323130', margin: '0 0 16px' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  card:        { background: '#ffffff', border: '1px solid #edebe9', borderRadius: '2px', padding: 0, cursor: 'pointer', textAlign: 'left', color: '#323130', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', transition: 'box-shadow 150ms ease, border-color 150ms ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  cardImageArea:{ background: '#f3f2f1', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #edebe9' },
  cardIcon:    { fontSize: '2.4rem' },
  cardBody:    { padding: '12px 16px' },
  cardTitle:   { fontSize: '0.92rem', fontWeight: 600, color: '#323130', margin: '0 0 4px', lineHeight: 1.3 },
  cardDesc:    { fontSize: '0.8rem', color: '#605e5c', margin: 0, lineHeight: 1.5 },
  footer:      { marginTop: 'auto', background: '#0078d4', height: '40px' },
};
