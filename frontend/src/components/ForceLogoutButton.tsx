"use client";

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export function ForceLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleForceLogout = async () => {
    setIsLoggingOut(true);
    try {
      
      // Clear all local storage
      localStorage.clear();
      
      // Clear all session storage
      sessionStorage.clear();
      
      // Sign out from NextAuth
      try {
        await signOut({ redirect: false });
      } catch (authError) {
        console.error('🔍 FORCE LOGOUT: NextAuth signout error:', authError);
      }
      
      // Clear all cookies (client-side attempt)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      
      // Force reload to clear any cached state
      window.location.href = '/login';
      
    } catch (error) {
      console.error('🔍 FORCE LOGOUT: Error during logout:', error);
      // Force redirect anyway
      window.location.href = '/login';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      backgroundColor: '#ef4444',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <button 
        onClick={handleForceLogout}
        disabled={isLoggingOut}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: isLoggingOut ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        {isLoggingOut ? 'Logging out...' : 'Force Logout'}
      </button>
    </div>
  );
}