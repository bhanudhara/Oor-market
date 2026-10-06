import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import LoginScreen from './components/LoginScreen.jsx';
import RoleDashboard from './components/RoleDashboard.jsx';
import { fetchMarket } from './features/market/marketSlice.js';
import './auth.css';

export default function AuthApp() {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('oor-market-token');
    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired');
        return response.json();
      })
      .then(({ user: sessionUser }) => {
        setUser(sessionUser);
        dispatch(fetchMarket());
      })
      .catch(() => localStorage.removeItem('oor-market-token'))
      .finally(() => setCheckingSession(false));
  }, [dispatch]);

  async function signIn(email, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign in failed.');
    localStorage.setItem('oor-market-token', result.token);
    setUser(result.user);
    dispatch(fetchMarket());
  }

  function signOut() {
    localStorage.removeItem('oor-market-token');
    setUser(null);
  }

  if (checkingSession) return <main className="auth-loading"><span className="brand-symbol">O</span><span>Connecting to your market…</span></main>;
  return user ? <RoleDashboard user={user} onSignOut={signOut} /> : <LoginScreen onSignIn={signIn} />;
}