/**
 * JWT Authentication for Node.js Backend
 * Compatible with the frontend JWT implementation
 */
import jwt from 'jsonwebtoken';
import { IUser } from '../models/User.js';

// Load environment variables dynamically
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('JWT_SECRET environment variable is not set or is empty');
  }
  return secret;
}

function getRefreshTokenSecret(): string {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('REFRESH_TOKEN_SECRET environment variable is not set or is empty');
  }
  return secret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '4h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Helper function to convert time string to seconds
function parseTimeToSeconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return 14400; // default 4 hours
  
  const [, num, unit] = match;
  const value = parseInt(num, 10);
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 14400; // default 4 hours
  }
}

// Token payload interfaces
interface AccessTokenPayload {
  sub: string;
  userId: string;
  email: string;
  role: string;
  username: string;
  type: 'access';
  permissions?: string[];
  discountPermissions?: Record<string, boolean>;
  lastLoginAt?: Date;
  switchedBy?: string;
  originalRole?: string;
}

interface RefreshTokenPayload {
  sub: string;
  userId: string;
  type: 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface DecodedToken {
  exp?: number;
  iat?: number;
  sub?: string;
  userId?: string;
  email?: string;
  role?: string;
  username?: string;
  type?: 'access' | 'refresh';
  permissions?: string[];
  discountPermissions?: Record<string, boolean>;
}

export function generateAccessToken(
  user: IUser, 
  additionalData: Partial<Pick<AccessTokenPayload, 'permissions' | 'discountPermissions' | 'lastLoginAt' | 'switchedBy' | 'originalRole'>> = {}
): string {
  const JWT_SECRET = getJWTSecret();
  
  const payload: AccessTokenPayload = {
    sub: String(user._id),
    userId: String(user._id),
    email: user.email,
    role: user.role,
    username: user.username || user.email,
    type: 'access',
    ...additionalData
  };
  
  const signOptions: jwt.SignOptions = {
    expiresIn: parseTimeToSeconds(JWT_EXPIRES_IN),
  };
  
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

export function generateRefreshToken(user: IUser): string {
  const REFRESH_TOKEN_SECRET = getRefreshTokenSecret();
  
  const payload: RefreshTokenPayload = {
    sub: String(user._id),
    userId: String(user._id),
    type: 'refresh'
  };
  
  const signOptions: jwt.SignOptions = {
    expiresIn: parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)
  };
  
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, signOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const JWT_SECRET = getJWTSecret();
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const REFRESH_TOKEN_SECRET = getRefreshTokenSecret();
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
  } catch (error) {
    return null;
  }
}

export async function generateTokenPair(user: IUser): Promise<TokenPair> {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  return {
    accessToken,
    refreshToken
  };
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch (error) {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}