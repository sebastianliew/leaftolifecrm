"use client"

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaUser, FaSearch, FaCrown, FaUserTie, FaUserCheck } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import { useUsersQuery } from '@/hooks/queries/use-users-query';

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'super_admin';
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
  isActive: boolean;
}

interface UserSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  currentUser?: User | null;
}

export function UserSelector({
  open,
  onClose,
  onSelectUser,
  currentUser
}: UserSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use TanStack Query to fetch users
  const { data: users = [], isLoading, error } = useUsersQuery(
    { active: true },
    { enabled: open } // Only fetch when dialog is open
  );

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) {
      return users;
    }
    
    return users.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, users]);

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <FaCrown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <FaUserTie className="w-4 h-4 text-red-500" />;
      case 'manager':
        return <FaUserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <FaUser className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDisplayName = (user: User) => {
    if (user.displayName) return user.displayName;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.username;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaUser className="w-5 h-5" />
            Select User Account
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Current User Display */}
          {currentUser && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-800">Current User:</span>
                <div className="flex items-center gap-2">
                  {getRoleIcon(currentUser.role)}
                  <span className="font-medium">{getDisplayName(currentUser)}</span>
                  <Badge className={getRoleBadgeColor(currentUser.role)}>
                    {currentUser.role === 'super_admin' ? 'SUPER ADMIN' : currentUser.role.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users by name, username, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <Alert className="mb-4">
                <AlertDescription>{error instanceof Error ? error.message : 'Failed to fetch users'}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <ImSpinner8 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No users found matching your search.' : 'No users found.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <Card 
                    key={user._id} 
                    className={`hover:shadow-md transition-shadow cursor-pointer ${
                      currentUser?._id === user._id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getRoleIcon(user.role)}
                          <div>
                            <div className="font-medium">{getDisplayName(user)}</div>
                            <div className="text-sm text-gray-600">
                              @{user.username} • {user.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role === 'super_admin' ? 'SUPER ADMIN' : user.role.toUpperCase()}
                          </Badge>
                          {currentUser?._id === user._id && (
                            <Badge variant="outline" className="text-blue-600 border-blue-300">
                              Current
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Discount Permissions Summary */}
                      {user.discountPermissions?.canApplyDiscounts && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Discount Permissions:</span>
                            {user.discountPermissions?.unlimitedDiscounts ? (
                              <span className="text-green-600 font-medium"> Unlimited</span>
                            ) : (
                              <span>
                                {' '}Up to {user.discountPermissions?.maxDiscountPercent || 0}% or $
                                {user.discountPermissions?.maxDiscountAmount || 0}
                              </span>
                            )}
                            {user.discountPermissions?.canApplyProductDiscounts && (
                              <span className="text-blue-600"> • Product-level discounts</span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 