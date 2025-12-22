import { z } from 'zod'
import { commonSchemas, baseEntitySchema } from './index'

// Permission schema
export const permissionSchema = z.object({
  resource: z.string().min(1),
  actions: z.array(z.enum(['create', 'read', 'update', 'delete', 'approve'])).min(1)
})

// Role schema  
export const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required').trim(),
  description: z.string().trim().optional(),
  permissions: z.array(permissionSchema),
  isSystem: z.boolean().default(false)
})

// User schema
export const userSchema = baseEntitySchema.extend({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .trim(),
    
  email: commonSchemas.email,
  
  password: z.string(), // Hashed password in DB
  
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .trim(),
    
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .trim(),
    
  role: z.enum(['admin', 'manager', 'staff', 'viewer']),
  
  permissions: z.array(z.string()).default([]),
  
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  
  lastLogin: z.string().datetime().optional(),
  loginAttempts: z.number().int().nonnegative().default(0),
  lockedUntil: z.string().datetime().optional(),
  
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    language: z.string().default('en'),
    notifications: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
      sms: z.boolean().default(false)
    }).default({ email: true, push: true, sms: false })
  }).default({ 
    theme: 'system', 
    language: 'en', 
    notifications: { email: true, push: true, sms: false } 
  }),
  
  metadata: z.record(z.string(), z.unknown()).optional()
})

// User registration schema
export const userRegistrationSchema = z.object({
  username: userSchema.shape.username,
  email: userSchema.shape.email,
  password: commonSchemas.password,
  confirmPassword: z.string(),
  firstName: userSchema.shape.firstName,
  lastName: userSchema.shape.lastName,
  role: userSchema.shape.role.default('staff')
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }
)

// User login schema
export const userLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
})

// User update schema
export const updateUserSchema = userSchema.pick({
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  permissions: true,
  isActive: true,
  preferences: true
}).partial()

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: commonSchemas.password,
  confirmPassword: z.string()
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }
)

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: commonSchemas.password,
  confirmPassword: z.string()
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }
)

// Type exports
export type User = z.infer<typeof userSchema>
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>
export type UserLoginInput = z.infer<typeof userLoginSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type Permission = z.infer<typeof permissionSchema>
export type Role = z.infer<typeof roleSchema>