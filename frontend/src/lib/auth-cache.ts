// Simple in-memory cache and request deduplication for auth checks
interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  isActive: boolean;
}

interface AuthCache {
  user: User | null;
  timestamp: number;
  promise: Promise<User | null> | null;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let authCache: AuthCache = {
  user: null,
  timestamp: 0,
  promise: null
};

export function getCachedAuth() {
  // Check if cache is still valid
  if (authCache.user && Date.now() - authCache.timestamp < CACHE_DURATION) {
    return { user: authCache.user, fromCache: true };
  }
  return null;
}

export function setCachedAuth(user: User | null) {
  authCache = {
    user,
    timestamp: Date.now(),
    promise: null
  };
}

export function getAuthPromise(): Promise<User | null> | null {
  return authCache.promise;
}

export function setAuthPromise(promise: Promise<User | null> | null) {
  authCache.promise = promise;
}

export function clearAuthCache() {
  authCache = {
    user: null,
    timestamp: 0,
    promise: null
  };
}