import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  isPatrikUser?: string;
  exp: number;
}

export interface UserSession {
  token: string;
  username: string;
  isPatrikUser: boolean;
}

const TOKEN_KEY = 'caddirekt_admin_session';

export const saveSession = (session: UserSession) => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
};

export const getSession = (): UserSession | null => {
  const data = localStorage.getItem(TOKEN_KEY);
  if (!data) return null;

  try {
    const session: UserSession = JSON.parse(data);
    
    // Check if token is expired
    const decoded = jwtDecode<DecodedToken>(session.token);
    const currentTime = Date.now() / 1000;
    
    if (decoded.exp < currentTime) {
      removeSession();
      return null;
    }

    return session;
  } catch (error) {
    removeSession();
    return null;
  }
};

export const removeSession = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getAuthHeaders = (): Record<string, string> => {
  const session = getSession();
  if (session && session.token) {
    return {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    };
  }
  return {
    'Content-Type': 'application/json'
  };
};
