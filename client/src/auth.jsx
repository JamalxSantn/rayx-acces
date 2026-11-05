import { createContext, useContext, useState, useCallback } from 'react';
import { getUser, setAuth, clearAuth } from './authStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());

  const login = useCallback((token, u) => {
    setAuth(token, u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
