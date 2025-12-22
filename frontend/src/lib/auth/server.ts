import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-config';
import { User } from '@/models/User';
import connectDB from '@/lib/mongodb';

export interface AuthUser {
  _id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  isActive: boolean;
  featurePermissions?: Record<string, boolean | string>;
  discountPermissions?: {
    canApplyDiscounts?: boolean;
    maxDiscountPercent?: number;
    maxDiscountAmount?: number;
    unlimitedDiscounts?: boolean;
    canApplyProductDiscounts?: boolean;
    canApplyBillDiscounts?: boolean;
  };
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Get authenticated user from NextAuth session
 * Retrieves user from MongoDB using session information
 */
export async function getAuthUser(_request?: NextRequest): Promise<AuthResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    // Connect to database
    await connectDB();

    // Get user by ID from session
    const user = await User.findById(session.user.id).select('-password');

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: 'User account is inactive'
      };
    }

    return {
      success: true,
      user: {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        isActive: user.isActive,
        featurePermissions: user.featurePermissions,
        discountPermissions: user.discountPermissions
      }
    };

  } catch (error) {
    console.error('Error in getAuthUser:', error);
    return {
      success: false,
      error: 'Failed to get authenticated user'
    };
  }
}

/**
 * Get authenticated user or throw error
 * Useful for API routes that require authentication
 */
export async function requireAuthUser(request: NextRequest): Promise<AuthUser> {
  const result = await getAuthUser(request);

  if (!result.success || !result.user) {
    throw new Error(result.error || 'Authentication required');
  }

  return result.user;
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: AuthUser, role: string): boolean {
  return user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: AuthUser, roles: string[]): boolean {
  return roles.includes(user.role);
}

/**
 * Check if user is an admin (admin or super_admin)
 */
export function isAdmin(user: AuthUser): boolean {
  return hasAnyRole(user, ['admin', 'super_admin']);
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(user: AuthUser): boolean {
  return hasRole(user, 'super_admin');
}

/**
 * Get NextAuth server session
 * Returns session with user information
 */
export async function getAuthSession() {
  return await getServerSession(authOptions);
}
