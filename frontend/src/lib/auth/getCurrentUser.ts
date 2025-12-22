import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import connectDB from '@/lib/mongodb';
import { User, IUser } from '@/models/User';

export interface AuthError {
  message: string;
  code: string;
  status: number;
}

export async function getCurrentUser(request: NextRequest): Promise<IUser | AuthError> {
  try {
    // Get JWT token from NextAuth
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.sub) {
      return {
        message: 'Not authenticated',
        code: 'NO_TOKEN',
        status: 401
      };
    }

    // Connect to database
    await connectDB();

    // Get user from MongoDB using the token subject (user ID)
    const user = await User.findById(token.sub);

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
