import { useState, useEffect } from 'react';

interface AuthStatus {
  isAuthenticated: boolean;
  provider: string | null;
  email: string | null;
  loading: boolean;
}

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    provider: null,
    email: null,
    loading: true,
  });

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setAuthStatus({
        isAuthenticated: data.isAuthenticated,
        provider: data.provider,
        email: data.email,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({
        isAuthenticated: false,
        provider: null,
        email: null,
        loading: false,
      });
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/status', { method: 'DELETE' });
      setAuthStatus({
        isAuthenticated: false,
        provider: null,
        email: null,
        loading: false,
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return {
    ...authStatus,
    refreshAuth: checkAuthStatus,
    logout,
  };
}