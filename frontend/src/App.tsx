import { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { getSession, type UserSession } from './utils/auth';

function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const activeSession = getSession();
    if (activeSession) {
      setSession(activeSession);
    }
    setCheckingAuth(false);
  }, []);

  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-family)',
        color: 'var(--text-secondary)'
      }}>
        Loading administration console...
      </div>
    );
  }

  return (
    <>
      {session ? (
        <Dashboard session={session} onLogout={() => setSession(null)} />
      ) : (
        <Login onLoginSuccess={(s) => setSession(s)} />
      )}
    </>
  );
}

export default App;
