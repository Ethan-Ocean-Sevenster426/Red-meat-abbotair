import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const ALL_TILES = [
  {
    title: 'Training Report',
    description: 'Access and manage training records and reports.',
    icon: '📋',
    path: '/training-report',
    img: null,
    adminOnly: false,
  },
  {
    title: 'Red Meat Industry Database',
    description: 'Browse and manage the red meat industry master data.',
    icon: '🗄️',
    path: '/master-database',
    img: null,
    adminOnly: false,
  },
  {
    title: 'Residue Monitoring Report',
    description: 'View residue monitoring data and compliance reports.',
    icon: '🔬',
    path: '/residue-monitoring',
    img: null,
    adminOnly: false,
  },
  {
    title: 'ARMS Dashboard',
    description: 'Open the ARMS management and analytics dashboard.',
    icon: '📊',
    path: '/arms-dashboard',
    img: null,
    adminOnly: false,
  },
  {
    title: 'Feedlot Residue Monitoring',
    description: 'Feedlot residue monitoring programme data and reports.',
    icon: '🐄',
    path: '/feedlot-residue',
    img: null,
    adminOnly: false,
  },
  {
    title: 'Finances',
    description: 'Quotations and financial management.',
    icon: '💰',
    path: '/quotation-system',
    img: null,
    adminOnly: false,
  },
  {
    title: 'Document Library',
    description: 'Store and manage documents and files.',
    icon: '📁',
    path: '/document-library',
    img: null,
    adminOnly: false,
  },
  {
    title: 'User Management',
    description: 'Manage users, roles, and permissions.',
    icon: '👥',
    path: '/user-management',
    img: null,
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
    <div style={styles.page}>
      {/* SharePoint-style top ribbon */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.waffle}>
            <span style={styles.waffleIcon}>⋮⋮⋮</span>
          </div>
          <span style={styles.sharepointLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={styles.topBarCenter} />
        <div style={styles.topBarRight}>
          <span style={styles.userName}>{user?.name || user?.username}</span>
          <div style={styles.avatar} title={user?.name || user?.username}>
            {(user?.name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <button onClick={handleLogout} style={styles.signOutBtn}>
            Sign out
          </button>
        </div>
      </header>


      {/* Tiles */}
      <main style={styles.content}>
        <div style={styles.grid}>
          {tiles.map((tile) => (
            <button
              key={tile.path}
              onClick={() => navigate(tile.path)}
              style={styles.card}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
                e.currentTarget.style.borderColor = '#0078d4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#edebe9';
              }}
            >
              <div style={styles.cardImageArea}>
                <span style={styles.cardIcon}>{tile.icon}</span>
              </div>
              <div style={styles.cardBody}>
                <h2 style={styles.cardTitle}>{tile.title}</h2>
                <p style={styles.cardDesc}>{tile.description}</p>
              </div>
            </button>
          ))}
        </div>
      </main>

      <footer style={styles.footer} />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: '#ffffff',
  },

  /* Top blue ribbon */
  topBar: {
    background: '#0078d4',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    position: 'sticky',
    top: 0,
    zIndex: 200,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '220px',
  },
  waffle: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  waffleIcon: {
    color: '#ffffff',
    fontSize: '1.1rem',
    letterSpacing: '-1px',
  },
  sharepointLabel: {
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  topBarCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 20px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '2px',
    padding: '0 12px',
    width: '100%',
    maxWidth: '400px',
    height: '32px',
    gap: '8px',
  },
  searchIcon: {
    fontSize: '0.85rem',
    opacity: 0.8,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '0.88rem',
    width: '100%',
    margin: 0,
    padding: 0,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '220px',
    justifyContent: 'flex-end',
  },
  userName: {
    color: '#ffffff',
    fontSize: '0.85rem',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#005a9e',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
    border: '2px solid rgba(255,255,255,0.4)',
  },
  signOutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#ffffff',
    padding: '4px 12px',
    borderRadius: '2px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    width: 'auto',
    margin: 0,
  },

  /* Site title bar */
  siteBar: {
    background: '#ffffff',
    borderBottom: '1px solid #edebe9',
    padding: '0 20px',
  },
  siteBarInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    height: '52px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  siteIcon: {
    width: '36px',
    height: '36px',
    background: '#0078d4',
    color: '#ffffff',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '1rem',
  },
  siteTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#323130',
    margin: 0,
  },

  /* Toolbar */
  toolbar: {
    background: '#ffffff',
    borderBottom: '1px solid #edebe9',
    padding: '0 20px',
  },
  toolbarInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  toolbarSection: {
    fontSize: '0.82rem',
    color: '#605e5c',
  },

  /* Content area */
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 20px 60px',
    width: '100%',
  },
  sectionLabel: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#323130',
    margin: '0 0 16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },

  /* Cards */
  card: {
    background: '#ffffff',
    border: '1px solid #edebe9',
    borderRadius: '2px',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#323130',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    transition: 'box-shadow 150ms ease, border-color 150ms ease',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: '100%',
  },
  cardImageArea: {
    background: '#f3f2f1',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid #edebe9',
  },
  cardIcon: {
    fontSize: '2.8rem',
  },
  cardBody: {
    padding: '14px 16px',
  },
  cardTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#323130',
    margin: '0 0 6px',
    lineHeight: 1.3,
  },
  cardDesc: {
    fontSize: '0.8rem',
    color: '#605e5c',
    margin: 0,
    lineHeight: 1.5,
  },

  /* Footer */
  footer: {
    marginTop: 'auto',
    background: '#0078d4',
    height: '40px',
  },
};
