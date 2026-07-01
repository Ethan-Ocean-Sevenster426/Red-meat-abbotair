import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const ALL_TILES = [
  {
    title: 'Training Report',
    description: 'Access and manage training records and reports.',
    icon: '📋',
    path: '/training-report',
    accent: '#0078d4',
    adminOnly: false,
  },
  {
    title: 'Red Meat Industry Database',
    description: 'Browse and manage the red meat industry master data.',
    icon: '🗄️',
    path: '/master-database',
    accent: '#107c10',
    adminOnly: false,
  },
  {
    title: 'Residue Monitoring Report',
    description: 'View residue monitoring data and compliance reports.',
    icon: '🔬',
    path: '/residue-monitoring',
    accent: '#ca5010',
    adminOnly: false,
  },
  {
    title: 'ARMS Dashboard',
    description: 'Open the ARMS management and analytics dashboard.',
    icon: '📊',
    path: '/arms-dashboard',
    accent: '#8764b8',
    adminOnly: false,
  },
  {
    title: 'Feedlot Residue Monitoring',
    description: 'Feedlot residue monitoring programme data and reports.',
    icon: '🐄',
    path: '/feedlot-residue',
    accent: '#008272',
    adminOnly: false,
  },
  {
    title: 'Finances',
    description: 'Quotations and financial management.',
    icon: '💰',
    path: '/quotation-system',
    accent: '#986f0b',
    adminOnly: false,
  },
  {
    title: 'Document Library',
    description: 'Store and manage documents and files.',
    icon: '📁',
    path: '/document-library',
    accent: '#4f6bed',
    adminOnly: false,
  },
  {
    title: 'User Management',
    description: 'Manage users, roles, and permissions.',
    icon: '👥',
    path: '/user-management',
    accent: '#d13438',
    adminOnly: true,
  },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const tiles = ALL_TILES.filter(tile => !tile.adminOnly || user?.role === 'admin');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={s.page}>
      <header style={s.topBar}>
        <div style={s.topBarLeft}>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.appName}>Red Meat Abattoir Association</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.name || user?.username}</span>
          <div style={s.avatar}>{(user?.name || user?.username || 'U')[0].toUpperCase()}</div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      <div style={s.siteHeader}>
        <div style={s.siteHeaderInner}>
          <div style={s.siteLogo}>R</div>
          <div>
            <div style={s.siteTitle}>RMAA ERP</div>
            <div style={s.siteSubtitle}>Enterprise Resource Platform</div>
          </div>
        </div>
      </div>

      <main style={s.content}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Quick Access</h2>
          <div style={s.sectionLine} />
        </div>
        <div style={s.grid}>
          {tiles.map((tile) => (
            <button
              key={tile.path}
              onClick={() => navigate(tile.path)}
              style={s.card}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ ...s.cardAccent, background: tile.accent }} />
              <div style={s.cardContent}>
                <div style={{ ...s.cardIconWrap, background: tile.accent + '14' }}>
                  <span style={s.cardIcon}>{tile.icon}</span>
                </div>
                <div style={s.cardText}>
                  <div style={s.cardTitle}>{tile.title}</div>
                  <div style={s.cardDesc}>{tile.description}</div>
                </div>
                <div style={s.cardArrow}>›</div>
              </div>
            </button>
          ))}
        </div>
      </main>

    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: '#faf9f8',
  },
  topBar: {
    background: '#0078d4',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    position: 'sticky',
    top: 0,
    zIndex: 200,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  waffle: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    cursor: 'pointer',
  },
  waffleIcon: { color: '#fff', fontSize: '1.1rem', letterSpacing: -1 },
  appName: { color: '#fff', fontSize: '0.9rem', fontWeight: 600 },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userName: { color: '#fff', fontSize: '0.84rem' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#005a9e',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    border: '2px solid rgba(255,255,255,0.35)',
  },
  signOutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    padding: '4px 14px',
    borderRadius: 4,
    fontSize: '0.8rem',
    cursor: 'pointer',
    width: 'auto',
    margin: 0,
    transition: 'background 150ms',
  },
  siteHeader: {
    background: '#fff',
    borderBottom: '1px solid #edebe9',
    padding: '0 24px',
  },
  siteHeaderInner: {
    height: 64,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  siteLogo: {
    width: 40,
    height: 40,
    borderRadius: 6,
    background: '#0078d4',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '1.15rem',
  },
  siteTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#323130',
    lineHeight: 1.2,
  },
  siteSubtitle: {
    fontSize: '0.78rem',
    color: '#8a8886',
    lineHeight: 1.2,
  },
  content: {
    padding: '28px 32px 60px',
    width: '100%',
    flex: 1,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#323130',
    margin: 0,
    whiteSpace: 'nowrap',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: '#edebe9',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#fff',
    border: '1px solid #e1dfdd',
    borderRadius: 6,
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#323130',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    transition: 'box-shadow 200ms ease, transform 200ms ease',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  cardAccent: {
    width: 4,
    flexShrink: 0,
    borderRadius: '6px 0 0 6px',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 22px',
    flex: 1,
    minWidth: 0,
  },
  cardIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIcon: {
    fontSize: '1.7rem',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#323130',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  cardDesc: {
    fontSize: '0.82rem',
    color: '#605e5c',
    margin: 0,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardArrow: {
    fontSize: '1.3rem',
    color: '#c8c6c4',
    flexShrink: 0,
    fontWeight: 300,
  },
};
