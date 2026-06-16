import React, { useState } from 'react';
import { saveSession, type UserSession } from '../utils/auth';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid credentials');
      }

      const session: UserSession = await response.json();
      saveSession(session);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between h-screen w-full" style={{
      background: 'radial-gradient(circle at 10% 20%, rgba(6, 115, 186, 0.05) 0%, rgba(248, 250, 252, 1) 90.1%)',
      padding: '0 10%'
    }}>
      {/* Brand Intro Column */}
      <div style={{ maxWidth: '450px' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--accent-blue)', fontWeight: 800 }}>CADdirekt</h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Administration Portal
        </h2>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Manage licenses, subscription periods, customer registrations, and reseller networks in one unified dashboard.
        </p>
      </div>

      {/* Login Card Column */}
      <div className="card" style={{
        width: '400px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-color)',
        padding: '2.5rem'
      }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Log In</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Please sign in to continue
        </p>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--status-inactive)',
            padding: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.4rem'
            }}>Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.4rem'
            }}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            style={{ padding: '0.75rem', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Log In'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          CADdirekt © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};
