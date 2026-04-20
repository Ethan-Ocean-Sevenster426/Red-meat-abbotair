import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.headerTitle}>Red Meat Abattoir Association</span>
        </div>
      </header>

      <section style={s.hero}>
        <div style={s.iconWrap}>🔒</div>
        <h1 style={s.heroTitle}>Access Denied</h1>
        <p style={s.heroSub}>You do not have permission to view this page.</p>
        <div style={s.linkRow}>
          <Link to="/dashboard" style={s.link}>Go to Dashboard</Link>
          <span style={s.sep}>or</span>
          <Link to="/login" style={s.link}>Log in as a different user</Link>
        </div>
      </section>

      <footer style={s.footer} />
    </div>
  );
}

const s = {
  page:        { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#ffffff' },
  header:      { background: '#0078d4', padding: '0 32px' },
  headerInner: { maxWidth: '1200px', margin: '0 auto', height: '48px', display: 'flex', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontWeight: 600, fontSize: '1rem' },
  hero:        { textAlign: 'center', padding: '100px 24px 40px', flex: 1 },
  iconWrap:    { fontSize: '4rem', marginBottom: '16px' },
  heroTitle:   { fontSize: '1.8rem', fontWeight: 600, color: '#323130', margin: '0 0 12px' },
  heroSub:     { fontSize: '1rem', color: '#605e5c', margin: '0 0 24px' },
  linkRow:     { display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' },
  link:        { color: '#0078d4', fontSize: '0.95rem', textDecoration: 'none', fontWeight: 600 },
  sep:         { color: '#605e5c', fontSize: '0.9rem' },
  footer:      { background: '#0078d4', height: '40px', marginTop: 'auto' },
};
