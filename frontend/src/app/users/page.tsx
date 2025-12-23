"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FaSearch, FaPlus, FaUser, FaEdit, FaEye, FaTrash, FaUsers, FaChartLine, FaUserShield, FaUserTie, FaLock, FaChevronUp, FaChevronDown, FaFilter } from "react-icons/fa"
import { useToast } from "@/components/ui/toast"
import { useUserManagement } from "@/hooks/useUserManagement"
import { useUserFilters } from "@/hooks/useUserFilters"
import { useAuth } from "@/hooks/useAuth"
import { UserForm } from "@/components/users/user-form"
import { UserDetails } from "@/components/users/user-details"
import { PasswordUpdateDialog } from "@/components/users/password-update-dialog"
import { UserDeleteDialog } from "@/components/users/user-delete-dialog"
import { UserUtilsService } from "@/services/UserApiService"
import { User, CreateUserData, UpdateUserData, UserRole, DiscountPermissions } from "@/types/user"
import { FeaturePermissions } from "@/lib/permissions/types"
import { FeaturePermissions as UserFeaturePermissions } from "@/types/user"
import { usePermissions } from "@/hooks/usePermissions"

// Interface that matches UserForm component expectations
interface UserFormData {
  username: string
  email: string
  password?: string
  role: 'super_admin' | 'admin' | 'manager' | 'staff'
  firstName?: string
  lastName?: string
  displayName?: string
  discountPermissions: {
    canApplyDiscounts: boolean
    maxDiscountPercent: number
    maxDiscountAmount: number
    unlimitedDiscounts: boolean
    canApplyProductDiscounts: boolean
    canApplyBillDiscounts: boolean
  }
  featurePermissions?: Partial<FeaturePermissions>
  isActive: boolean
}


// Conversion function to transform UserFeaturePermissions to FormFeaturePermissions
// This function passes through actual user permissions - no hardcoding!
const convertUserPermissionsToFormPermissions = (
  userPermissions?: UserFeaturePermissions
): Partial<FeaturePermissions> | undefined => {
  if (!userPermissions) return undefined;

  // Deep clone to pass through all actual permission values
  // This preserves explicit false values and user overrides
  return JSON.parse(JSON.stringify(userPermissions)) as Partial<FeaturePermissions>;
}

// Reverse conversion function to transform FormFeaturePermissions back to UserFeaturePermissions
// This function passes through actual form permissions - no hardcoding or transformations!
const convertFormPermissionsToUserPermissions = (
  formPermissions?: Partial<FeaturePermissions>
): UserFeaturePermissions | undefined => {
  if (!formPermissions) return undefined;

  // Deep clone to pass through all actual permission values
  // This preserves explicit false values and user overrides
  return JSON.parse(JSON.stringify(formPermissions)) as UserFeaturePermissions;
}

export default function UsersPage() {
  const {
    users,
    loading,
    stats,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus
  } = useUserManagement()
  
  const {
    searchTerm,
    roleFilter,
    statusFilter,
    sortBy,
    sortOrder,
    filteredUsers,
    setSearchTerm,
    setRoleFilter,
    setStatusFilter,
    handleSort
  } = useUserFilters(users)
  
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast, ToastContainer } = useToast()
  const { user: currentUser } = useAuth()
  const { hasPermission } = usePermissions()

  // Permissions
  const canCreateUsers = hasPermission('userManagement', 'canCreateUsers')
  const canEditUsers = hasPermission('userManagement', 'canEditUsers')
  const canDeleteUsers = hasPermission('userManagement', 'canDeleteUsers')

  useEffect(() => {
    const loadUsers = async () => {
      try {
        await fetchUsers()
      } catch {
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        })
      }
    }
    loadUsers()
  }, [fetchUsers, toast])

  const handleCreateUser = async (data: UserFormData) => {
    try {
      // Convert UserFormData to CreateUserData
      const createData: CreateUserData = {
        username: data.username,
        email: data.email,
        role: data.role as UserRole,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        discountPermissions: data.discountPermissions as DiscountPermissions,
        featurePermissions: convertFormPermissionsToUserPermissions(data.featurePermissions),
        isActive: data.isActive,
      }
      
      // Add password to the create data
      const createDataWithPassword = { ...createData, password: data.password }
      await createUser(createDataWithPassword as CreateUserData & { password?: string })
      setShowCreateDialog(false)
      toast({
        title: "Success",
        description: "User created successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      })
    }
  }

  const handleEditUser = async (data: Partial<UserFormData>) => {
    if (!selectedUser) return

    try {
      // Convert Partial<UserFormData> to Partial<UpdateUserData>
      // Only include fields that have actual values (avoid empty strings for role)
      const updateData: Partial<UpdateUserData> = {
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        discountPermissions: data.discountPermissions as DiscountPermissions,
        featurePermissions: convertFormPermissionsToUserPermissions(data.featurePermissions),
        isActive: data.isActive,
      }
      // Only include role if it's a non-empty value
      if (data.role) {
        updateData.role = data.role as UserRole
      }
      
      // Debug logging
      console.log('[Frontend] User update data:', {
        userId: selectedUser._id,
        formData: data,
        convertedFeaturePermissions: updateData.featurePermissions,
        discountPermissions: updateData.discountPermissions
      })
      
      await updateUser(selectedUser._id, updateData)
      setShowEditDialog(false)
      setSelectedUser(null)
      toast({
        title: "Success",
        description: "User updated successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    
    setDeleteLoading(true)
    try {
      await deleteUser(selectedUser._id)
      setShowDeleteDialog(false)
      setSelectedUser(null)
      toast({
        title: "Success",
        description: "User deleted successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleUserStatus(userId, !currentStatus)
      toast({
        title: "Success",
        description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      })
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <FaUserShield className="h-3 w-3" />
      case "admin":
        return <FaUserTie className="h-3 w-3" />
      case "manager":
        return <FaUser className="h-3 w-3" />
      case "staff":
        return <FaUser className="h-3 w-3" />
      default:
        return <FaUser className="h-3 w-3" />
    }
  }

  const canUpdatePasswords = () => {
    return currentUser?.role === 'super_admin'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />

      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600">Manage system users and permissions</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FaFilter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Search & Filter</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <div className="relative mb-2">
                      <FaSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Role</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setRoleFilter("all")}
                  >
                    <span className={roleFilter === "all" ? "font-semibold" : ""}>All Roles</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setRoleFilter("super_admin")}
                  >
                    <span className={roleFilter === "super_admin" ? "font-semibold" : ""}>Super Admin</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setRoleFilter("admin")}
                  >
                    <span className={roleFilter === "admin" ? "font-semibold" : ""}>Admin</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setRoleFilter("manager")}
                  >
                    <span className={roleFilter === "manager" ? "font-semibold" : ""}>Manager</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setRoleFilter("staff")}
                  >
                    <span className={roleFilter === "staff" ? "font-semibold" : ""}>Staff</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setStatusFilter("all")}
                  >
                    <span className={statusFilter === "all" ? "font-semibold" : ""}>All Status</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setStatusFilter("active")}
                  >
                    <span className={statusFilter === "active" ? "font-semibold" : ""}>Active</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setStatusFilter("inactive")}
                  >
                    <span className={statusFilter === "inactive" ? "font-semibold" : ""}>Inactive</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canCreateUsers && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <FaPlus className="w-4 h-4 mr-2" />
                  New User
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <FaUsers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">All users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <FaChartLine className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
              <FaUserShield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.adminUsers}</div>
              <p className="text-xs text-muted-foreground">Admins & Super Admin</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Users</CardTitle>
              <FaUser className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.staffUsers}</div>
              <p className="text-xs text-muted-foreground">Staff & Managers</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort("username")}
                  >
                    <div className="flex items-center gap-1">
                      User
                      {sortBy === "username" && (
                        sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {sortBy === "email" && (
                        sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort("role")}
                  >
                    <div className="flex items-center gap-1">
                      Role
                      {sortBy === "role" && (
                        sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortBy === "status" && (
                        sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Discount Permissions</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort("lastLogin")}
                  >
                    <div className="flex items-center gap-1">
                      Last Login
                      {sortBy === "lastLogin" && (
                        sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              <FaUser className="h-4 w-4 text-gray-600" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {UserUtilsService.formatUserDisplayName(user)}
                            </div>
                            <div className="text-sm text-gray-500">@{user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={UserUtilsService.getRoleColor(user.role)}>
                          <div className="flex items-center space-x-1">
                            {getRoleIcon(user.role)}
                            <span className="capitalize">{user.role}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={UserUtilsService.getStatusColor(user.isActive)}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {(() => {
                            const hasDiscountPermission = UserUtilsService.hasDiscountPermissions(user);
                            
                            if (hasDiscountPermission) {
                              const { unlimited, maxPercent, maxAmount } = UserUtilsService.getMaxDiscountInfo(user);
                              
                              return (
                                <div>
                                  <div className="text-green-600 font-medium">Can Apply</div>
                                  <div className="text-xs text-gray-500">
                                    {unlimited ? 'Unlimited' : 
                                      `Max: ${maxPercent}% / $${maxAmount}`
                                    }
                                  </div>
                                </div>
                              );
                            } else {
                              return <div className="text-red-600 font-medium">No Discounts</div>;
                            }
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const currentUser = users.find(u => u._id === user._id) || user
                              setSelectedUser(currentUser)
                              setShowDetailsDialog(true)
                            }}
                          >
                            <FaEye className="h-4 w-4" />
                          </Button>
                          {canEditUsers && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const currentUser = users.find(u => u._id === user._id) || user
                                setSelectedUser(currentUser)
                                setShowEditDialog(true)
                              }}
                            >
                              <FaEdit className="h-4 w-4" />
                            </Button>
                          )}
                          {canUpdatePasswords() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user)
                                setShowPasswordDialog(true)
                              }}
                              title="Update Password"
                            >
                              <FaLock className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                          >
                            {user.isActive ? (
                              <span className="text-xs text-red-600">Deactivate</span>
                            ) : (
                              <span className="text-xs text-green-600">Activate</span>
                            )}
                          </Button>
                          {canDeleteUsers && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user)
                                setShowDeleteDialog(true)
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <FaTrash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <UserForm 
            onSubmit={handleCreateUser}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <UserForm 
            initialData={selectedUser ? {
              username: selectedUser.username,
              email: selectedUser.email,
              role: selectedUser.role,
              firstName: selectedUser.firstName,
              lastName: selectedUser.lastName,
              displayName: selectedUser.displayName,
              discountPermissions: selectedUser.discountPermissions,
              featurePermissions: convertUserPermissionsToFormPermissions(selectedUser.featurePermissions),
              isActive: selectedUser.isActive
            } as UserFormData : undefined}
            onSubmit={handleEditUser}
            onCancel={() => {
              setShowEditDialog(false)
              setSelectedUser(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserDetails 
              user={selectedUser}
              onClose={() => {
                setShowDetailsDialog(false)
                setSelectedUser(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Password Update Dialog */}
      <PasswordUpdateDialog
        isOpen={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
      />

      {/* Delete User Dialog */}
      <UserDeleteDialog
        user={selectedUser}
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) setSelectedUser(null)
        }}
        onConfirm={handleDeleteUser}
        loading={deleteLoading}
      />

    </div>
  )
}