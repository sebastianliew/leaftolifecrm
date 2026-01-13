import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User.js';

// Extend Express Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// JWT payload interface
interface JWTPayload {
  userId: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// Simple in-memory cache for user data to avoid DB lookup on every request
// Cache TTL: 5 minutes, cleared on user update
interface CachedUser {
  user: IUser;
  cachedAt: number;
}

const userCache = new Map<string, CachedUser>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Export for cache invalidation from other modules (e.g., after user update)
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export function clearUserCache(): void {
  userCache.clear();
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;

    // Check cache first to avoid DB lookup on every request
    const cached = userCache.get(decoded.userId);
    const now = Date.now();

    if (cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
      // Use cached user data
      req.user = cached.user;
      next();
      return;
    }

    // Cache miss or expired - fetch from database
    const userDoc = await User.findById(decoded.userId).select('-password').lean() as IUser | null;

    if (!userDoc) {
      userCache.delete(decoded.userId); // Clear stale cache entry
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Add 'id' property since .lean() doesn't include Mongoose virtuals
    // Controllers expect user.id (string) not user._id (ObjectId)
    const user = {
      ...userDoc,
      id: userDoc._id?.toString() || decoded.userId
    } as IUser;

    // Cache the user for future requests
    userCache.set(decoded.userId, { user, cachedAt: now });

    // Attach user to request
    req.user = user;
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      
      console.error('Auth middleware error:', error.message);
    } else {
      console.error('Auth middleware error:', error);
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string | string[]) => {
  return (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};