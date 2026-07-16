import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email.trim(), password);
      nav('/');
    } catch (e) {
      setErr(e.response?.data?.message || e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div style={{ textAlign: 'center', color: 'var(--blue)' }}><UserCircle size={48} /></div>
        <h1>Admin Login</h1>
        <div className="sub">Please enter your login credentials to continue</div>

        <label>Login ID</label>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />

        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  );
}
