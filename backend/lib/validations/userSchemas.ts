import { z } from 'zod';

// Base user schema
export const userBaseSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters'),
  
  role: z.enum(['super_admin', 'admin', 'manager', 'staff'], {
    message: 'Role must be super_admin, admin, manager, or staff'
  }),
  
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .optional(),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters')
    .optional(),
  
  displayName: z.string()
    .max(200, 'Display name must be less than 200 characters')
    .optional()
});

// Password validation schema
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

// Discount permissions schema
export const discountPermissionsSchema = z.object({
  canApplyDiscounts: z.boolean().default(false),
  maxDiscountPercent: z.number()
    .min(0, 'Max discount percent cannot be negative')
    .max(100, 'Max discount percent cannot exceed 100'),
  maxDiscountAmount: z.number()
    .min(0, 'Max discount amount cannot be negative'),
  unlimitedDiscounts: z.boolean().default(false),
  canApplyProductDiscounts: z.boolean().default(false),
  canApplyBillDiscounts: z.boolean().default(true)
});

// Permission schema
export const permissionSchema = z.object({
  resource: z.string().min(1, 'Resource is required'),
  actions: z.array(z.enum(['create', 'read', 'update', 'delete', 'unlimited']))
    .min(1, 'At least one action is required'),
  limits: z.object({
    maxDiscountPercent: z.number().min(0).max(100).optional(),
    maxDiscountAmount: z.number().min(0).optional(),
    requiresApproval: z.boolean().optional(),
    maxQuantity: z.number().min(0).optional(),
    maxValue: z.number().min(0).optional()
  }).optional()
});

// Create user schema
export const createUserSchema = userBaseSchema.extend({
  password: passwordSchema,
  discountPermissions: discountPermissionsSchema.optional(),
  permissions: z.array(permissionSchema).optional(),
  createdBy: z.string().optional()
});

// Update user schema
export const updateUserSchema = userBaseSchema.partial().extend({
  isActive: z.boolean().optional(),
  discountPermissions: discountPermissionsSchema.optional(),
  permissions: z.array(permissionSchema).optional(),
  lastModifiedBy: z.string().optional()
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
});

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

// Password reset confirm schema
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine((data: { newPassword: string; confirmPassword: string }) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// User query filters schema
export const userFiltersSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'manager', 'staff']).optional(),
  active: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['username', 'email', 'role', 'createdAt', 'lastLogin']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Bulk user operations schema
export const bulkUserOperationSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, 'At least one user ID is required'),
  operation: z.enum(['activate', 'deactivate', 'delete', 'updateRole']),
  data: z.object({
    role: z.enum(['super_admin', 'admin', 'manager', 'staff']).optional(),
    isActive: z.boolean().optional()
  }).optional()
});

// User permission check schema
export const permissionCheckSchema = z.object({
  resource: z.string().min(1, 'Resource is required'),
  action: z.enum(['create', 'read', 'update', 'delete', 'unlimited']),
  context: z.object({
    targetUserId: z.string().optional(),
    resourceId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

// Discount application schema
export const discountApplicationSchema = z.object({
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  targetType: z.enum(['product', 'bill', 'bundle']),
  targetId: z.string().optional(),
  reason: z.string().min(1, 'Discount reason is required').max(500),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// Export types for TypeScript
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserFiltersInput = z.infer<typeof userFiltersSchema>;
export type BulkUserOperationInput = z.infer<typeof bulkUserOperationSchema>;
export type PermissionCheckInput = z.infer<typeof permissionCheckSchema>;
export type DiscountApplicationInput = z.infer<typeof discountApplicationSchema>;
export type DiscountPermissions = z.infer<typeof discountPermissionsSchema>;
export type Permission = z.infer<typeof permissionSchema>;