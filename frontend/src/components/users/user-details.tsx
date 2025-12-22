"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FaUser, FaEnvelope, FaCalendar, FaKey, FaShieldAlt, FaPercent, FaDollarSign, FaCheck, FaTimes, FaUserShield, FaUserTie } from "react-icons/fa"

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'super_admin';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  discountPermissions?: {
    canApplyDiscounts: boolean;
    maxDiscountPercent: number;
    maxDiscountAmount: number;
    unlimitedDiscounts: boolean;
    canApplyProductDiscounts: boolean;
    canApplyBillDiscounts: boolean;
  };
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDetailsProps {
  user: User;
  onClose: () => void;
}

export function UserDetails({ user, onClose }: UserDetailsProps) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800"
      case "admin":
        return "bg-blue-100 text-blue-800"
      case "manager":
        return "bg-green-100 text-green-800"
      case "staff":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <FaUserShield className="h-4 w-4" />
      case "admin":
        return <FaUserTie className="h-4 w-4" />
      case "manager":
        return <FaUser className="h-4 w-4" />
      case "staff":
        return <FaUser className="h-4 w-4" />
      default:
        return <FaUser className="h-4 w-4" />
    }
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-GB') + ' ' + new Date(date).toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
          <FaUser className="h-8 w-8 text-gray-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
          </h2>
          <p className="text-gray-600">@{user.username}</p>
          <div className="flex items-center space-x-2 mt-2">
            <Badge className={getRoleColor(user.role)}>
              <div className="flex items-center space-x-1">
                {getRoleIcon(user.role)}
                <span className="capitalize">{user.role === 'super_admin' ? 'Super Admin' : user.role}</span>
              </div>
            </Badge>
            <Badge className={getStatusColor(user.isActive)}>
              {user.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FaUser className="h-5 w-5" />
            <span>Basic Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FaEnvelope className="h-4 w-4" />
                <span>Email</span>
              </div>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FaUser className="h-4 w-4" />
                <span>Username</span>
              </div>
              <p className="font-medium">@{user.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">First Name</div>
              <p className="font-medium">{user.firstName || 'Not provided'}</p>
            </div>
            <div>
              <div className="text-sm text-gray-600">Last Name</div>
              <p className="font-medium">{user.lastName || 'Not provided'}</p>
            </div>
            <div>
              <div className="text-sm text-gray-600">Display Name</div>
              <p className="font-medium">{user.displayName || 'Not provided'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FaCalendar className="h-4 w-4" />
                <span>Created</span>
              </div>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FaCalendar className="h-4 w-4" />
                <span>Last Updated</span>
              </div>
              <p className="font-medium">{formatDate(user.updatedAt)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FaKey className="h-4 w-4" />
              <span>Last Login</span>
            </div>
            <p className="font-medium">
              {user.lastLogin ? formatDate(user.lastLogin) : 'Never logged in'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Discount Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FaShieldAlt className="h-5 w-5" />
            <span>Discount Permissions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FaPercent className="h-4 w-4" />
              <span>Can Apply Discounts</span>
            </div>
            <div className="flex items-center space-x-2">
              {user.discountPermissions?.canApplyDiscounts ? (
                <FaCheck className="h-4 w-4 text-green-600" />
              ) : (
                <FaTimes className="h-4 w-4 text-red-600" />
              )}
              <span className={user.discountPermissions?.canApplyDiscounts ? 'text-green-600' : 'text-red-600'}>
                {user.discountPermissions?.canApplyDiscounts ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {user.discountPermissions?.canApplyDiscounts && (
            <>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FaShieldAlt className="h-4 w-4" />
                  <span>Unlimited Discounts</span>
                </div>
                <div className="flex items-center space-x-2">
                  {user.discountPermissions?.unlimitedDiscounts ? (
                    <FaCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <FaTimes className="h-4 w-4 text-red-600" />
                  )}
                  <span className={user.discountPermissions?.unlimitedDiscounts ? 'text-green-600' : 'text-red-600'}>
                    {user.discountPermissions?.unlimitedDiscounts ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {!user.discountPermissions?.unlimitedDiscounts && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <FaPercent className="h-4 w-4" />
                      <span>Max Discount Percentage</span>
                    </div>
                    <p className="font-medium text-lg">{user.discountPermissions?.maxDiscountPercent || 0}%</p>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <FaDollarSign className="h-4 w-4" />
                      <span>Max Discount Amount</span>
                    </div>
                    <p className="font-medium text-lg">${user.discountPermissions?.maxDiscountAmount || 0}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span>Product Discounts</span>
                  <div className="flex items-center space-x-2">
                    {user.discountPermissions?.canApplyProductDiscounts ? (
                      <FaCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <FaTimes className="h-4 w-4 text-red-600" />
                    )}
                    <span className={user.discountPermissions?.canApplyProductDiscounts ? 'text-green-600' : 'text-red-600'}>
                      {user.discountPermissions?.canApplyProductDiscounts ? 'Allowed' : 'Not Allowed'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Bill Discounts</span>
                  <div className="flex items-center space-x-2">
                    {user.discountPermissions?.canApplyBillDiscounts ? (
                      <FaCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <FaTimes className="h-4 w-4 text-red-600" />
                    )}
                    <span className={user.discountPermissions?.canApplyBillDiscounts ? 'text-green-600' : 'text-red-600'}>
                      {user.discountPermissions?.canApplyBillDiscounts ? 'Allowed' : 'Not Allowed'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}