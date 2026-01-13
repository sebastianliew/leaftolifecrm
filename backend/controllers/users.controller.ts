import { Request, Response } from 'express';
import { User, IUser } from '@models/User.js';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '@backend/middlewares/auth.middleware.js';
import { FilterQuery } from 'mongoose';

// Type for user creation/update data
type UserData = Partial<Pick<IUser,
  'username' | 'email' | 'password' | 'role' | 'isActive' | 'name' |
  'firstName' | 'lastName' | 'displayName' | 'featurePermissions' |
  'failedLoginAttempts' | 'lastFailedLogin'
>> & {
  phone?: string;
  address?: string;
  status?: string;
  dateOfBirth?: Date;
};

export const getAllUsers = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: FilterQuery<IUser> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    const sortOptions: Record<string, 1 | -1> = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort(sortOptions)
        .limit(limitNum)
        .skip(skip)
        .lean(),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      users,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { 
      username,
      email,
      password,
      role = 'staff',
      firstName,
      lastName,
      displayName,
      featurePermissions,
      discountPermissions,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Username already in use' });
      }
    }

    // Check role permissions
    const currentUser = (req as AuthenticatedRequest).user;
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (currentUser.role !== 'super_admin' && role === 'super_admin') {
      return res.status(403).json({ 
        error: 'Only super admins can create super admin accounts' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build user data
    const userData: UserData = {
      username,
      email,
      password: hashedPassword,
      role,
      isActive,
      name: [firstName, lastName].filter(Boolean).join(' ').trim() || username
    };

    if (firstName) userData.firstName = firstName;
    if (lastName) userData.lastName = lastName;
    if (displayName) userData.displayName = displayName;

    // Handle permissions
    if (featurePermissions || discountPermissions) {
      const permissions = featurePermissions ? { ...featurePermissions } : {};

      if (discountPermissions) {
        permissions.discounts = {
          ...(featurePermissions?.discounts || {}),
          ...discountPermissions
        };
      }

      userData.featurePermissions = permissions;
    }

    // Create user
    const newUser = await User.create(userData);

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password').lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { 
      username,
      email, 
      role,
      firstName,
      lastName,
      displayName,
      featurePermissions,
      discountPermissions,
      isActive,
      // Legacy fields
      name,
      phone, 
      address, 
      status, 
      dateOfBirth 
    } = req.body;


    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check email uniqueness
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Check username uniqueness
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already in use' });
      }
    }

    // Check role change permissions
    if (role && role !== user.role) {
      const currentUser = (req as AuthenticatedRequest).user;
      if (!currentUser) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      if (currentUser.role !== 'super_admin' && role === 'super_admin') {
        return res.status(403).json({ 
          error: 'Only super admins can assign super admin role' 
        });
      }
    }

    // Build update data with all fields
    const updateData: UserData = {};
    
    // Handle name fields
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    
    // Update full name based on firstName/lastName or direct name input
    if (firstName !== undefined || lastName !== undefined) {
      // Build full name from firstName and lastName
      const fullName = [firstName || user.firstName, lastName || user.lastName].filter(Boolean).join(' ').trim();
      if (fullName) {
        updateData.name = fullName;
      }
    } else if (name !== undefined) {
      updateData.name = name;
    }

    // Handle other fields
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined && role !== '') updateData.role = role;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      // Clear lockout fields when reactivating a user
      if (isActive === true) {
        updateData.failedLoginAttempts = 0;
        updateData.lastFailedLogin = undefined;
      }
    }
    
    // Handle permissions
    if (featurePermissions !== undefined) {
      // Merge discount permissions from both sources if they exist
      if (discountPermissions || featurePermissions.discounts) {
        updateData.featurePermissions = {
          ...featurePermissions,
          discounts: {
            ...(featurePermissions.discounts || {}),
            ...(discountPermissions || {})
          }
        };
      } else {
        updateData.featurePermissions = featurePermissions;
      }
    } else if (discountPermissions !== undefined) {
      console.log('[UpdateUser Debug] Processing only discountPermissions');
      // If only discountPermissions is provided, merge it into existing featurePermissions
      updateData.featurePermissions = {
        ...user.featurePermissions,
        discounts: discountPermissions
      };
    }

    // Legacy fields
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (status !== undefined) updateData.status = status;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    return res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'staff', 'user'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = (req as AuthenticatedRequest).user;
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (currentUser.role !== 'super_admin' && role === 'super_admin') {
      return res.status(403).json({ 
        error: 'Only super admins can assign super admin role' 
      });
    }

    user.role = role;
    await user.save();

    return res.json({
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Failed to update user role' });
  }
};

export const updateUserPassword = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: 'New password and confirmation are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Passwords do not match' 
      });
    }

    // Validate password complexity
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)' 
      });
    }

    // Check if user exists first
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check authorization
    const currentUser = (req as AuthenticatedRequest).user;
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (currentUser._id?.toString() !== id && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return res.status(403).json({
        error: 'You can only change your own password'
      });
    }

    // Use findByIdAndUpdate to directly update the password field
    // This avoids issues with the password field having select: false
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Debug: Log password update details (remove in production)
    console.log('Password update debug:', {
      userId: id,
      username: user.username,
      passwordLength: newPassword.length,
      hashLength: hashedPassword.length,
      hashPrefix: hashedPassword.substring(0, 10)
    });
    
    const updateResult = await User.findByIdAndUpdate(
      id,
      { password: hashedPassword },
      { runValidators: true, new: true }
    );

    if (!updateResult) {
      console.error('Password update failed - no result returned');
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Verify the update worked
    const verifyUser = await User.findById(id).select('+password');
    if (verifyUser) {
      const isValid = await bcrypt.compare(newPassword, verifyUser.password);
      console.log('Password verification after update:', {
        userId: id,
        updateSuccessful: isValid,
        storedHashPrefix: verifyUser.password.substring(0, 10)
      });
      
      if (!isValid) {
        console.error('WARNING: Password verification failed after update!');
      }
    }

    return res.json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = (req as AuthenticatedRequest).user;
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (user._id.toString() === currentUser._id?.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    if (user.role === 'super_admin' && currentUser.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Only super admins can delete super admin accounts' 
      });
    }

    await User.findByIdAndDelete(id);

    return res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};