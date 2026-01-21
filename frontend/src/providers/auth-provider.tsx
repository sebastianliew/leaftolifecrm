"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  image: string | null;
  role: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Helper functions for token management
const getToken = (): string | undefined => {
  const cookieToken = Cookies.get('authToken');
  if (cookieToken) return cookieToken;
  
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken') || undefined;
  }
  
  return undefined;
};

// Token expiry in days (matches env variables)
const ACCESS_TOKEN_EXPIRY_DAYS = 1; // 24h (JWT_EXPIRES_IN)
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30d (REFRESH_TOKEN_EXPIRES_IN)

const setToken = (token: string) => {
  Cookies.set('authToken', token, {
    expires: ACCESS_TOKEN_EXPIRY_DAYS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
};

const setRefreshToken = (token: string) => {
  Cookies.set('refreshToken', token, {
    expires: REFRESH_TOKEN_EXPIRY_DAYS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
};

const removeToken = () => {
  Cookies.remove('authToken');
  Cookies.remove('refreshToken');
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Since we have route-level auth, just decode the JWT to get user info
      // The middleware ensures only valid tokens reach this point
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          
          // Check if token is expired (redundant with middleware, but good for UI state)
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            removeToken();
            setUser(null);
            setError(null);
            setLoading(false);
            return;
          }

          // Create user object from JWT payload
          const userFromToken = {
            id: payload.userId || payload.sub,
            email: payload.email,
            username: payload.username,
            name: payload.username || payload.email,
            image: null,
            role: payload.role,
            isActive: true
          };


          setUser(userFromToken);
          setError(null);
        } else {
          throw new Error('Invalid token format');
        }
      } catch {
        console.log('AuthProvider: Token validation failed');
        removeToken();
        setUser(null);
        setError(null);
      }
    } catch {
      console.error('AuthProvider: Auth check error:');
      setUser(null);
      setError('Failed to verify authentication');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('AuthProvider: Login attempt:', { email });
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server returned invalid response');
      }
      console.log('AuthProvider: Login response:', { status: response.status });

      if (response.ok) {
        console.log('AuthProvider: Login successful');
        const token = data.accessToken || data.token;
        if (token) {
          setToken(token);
        }
        // Store refresh token if provided
        if (data.refreshToken) {
          setRefreshToken(data.refreshToken);
        }
        setUser(data.user);
        setError(null);
        
        // Get redirect URL from query params or default to dashboard
        const params = new URLSearchParams(window.location.search);
        const redirectTo = params.get('redirectTo') || '/dashboard';
        router.push(redirectTo);
        
        return { success: true };
      } else {
        console.log('AuthProvider: Login failed:', data.error || data.message);
        const errorMsg = data.error || data.message || 'Login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('AuthProvider: Login error:', error);
      const errorMessage = 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = getToken();
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('AuthProvider: Logout error:', error);
    } finally {
      removeToken();
      setUser(null);
      setError(null);
      router.push('/login');
    }
  };

  const refreshAuth = async () => {
    await checkAuth();
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}