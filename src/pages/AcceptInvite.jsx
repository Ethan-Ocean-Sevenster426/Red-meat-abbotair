import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState('loading'); // 'loading' | 'valid' | 'invalid' | 'expired' | 'success' | 'submitting'
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteData, setInviteData] = useState(null); // { email, displayName, invitedBy }

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('No invitation token found in this link.');
      return;
    }
    fetch(`/api/users/invite/${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (res.status === 404) { setStatus('invalid'); setErrorMsg(data.message || 'Invitation not found or already used.'); return; }
        if (res.status === 410) { setStatus('expired'); setErrorMsg(data.message || 'This invitation has expired.'); return; }
        if (!res.ok) { setStatus('invalid'); setErrorMsg(data.message || 'Could not validate invitation.'); return; }
        setInviteData(data);
        setDisplayName(data.displayName || '');
        setStatus('valid');
      })
      .catch(() => {
        setStatus('invalid');
        setErrorMsg('Network error. Please check that the server is running.');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      const res = await fetch('/api/users/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('valid');
        setFormError(data.message || 'Failed to activate account.');
        return;
      }
      setStatus('success');
    } catch (err) {
      setStatus('valid');
      setFormError('Network error: ' + err.message);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <span style={s.brand}>Red Meat Abattoir Association</span>
      </div>
      <div style={s.body}>
        <div style={s.card}>
          {status === 'loading' && (
            <div style={s.infoText}>Validating invitation...</div>
          )}

          {(status === 'invalid' || status === 'expired') && (
            <div>
              <div style={s.errorIcon}>{status === 'expired' ? '⏰' : '✗'}</div>
              <h2 style={s.cardTitle}>
                {status === 'expired' ? 'Invitation Expired' : 'Invalid Invitation'}
              </h2>
              <p style={s.errorDesc}>{errorMsg}</p>
              <Link to="/login" style={s.loginLink}>Go to Login</Link>
            </div>
          )}

          {(status === 'valid' || status === 'submitting') && inviteData && (
            <div>
              <h2 style={s.cardTitle}>Accept Invitation</h2>
              <p style={s.inviteDesc}>
                <strong>{inviteData.invitedBy}</strong> has invited you to the RMAA System.
                Set your display name and create a password to activate your account.
              </p>
              <p style={s.emailInfo}>Account email: <strong>{inviteData.email}</strong></p>
              {formError && <div style={s.errorBanner}>{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div style={s.formGroup}>
                  <label style={s.label}>Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    required
                    style={s.input}
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create a password (min. 6 characters)"
                    required
                    style={s.input}
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    style={s.input}
                  />
                </div>
                <button
                  type="submit"
                  style={status === 'submitting' ? { ...s.submitBtn, opacity: 0.7 } : s.submitBtn}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Activating...' : 'Activate Account'}
                </button>
              </form>
            </div>
          )}

          {status === 'success' && (
            <div style={s.successBox}>
              <div style={s.successIcon}>&#10003;</div>
              <h2 style={s.cardTitle}>Account Activated!</h2>
              <p style={s.successDesc}>
                Your account has been activated. You can now log in with your email and password.
              </p>
              <Link to="/login" style={s.submitBtn}>Go to Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: '#f3f2f1',
  },
  topBar: {
    background: '#0078d4',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
  },
  brand: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '1.05rem',
    letterSpacing: '0.01em',
  },
  body: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #edebe9',
    borderRadius: '2px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    padding: '36px 32px',
    width: '100%',
    maxWidth: '440px',
  },
  cardTitle: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#323130',
    margin: '0 0 14px',
  },
  infoText: {
    color: '#605e5c',
    fontSize: '0.95rem',
  },
  inviteDesc: {
    color: '#605e5c',
    fontSize: '0.9rem',
    margin: '0 0 10px',
    lineHeight: 1.5,
  },
  emailInfo: {
    color: '#323130',
    fontSize: '0.88rem',
    marginBottom: '18px',
  },
  errorIcon: {
    fontSize: '2rem',
    marginBottom: '8px',
    color: '#a4262c',
  },
  errorDesc: {
    color: '#605e5c',
    fontSize: '0.9rem',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  errorBanner: {
    background: '#fde7e9',
    border: '1px solid #d13438',
    borderRadius: '2px',
    color: '#a4262c',
    padding: '8px 12px',
    fontSize: '0.85rem',
    marginBottom: '14px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#323130',
    marginBottom: '5px',
  },
  input: {
    width: '100%',
    border: '1px solid #8a8886',
    borderRadius: '2px',
    padding: '8px 10px',
    fontSize: '0.9rem',
    color: '#323130',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submitBtn: {
    display: 'inline-block',
    background: '#0078d4',
    border: 'none',
    color: '#ffffff',
    padding: '9px 22px',
    borderRadius: '2px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    marginTop: '4px',
    width: '100%',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  loginLink: {
    display: 'inline-block',
    background: '#0078d4',
    color: '#ffffff',
    padding: '8px 20px',
    borderRadius: '2px',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: '4px',
  },
  successBox: {
    textAlign: 'center',
  },
  successIcon: {
    fontSize: '2.5rem',
    color: '#107c10',
    marginBottom: '8px',
  },
  successDesc: {
    color: '#605e5c',
    fontSize: '0.9rem',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
};
