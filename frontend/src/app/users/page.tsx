"use client"

import { useState, useEffect, useCallback } from "react"
import { HiPlus, HiPencil, HiEye, HiTrash, HiFunnel, HiLockClosed } from "react-icons/hi2"
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
import {
  EditorialPage,
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialModal,
  EditorialMeta,
} from "@/components/ui/editorial"

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

const convertUserPermissionsToFormPermissions = (
  userPermissions?: UserFeaturePermissions
): Partial<FeaturePermissions> | undefined => {
  if (!userPermissions) return undefined
  return JSON.parse(JSON.stringify(userPermissions)) as Partial<FeaturePermissions>
}

const convertFormPermissionsToUserPermissions = (
  formPermissions?: Partial<FeaturePermissions>
): UserFeaturePermissions | undefined => {
  if (!formPermissions) return undefined
  return JSON.parse(JSON.stringify(formPermissions)) as UserFeaturePermissions
}

const roleToneMap: Record<string, string> = {
  super_admin: 'text-[#7C3AED]',
  admin: 'text-[#0A0A0A]',
  manager: 'text-[#0A0A0A]',
  staff: 'text-[#6B7280]',
  user: 'text-[#9CA3AF]',
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
    toggleUserStatus,
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
    handleSort,
  } = useUserFilters(users)

  const [showFilters, setShowFilters] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const { hasPermission } = usePermissions()

  const canCreateUsers = hasPermission('userManagement', 'canCreateUsers')
  const canEditUsers = hasPermission('userManagement', 'canEditUsers')
  const canDeleteUsers = hasPermission('userManagement', 'canDeleteUsers')
  const canUpdatePasswords = currentUser?.role === 'super_admin'

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [setSearchTerm])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        await fetchUsers()
      } catch {
        toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" })
      }
    }
    loadUsers()
  }, [fetchUsers, toast])

  const handleCreateUser = async (data: UserFormData) => {
    try {
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
      const createDataWithPassword = { ...createData, password: data.password }
      await createUser(createDataWithPassword as CreateUserData & { password?: string })
      setShowCreateDialog(false)
      toast({ title: "Success", description: "User created successfully", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" })
    }
  }

  const handleEditUser = async (data: Partial<UserFormData>) => {
    if (!selectedUser) return
    try {
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
      if (data.role) updateData.role = data.role as UserRole

      await updateUser(selectedUser._id, updateData)
      setShowEditDialog(false)
      setSelectedUser(null)
      toast({ title: "Success", description: "User updated successfully", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" })
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setDeleteLoading(true)
    try {
      await deleteUser(selectedUser._id)
      setShowDeleteDialog(false)
      setSelectedUser(null)
      toast({ title: "Success", description: "User deleted successfully", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" })
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
      toast({ title: "Error", description: "Failed to update user status", variant: "destructive" })
    }
  }

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Users"
        title="Directory"
        subtitle={
          <>
            <span className="tabular-nums">{stats.totalUsers}</span> user{stats.totalUsers === 1 ? '' : 's'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search users..." initialValue={searchTerm} />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        {canCreateUsers && (
          <EditorialButton
            variant="primary"
            icon={<HiPlus className="h-3 w-3" />}
            arrow
            onClick={() => setShowCreateDialog(true)}
          >
            New user
          </EditorialButton>
        )}
      </EditorialMasthead>

      <EditorialStats>
        <EditorialStat index="i." label="Total users" value={stats.totalUsers} caption="all users" />
        <EditorialStat index="ii." label="Active" value={stats.activeUsers} tone="ok" caption="currently active" />
        <EditorialStat index="iii." label="Admins" value={stats.adminUsers} caption="admin & super-admin" />
        <EditorialStat index="iv." label="Staff" value={stats.staffUsers} caption="staff & managers" />
      </EditorialStats>

      {showFilters && (
        <EditorialFilterRow columns={2}>
          <EditorialField label="Role">
            <EditorialSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              <option value="super_admin">Super admin</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Status">
            <EditorialSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh sortKey="username" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>User</EditorialTh>
          <EditorialTh sortKey="email" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Email</EditorialTh>
          <EditorialTh sortKey="role" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Role</EditorialTh>
          <EditorialTh sortKey="status" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Status</EditorialTh>
          <EditorialTh>Discounts</EditorialTh>
          <EditorialTh sortKey="lastLogin" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} align="right">Last login</EditorialTh>
          <EditorialTh align="right" className="w-40">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={7} title="Loading" description="Fetching users…" />
          ) : filteredUsers.length === 0 ? (
            <EditorialEmptyRow colSpan={7} description="No users match the current filters." />
          ) : (
            filteredUsers.map((user) => {
              const tone = roleToneMap[user.role] || 'text-[#6B7280]'
              const hasDiscount = UserUtilsService.hasDiscountPermissions(user)
              const { unlimited, maxPercent, maxAmount } = hasDiscount
                ? UserUtilsService.getMaxDiscountInfo(user)
                : { unlimited: false, maxPercent: 0, maxAmount: 0 }
              return (
                <EditorialTr key={user._id}>
                  <EditorialTd size="lg" className="pr-4">
                    <p className="text-[14px] text-[#0A0A0A] font-medium">
                      {UserUtilsService.formatUserDisplayName(user)}
                    </p>
                    <EditorialMeta className="font-mono tracking-wide">@{user.username}</EditorialMeta>
                  </EditorialTd>
                  <EditorialTd>{user.email}</EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${tone}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${user.isActive ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </EditorialTd>
                  <EditorialTd>
                    {hasDiscount ? (
                      <>
                        <span className="text-[10px] uppercase tracking-[0.28em] text-[#16A34A]">Can apply</span>
                        <EditorialMeta className="italic font-light tabular-nums">
                          {unlimited ? 'unlimited' : `max ${maxPercent}% / $${maxAmount}`}
                        </EditorialMeta>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.28em] text-[#DC2626]">No discounts</span>
                    )}
                  </EditorialTd>
                  <EditorialTd align="right" className="tabular-nums">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—'}
                  </EditorialTd>
                  <EditorialTd align="right">
                    <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          const u = users.find((x) => x._id === user._id) || user
                          setSelectedUser(u)
                          setShowDetailsDialog(true)
                        }}
                        title="View"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                      >
                        <HiEye className="h-3.5 w-3.5" />
                      </button>
                      {canEditUsers && (
                        <button
                          onClick={() => {
                            const u = users.find((x) => x._id === user._id) || user
                            setSelectedUser(u)
                            setShowEditDialog(true)
                          }}
                          title="Edit"
                          className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        >
                          <HiPencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canUpdatePasswords && (
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowPasswordDialog(true)
                          }}
                          title="Update password"
                          className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        >
                          <HiLockClosed className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                        className={`text-[10px] uppercase tracking-[0.28em] ${user.isActive ? 'text-[#DC2626]' : 'text-[#16A34A]'} hover:opacity-80 transition-opacity`}
                      >
                        {user.isActive ? 'Disable' : 'Enable'}
                      </button>
                      {canDeleteUsers && (
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowDeleteDialog(true)
                          }}
                          title="Delete"
                          className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                        >
                          <HiTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>

      <EditorialModal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        kicker="Users"
        title="New user"
        description="Provision an account with role and discount permissions."
        size="2xl"
      >
        <UserForm onSubmit={handleCreateUser} onCancel={() => setShowCreateDialog(false)} />
      </EditorialModal>

      <EditorialModal
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) setSelectedUser(null)
        }}
        kicker="Users"
        title={selectedUser ? `Edit ${UserUtilsService.formatUserDisplayName(selectedUser)}` : 'Edit user'}
        size="2xl"
      >
        <UserForm
          initialData={selectedUser ? ({
            username: selectedUser.username,
            email: selectedUser.email,
            role: selectedUser.role,
            firstName: selectedUser.firstName,
            lastName: selectedUser.lastName,
            displayName: selectedUser.displayName,
            discountPermissions: selectedUser.discountPermissions,
            featurePermissions: convertUserPermissionsToFormPermissions(selectedUser.featurePermissions),
            isActive: selectedUser.isActive,
          } as UserFormData) : undefined}
          onSubmit={handleEditUser}
          onCancel={() => {
            setShowEditDialog(false)
            setSelectedUser(null)
          }}
        />
      </EditorialModal>

      <EditorialModal
        open={showDetailsDialog}
        onOpenChange={(open) => {
          setShowDetailsDialog(open)
          if (!open) setSelectedUser(null)
        }}
        kicker="Users"
        title={selectedUser ? UserUtilsService.formatUserDisplayName(selectedUser) : 'User details'}
        size="2xl"
      >
        {selectedUser && (
          <UserDetails
            user={selectedUser}
            onClose={() => {
              setShowDetailsDialog(false)
              setSelectedUser(null)
            }}
          />
        )}
      </EditorialModal>

      <PasswordUpdateDialog
        isOpen={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
      />

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
    </EditorialPage>
  )
}
