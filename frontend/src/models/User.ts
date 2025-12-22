import mongoose from 'mongoose';
import { UserRole } from '@/types/user';

export interface IUser {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  discountPermissions: {
    canApplyDiscounts: boolean;
    maxDiscountPercent: number;
    maxDiscountAmount: number;
    unlimitedDiscounts: boolean;
    canApplyProductDiscounts: boolean;
    canApplyBillDiscounts: boolean;
  };
  featurePermissions?: {
    discounts?: {
      canApplyProductDiscounts?: boolean;
      canApplyBillDiscounts?: boolean;
      maxDiscountPercent?: number;
      maxDiscountAmount?: number;
      unlimitedDiscounts?: boolean;
    };
    inventory?: {
      canManageProducts?: boolean;
      canViewReports?: boolean;
      canManageCategories?: boolean;
    };
    transactions?: {
      canProcessRefunds?: boolean;
      canViewAllTransactions?: boolean;
      canModifyTransactions?: boolean;
    };
    users?: {
      canManageUsers?: boolean;
      canViewAuditLogs?: boolean;
      canUpdatePasswords?: boolean;
    };
  };
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'staff', 'super_admin'], 
    required: true 
  },
  firstName: String,
  lastName: String,
  displayName: String,
  discountPermissions: {
    canApplyDiscounts: { type: Boolean, default: false },
    maxDiscountPercent: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number, default: 0 },
    unlimitedDiscounts: { type: Boolean, default: false },
    canApplyProductDiscounts: { type: Boolean, default: false },
    canApplyBillDiscounts: { type: Boolean, default: false }
  },
  featurePermissions: {
    discounts: {
      canApplyProductDiscounts: Boolean,
      canApplyBillDiscounts: Boolean,
      maxDiscountPercent: Number,
      maxDiscountAmount: Number,
      unlimitedDiscounts: Boolean
    },
    inventory: {
      canManageProducts: Boolean,
      canViewReports: Boolean,
      canManageCategories: Boolean
    },
    transactions: {
      canProcessRefunds: Boolean,
      canViewAllTransactions: Boolean,
      canModifyTransactions: Boolean
    },
    users: {
      canManageUsers: Boolean,
      canViewAuditLogs: Boolean,
      canUpdatePasswords: Boolean
    }
  },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);