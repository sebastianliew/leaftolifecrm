import { Request } from 'express';
import jwt from 'jsonwebtoken';
import connectDB from '../lib/mongodb.js';
import { User, IUser } from '../models/User.js';

export interface AuthError {
  message: string;
  code: string;
  status: number;
}

export async function getCurrentUser(request: Request): Promise<IUser | AuthError> {
  try {
    // Get JWT token from Authorization header
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return {
        message: 'Not authenticated',
        code: 'NO_TOKEN',
        status: 401
      };
    }
    
    // Verify JWT token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: string; role?: string };
    
    if (!decoded || !decoded.userId) {
      return {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
        status: 401
      };
    }

    // Connect to database
    await connectDB();
    
    // Get user from MongoDB using the decoded user ID
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return {
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        status: 404
      };
    }
    
    if (!user.isActive) {
      return {
        message: 'User account is disabled',
        code: 'USER_DISABLED',
        status: 403
      };
    }
    
    return user;
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return {
      message: 'Authentication check failed',
      code: 'AUTH_ERROR',
      status: 500
    };
  }
}

// Type guard to check if result is an error
export function isAuthError(result: IUser | AuthError): result is AuthError {
  return 'code' in result && 'status' in result;
}