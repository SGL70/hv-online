import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(userId) {
    const { token, user } = await api.mockLogin(userId);
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  }

  async function loginWithToken(token) {
    localStorage.setItem('token', token);
    const u = await api.me();
    setUser(u);
    return u;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  async function refreshUser() {
    const u = await api.me();
    setUser(u);
    return u;
  }

  const ROLE_LEVEL = {
    soldat:0, grpc:1, pc:2, toc:2, kvm:2, kompc:3, s4:4, batCh:5, stab:5
  };

  // Check for exact role name (not level-based)
  function isRole(role) {
    return user?.role === role;
  }

  function hasRole(minRole) {
    return (ROLE_LEVEL[user?.role] ?? -1) >= (ROLE_LEVEL[minRole] ?? 99);
  }

  // Can this user manage logistics/equipment cases?
  function isLogistics() {
    return ['kvm', 'kompc', 's4', 'batCh', 'stab'].includes(user?.role);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, logout, refreshUser, hasRole, isRole, isLogistics }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
