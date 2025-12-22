'use client';

import { useEffect, useState } from 'react';
import { Shield, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RootUserInfo {
  username: string;
  role: string;
}

export const RootSessionIndicator: React.FC = () => {
  const [isRootSession, setIsRootSession] = useState(false);
  const [rootUserInfo, setRootUserInfo] = useState<RootUserInfo | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);

  useEffect(() => {
    // Check if this is a root session
    const rootInfo = sessionStorage.getItem('rootUserInfo');
    const rootSessionCookie = document.cookie.includes('rootSession=true');
    
    if (rootInfo || rootSessionCookie) {
      setIsRootSession(true);
      if (rootInfo) {
        try {
          setRootUserInfo(JSON.parse(rootInfo));
        } catch {
          // Failed to parse root user info
        }
      }
    }
  }, []);

  const handleEndRootSession = async () => {
    if (confirm('Are you sure you want to end the root session? You will be logged out.')) {
      // Clear session storage
      sessionStorage.removeItem('rootUserInfo');
      sessionStorage.removeItem('isRootSession');
      
      // Logout
      window.location.href = '/signout';
    }
  };

  if (!isRootSession) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge 
          variant="destructive" 
          className="shadow-lg cursor-pointer hover:scale-105 transition-transform p-2"
          onClick={() => setIsMinimized(false)}
        >
          <Shield className="h-4 w-4" />
        </Badge>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Root Session Active</h3>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm text-red-800">
            You are operating as a regular user with root oversight.
          </p>
          
          {rootUserInfo && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-red-700">Root User:</span>
              <Badge variant="destructive" className="text-xs">
                {rootUserInfo.username} ({rootUserInfo.role})
              </Badge>
            </div>
          )}
          
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndRootSession}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              End Root Session
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini version for navbar
export const RootSessionBadge: React.FC = () => {
  const [isRootSession, setIsRootSession] = useState(false);

  useEffect(() => {
    const rootInfo = sessionStorage.getItem('rootUserInfo');
    const rootSessionCookie = document.cookie.includes('rootSession=true');
    setIsRootSession(!!(rootInfo || rootSessionCookie));
  }, []);

  if (!isRootSession) {
    return null;
  }

  return (
    <Badge variant="destructive" className="flex items-center space-x-1">
      <Shield className="h-3 w-3" />
      <span>Root Session</span>
    </Badge>
  );
};