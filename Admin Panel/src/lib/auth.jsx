import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/api/users/me');
      if (data.success && data.data.user.role === 'admin') {
        setAdmin({ ...data.data.user, profile: data.data.profile });
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch {
      localStorage.removeItem('adminToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMe(); }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    const token = data?.data?.accessToken || data?.data?.token;
    if (!data.success || !token) throw new Error(data.message || 'Login failed');
    if (data.data.user.role !== 'admin') throw new Error('This account is not an admin.');
    localStorage.setItem('adminToken', token);
    await loadMe();
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setAdmin(null);
    location.href = '/login';
  };

  return (
    <AuthCtx.Provider value={{ admin, loading, login, logout, refresh: loadMe }}>
      {children}
    </AuthCtx.Provider>
  );
}
