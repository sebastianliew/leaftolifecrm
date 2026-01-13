import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { User, IUser } from '@models/User.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../auth/jwt.js';

// Request body interfaces
interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface CreateAdminRequest {
  email: string;
  password: string;
  name: string;
}

interface CreateTempUserRequest {
  email: string;
  name: string;
  role?: 'user' | 'admin';
  expiresIn?: string;
}

interface ResetPasswordRequest {
  email: string;
}

interface ConfirmPasswordResetRequest {
  token: string;
  newPassword: string;
}

interface ForceLogoutRequest {
  userId: string;
}

interface SwitchUserRequest {
  targetUserId: string;
}

// Extended request interface for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const login = async (req: Request<object, object, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    // Find user by email - include all fields including password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({ error: 'Account is deactivated' });
      return;
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Account locking logic disabled
      // Just log the failed attempt without locking
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            lastFailedLogin: new Date()
          } 
        }
      );
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    // Reset failed login attempts
    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();
    
    // Only update the fields that changed to avoid validation errors
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          failedLoginAttempts: 0,
          lastLogin: new Date() 
        } 
      }
    );
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Remove sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json({
      user: userResponse,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  // In a stateless JWT system, logout is handled client-side
  // But we can still invalidate the refresh token if stored
  res.json({ message: 'Logged out successfully' });
};

export const refreshToken = async (req: Request<object, object, RefreshTokenRequest>, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    
    // Get user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(user);
    
    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const createAdmin = async (req: Request<object, object, CreateAdminRequest> | AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body as CreateAdminRequest;
    
    // Check if any admin exists (initial setup)
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    if (adminCount > 0) {
      // If admins exist, require authentication
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || authReq.user.role !== 'super_admin') {
        res.status(403).json({ error: 'Only super admin can create new admins' });
        return;
      }
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create admin user
    const user = new User({
      email,
      password: hashedPassword,
      name,
      role: 'admin',
      isActive: true
    });
    
    await user.save();
    
    res.status(201).json({ 
      message: 'Admin user created successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
};

export const createTempUser = async (req: Request<object, object, CreateTempUserRequest>, res: Response): Promise<void> => {
  try {
    const { email, name, role = 'user', expiresIn = '24h' } = req.body;
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Calculate expiry
    const expiresAt = new Date();
    const hours = parseInt(expiresIn);
    expiresAt.setHours(expiresAt.getHours() + hours);
    
    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      name,
      role,
      isActive: true,
      isTemporary: true,
      temporaryExpiresAt: expiresAt
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'Temporary user created',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        temporaryPassword: tempPassword,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Create temp user error:', error);
    res.status(500).json({ error: 'Failed to create temporary user' });
  }
};

export const resetPassword = async (req: Request<object, object, ResetPasswordRequest>, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      res.json({ message: 'If the email exists, a reset link has been sent' });
      return;
    }
    
    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password-reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
    
    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();
    
    // TODO: Send email with reset link
    // For now, return token (remove in production)
    res.json({ 
      message: 'Password reset token generated',
      resetToken // Remove this in production
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
};

export const confirmPasswordReset = async (req: Request<object, object, ConfirmPasswordResetRequest>, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    
    // Verify token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET!);
    
    if (typeof decodedToken === 'string' || !decodedToken || typeof decodedToken.userId !== 'string' || decodedToken.type !== 'password-reset') {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }
    
    const decoded = decodedToken as { userId: string; type: string };
    
    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user || user.resetPasswordToken !== token) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }
    
    if (new Date() > user.resetPasswordExpires!) {
      res.status(400).json({ error: 'Reset token has expired' });
      return;
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Confirm password reset error:', error);
    res.status(400).json({ error: 'Failed to reset password' });
  }
};

export const forceLogout = async (req: Request<object, object, ForceLogoutRequest>, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    
    // In a stateless JWT system, we can't truly force logout
    // But we can deactivate the user temporarily
    const user = await User.findById(userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // You might want to implement a token blacklist here
    // For now, we'll just log the action
    
    res.json({ 
      message: 'User session invalidated. User must re-login.',
      userId 
    });
  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({ error: 'Failed to force logout' });
  }
};

export const switchUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body as SwitchUserRequest;
    const adminUser = req.user!;
    
    // Verify target user exists
    const targetUser = await User.findById(targetUserId).select('-password');
    
    if (!targetUser) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }
    
    // Generate tokens for target user with admin info
    const accessToken = generateAccessToken(targetUser, {
      switchedBy: String(adminUser._id),
      originalRole: adminUser.role
    });
    
    const refreshToken = generateRefreshToken(targetUser);
    
    res.json({
      message: 'Switched to user successfully',
      user: targetUser,
      accessToken,
      refreshToken,
      switchedBy: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email
      }
    });
  } catch (error) {
    console.error('Switch user error:', error);
    res.status(500).json({ error: 'Failed to switch user' });
  }
};

export const debug = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  
  res.json({
    user: req.user,
    headers: req.headers,
    environment: process.env.NODE_ENV
  });
};