import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user, authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const result = await login(email.trim(), password.trim());
    if (!result.success) {
      setError(result.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-topbar">
        <span className="login-topbar-brand">Red Meat Abattoir Association</span>
      </div>
      <div className="login-body">
        <div className="container">
          <h1>Sign in</h1>
          <p className="login-subtitle">Use your RMAA account credentials to sign in.</p>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              required
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
