// Prevent client-side import (backend version)
// This check is not needed in pure backend environment
// if (typeof window !== 'undefined' && typeof process === 'undefined') {
//   throw new Error('User model cannot be imported on the client side');
// }

import mongoose, { Schema, Document } from 'mongoose';

// Define FeaturePermissions interface locally
interface FeaturePermissions {
  [category: string]: {
    [permission: string]: boolean;
  };
}

export interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  name: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  photoURL?: string;
  image?: string | null;
  role: 'super_admin' | 'admin' | 'manager' | 'staff' | 'user';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  authProvider?: string;
  featurePermissions?: Partial<FeaturePermissions>;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  failedLoginAttempts?: number;
  lastFailedLogin?: Date;
  isTemporary?: boolean;
  temporaryExpiresAt?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  
  // Permission check methods
  hasPermission(category: string, permission: string): boolean;
  canPerformAction(resource: string, action: string): boolean;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: function(this: IUser): boolean {
      return this.authProvider === 'credentials' || !this.authProvider;
    },
    select: false // Don't include password in queries by default
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  photoURL: {
    type: String
  },
  image: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'staff', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  authProvider: {
    type: String,
    default: 'credentials'
  },
  featurePermissions: {
    type: Schema.Types.Mixed,
    default: {}
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lastFailedLogin: {
    type: Date
  },
  isTemporary: {
    type: Boolean,
    default: false
  },
  temporaryExpiresAt: {
    type: Date
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});

// Permission check methods
userSchema.methods.hasPermission = function(category: string, permission: string): boolean {
  // Super admin has all permissions
  if (this.role === 'super_admin') {
    return true;
  }

  // Check if user has an explicit override for this permission
  if (this.featurePermissions &&
      this.featurePermissions[category] &&
      permission in this.featurePermissions[category]) {
    const value = this.featurePermissions[category][permission];
    // Return the boolean value (explicit true or false)
    return typeof value === 'boolean' ? value : !!value;
  }

  // No explicit permission set - return false (conservative default)
  return false;
};

userSchema.methods.canPerformAction = function(resource: string, action: string): boolean {
  // Legacy method for backward compatibility
  // Map to new permission system based on resource/action
  const permissionMap: Record<string, { category: string; permission: string }> = {
    'inventory:create': { category: 'inventory', permission: 'canAddProducts' },
    'inventory:update': { category: 'inventory', permission: 'canEditProducts' },
    'inventory:delete': { category: 'inventory', permission: 'canDeleteProducts' },
    'users:create': { category: 'userManagement', permission: 'canCreateUsers' },
    'users:update': { category: 'userManagement', permission: 'canEditUsers' },
    'users:delete': { category: 'userManagement', permission: 'canDeleteUsers' },
    'transactions:create': { category: 'transactions', permission: 'canCreateTransactions' },
    'transactions:update': { category: 'transactions', permission: 'canEditTransactions' },
    'transactions:delete': { category: 'transactions', permission: 'canDeleteTransactions' },
  };
  
  const key = `${resource}:${action}`;
  const mapping = permissionMap[key];
  
  if (mapping) {
    return this.hasPermission(mapping.category, mapping.permission);
  }
  
  // Default to false for unmapped permissions
  return false;
};

// Create text index for search
userSchema.index({ email: 'text', username: 'text', displayName: 'text' });

// Compound index for efficient queries
userSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);