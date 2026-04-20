import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('rmaa-current-user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('rmaa-current-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rmaa-current-user');
    }
  }, [user]);

  const login = async (email, password) => {
    setAuthLoading(true);
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        return { success: false, message: data?.message || 'Login failed' };
      }

      const data = await resp.json();
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: 'Server unavailable - check backend and SQL connection.' };
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => setUser(null);

  const value = useMemo(() => ({ user, authLoading, login, logout }), [user, authLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
