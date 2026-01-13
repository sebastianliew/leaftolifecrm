"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeaturePermissions } from "@/lib/permissions/types"
import { PermissionService } from "@/lib/permissions/PermissionService.client"
import { FaEye, FaEyeSlash } from "@/components/icons/centralized"

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

interface UserFormProps {
  initialData?: Partial<UserFormData>
  onSubmit: (data: UserFormData) => void
  onCancel: () => void
}

export function UserForm({ initialData, onSubmit, onCancel }: UserFormProps) {
  const permissionService = PermissionService.getInstance()
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    role: 'staff',
    firstName: '',
    lastName: '',
    displayName: '',
    discountPermissions: {
      canApplyDiscounts: false,
      maxDiscountPercent: 0,
      maxDiscountAmount: 0,
      unlimitedDiscounts: false,
      canApplyProductDiscounts: false,
      canApplyBillDiscounts: true
    },
    featurePermissions: permissionService.getRoleDefaults('staff'),
    isActive: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (initialData) {
      const roleDefaults = permissionService.getRoleDefaults(initialData.role || 'staff')

      // Debug logging for initial data
      console.log('[UserForm] Initial data:', {
        role: initialData.role,
        hasFeaturePermissions: !!initialData.featurePermissions,
        featurePermissions: initialData.featurePermissions,
        roleDefaults: roleDefaults
      })

      // Merge discount permissions from both sources, preferring featurePermissions.discounts
      // This ensures consistency between the legacy discountPermissions and new featurePermissions.discounts
      const featureDiscounts = initialData.featurePermissions?.discounts
      const legacyDiscounts = initialData.discountPermissions
      const mergedDiscountPermissions = {
        // canApplyDiscounts is a legacy field only in discountPermissions
        canApplyDiscounts: legacyDiscounts?.canApplyDiscounts ?? false,
        maxDiscountPercent: featureDiscounts?.maxDiscountPercent ?? legacyDiscounts?.maxDiscountPercent ?? 0,
        maxDiscountAmount: featureDiscounts?.maxDiscountAmount ?? legacyDiscounts?.maxDiscountAmount ?? 0,
        unlimitedDiscounts: featureDiscounts?.unlimitedDiscounts ?? legacyDiscounts?.unlimitedDiscounts ?? false,
        canApplyProductDiscounts: featureDiscounts?.canApplyProductDiscounts ?? legacyDiscounts?.canApplyProductDiscounts ?? false,
        canApplyBillDiscounts: featureDiscounts?.canApplyBillDiscounts ?? legacyDiscounts?.canApplyBillDiscounts ?? true
      }

      // Deep merge: start with role defaults, then overlay user's existing permissions
      // This ensures all permission categories exist even if user data is incomplete
      const existingPermissions = initialData.featurePermissions || {}

      // Helper function to deep merge permission categories
      const deepMergePermissions = (
        defaults: Partial<FeaturePermissions>,
        existing: Partial<FeaturePermissions>
      ): Partial<FeaturePermissions> => {
        const result: Partial<FeaturePermissions> = { ...defaults }

        // Merge each category from existing permissions
        for (const key of Object.keys(existing) as Array<keyof FeaturePermissions>) {
          if (existing[key]) {
            result[key] = {
              ...(defaults[key] || {}),
              ...existing[key]
            } as never // Type assertion needed for dynamic key assignment
          }
        }

        return result
      }

      const mergedFeaturePermissions = deepMergePermissions(roleDefaults, existingPermissions)

      // Sync discounts with the merged discount permissions
      const syncedFeaturePermissions = {
        ...mergedFeaturePermissions,
        discounts: {
          ...mergedFeaturePermissions.discounts,
          ...mergedDiscountPermissions
        }
      }

      setFormData({
        username: initialData.username || '',
        email: initialData.email || '',
        password: '', // Don't pre-fill password for editing
        role: initialData.role || 'staff',
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        displayName: initialData.displayName || '',
        discountPermissions: mergedDiscountPermissions,
        featurePermissions: syncedFeaturePermissions,
        isActive: initialData.isActive !== undefined ? initialData.isActive : true
      })
    }
  }, [initialData, permissionService]) // eslint-disable-line react-hooks/exhaustive-deps

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!initialData && !formData.password) {
      newErrors.password = 'Password is required for new users'
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (formData.discountPermissions.maxDiscountPercent < 0 || formData.discountPermissions.maxDiscountPercent > 100) {
      newErrors.maxDiscountPercent = 'Discount percentage must be between 0 and 100'
    }

    if (formData.discountPermissions.maxDiscountAmount < 0) {
      newErrors.maxDiscountAmount = 'Discount amount cannot be negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const submitData = { ...formData }
      
      // Don't send password if it's empty for editing
      if (initialData && !formData.password) {
        delete submitData.password
      }
      
      // Debug logging for form submission
      console.log('[UserForm] Submitting data:', {
        isEdit: !!initialData,
        featurePermissions: submitData.featurePermissions,
        discountPermissions: submitData.discountPermissions,
        role: submitData.role
      })
      
      await onSubmit(submitData)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = (role: string) => {
    const roleDefaults = permissionService.getRoleDefaults(role)
    
    let defaultDiscountPermissions = {
      canApplyDiscounts: false,
      maxDiscountPercent: 0,
      maxDiscountAmount: 0,
      unlimitedDiscounts: false,
      canApplyProductDiscounts: false,
      canApplyBillDiscounts: true
    }

    // Set default permissions based on role
    switch (role) {
      case 'super_admin':
        defaultDiscountPermissions = {
          canApplyDiscounts: true,
          maxDiscountPercent: 100,
          maxDiscountAmount: 999999,
          unlimitedDiscounts: true,
          canApplyProductDiscounts: true,
          canApplyBillDiscounts: true
        }
        break
      case 'admin':
        defaultDiscountPermissions = {
          canApplyDiscounts: true,
          maxDiscountPercent: 100,
          maxDiscountAmount: 999999,
          unlimitedDiscounts: true,
          canApplyProductDiscounts: true,
          canApplyBillDiscounts: true
        }
        break
      case 'manager':
        defaultDiscountPermissions = {
          canApplyDiscounts: true,
          maxDiscountPercent: 50,
          maxDiscountAmount: 1000,
          unlimitedDiscounts: false,
          canApplyProductDiscounts: true,
          canApplyBillDiscounts: true
        }
        break
      case 'staff':
        defaultDiscountPermissions = {
          canApplyDiscounts: true,
          maxDiscountPercent: 10,
          maxDiscountAmount: 100,
          unlimitedDiscounts: false,
          canApplyProductDiscounts: false,
          canApplyBillDiscounts: true
        }
        break
    }

    setFormData(prev => ({
      ...prev,
      role: role as 'super_admin' | 'admin' | 'manager' | 'staff',
      discountPermissions: defaultDiscountPermissions,
      featurePermissions: roleDefaults
    }))
  }

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }


  const updateFeaturePermissions = (category: keyof FeaturePermissions, field: string, value: boolean | number) => {
    setFormData(prev => {
      // Ensure we have a complete featurePermissions object
      // If it's partial, merge with role defaults to ensure all categories exist
      const currentPermissions = prev.featurePermissions || {};
      const roleDefaults = permissionService.getRoleDefaults(prev.role);
      
      // Create a deep merge of role defaults with current permissions
      // We use type assertion because roleDefaults provides complete permission objects at runtime
      const basePermissions = { ...roleDefaults } as Record<string, Record<string, boolean | number>>;
      Object.keys(currentPermissions).forEach(cat => {
        const categoryKey = cat as keyof typeof currentPermissions;
        const currentCategory = currentPermissions[categoryKey];
        if (basePermissions[cat] && currentCategory) {
          basePermissions[cat] = {
            ...basePermissions[cat],
            ...currentCategory
          };
        }
      });

      const newFeaturePermissions = {
        ...basePermissions,
        [category]: {
          ...basePermissions[category],
          [field]: value
        }
      }

      // Sync discountPermissions when discounts category is updated
      // This ensures both states stay in sync for backend compatibility
      if (category === 'discounts') {
        return {
          ...prev,
          featurePermissions: newFeaturePermissions,
          discountPermissions: {
            ...prev.discountPermissions,
            [field]: value
          }
        }
      }

      return {
        ...prev,
        featurePermissions: newFeaturePermissions
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => updateFormData('username', e.target.value)}
                placeholder="Enter username"
                className={errors.username ? 'border-red-500' : ''}
              />
              {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
            </div>
            
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                placeholder="Enter email"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password">Password {!initialData && '*'}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  placeholder={initialData ? "Leave blank to keep current password" : "Enter password"}
                  className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>
            
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => updateFormData('lastName', e.target.value)}
                placeholder="Enter last name"
              />
            </div>
            
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => updateFormData('displayName', e.target.value)}
                placeholder="Enter display name"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => updateFormData('isActive', checked)}
            />
            <Label htmlFor="isActive">Active User</Label>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="discounts" className="w-full">
            <TabsList className="flex flex-wrap gap-1 h-auto p-1">
              <TabsTrigger value="discounts">Discounts</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="patients">Patients</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="blends">Blends</TabsTrigger>
              <TabsTrigger value="bundles">Bundles</TabsTrigger>
              <TabsTrigger value="management">Management</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
            </TabsList>

            <TabsContent value="discounts" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Can Apply Product Discounts</Label>
                  <Switch
                    checked={formData.featurePermissions?.discounts?.canApplyProductDiscounts || false}
                    onCheckedChange={(checked) => updateFeaturePermissions('discounts', 'canApplyProductDiscounts', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Can Apply Bill Discounts</Label>
                  <Switch
                    checked={formData.featurePermissions?.discounts?.canApplyBillDiscounts || false}
                    onCheckedChange={(checked) => updateFeaturePermissions('discounts', 'canApplyBillDiscounts', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Unlimited Discounts</Label>
                  <Switch
                    checked={formData.featurePermissions?.discounts?.unlimitedDiscounts || false}
                    onCheckedChange={(checked) => updateFeaturePermissions('discounts', 'unlimitedDiscounts', checked)}
                  />
                </div>
                {!formData.featurePermissions?.discounts?.unlimitedDiscounts && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Max Discount Percent (%)</Label>
                      <Input
                        type="number"
                        value={formData.featurePermissions?.discounts?.maxDiscountPercent || 0}
                        onChange={(e) => updateFeaturePermissions('discounts', 'maxDiscountPercent', parseInt(e.target.value) || 0)}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label>Max Discount Amount ($)</Label>
                      <Input
                        type="number"
                        value={formData.featurePermissions?.discounts?.maxDiscountAmount || 0}
                        onChange={(e) => updateFeaturePermissions('discounts', 'maxDiscountAmount', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: 'canViewInventory', label: 'View Inventory' },
                  { key: 'canAddProducts', label: 'Add Products' },
                  { key: 'canEditProducts', label: 'Edit Products' },
                  { key: 'canDeleteProducts', label: 'Delete Products' },
                  { key: 'canManageStock', label: 'Manage Stock' },
                  { key: 'canCreateRestockOrders', label: 'Create Restock Orders' },
                  { key: 'canBulkOperations', label: 'Bulk Operations' },
                  { key: 'canEditCostPrices', label: 'Edit Cost Prices' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.inventory?.[key as keyof typeof formData.featurePermissions.inventory] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('inventory', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="patients" className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: 'canAccessAllPatients', label: 'View/Access Patients' },
                  { key: 'canCreatePatients', label: 'Create Patients' },
                  { key: 'canEditPatients', label: 'Edit Patients' },
                  { key: 'canDeletePatients', label: 'Delete Patients' },
                  { key: 'canViewMedicalHistory', label: 'View Medical History' },
                  { key: 'canManagePrescriptions', label: 'Manage Prescriptions' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.patients?.[key as keyof typeof formData.featurePermissions.patients] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('patients', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: 'canViewFinancialReports', label: 'View Financial Reports' },
                  { key: 'canViewInventoryReports', label: 'View Inventory Reports' },
                  { key: 'canViewUserReports', label: 'View User Reports' },
                  { key: 'canViewSecurityMetrics', label: 'View Security Metrics' },
                  { key: 'canExportReports', label: 'Export Reports' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.reports?.[key as keyof typeof formData.featurePermissions.reports] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('reports', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="blends" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium">Blend Templates</h4>
                {[
                  { key: 'canCreateFixedBlends', label: 'Create Fixed Blends' },
                  { key: 'canEditFixedBlends', label: 'Edit Fixed Blends' },
                  { key: 'canDeleteFixedBlends', label: 'Delete Fixed Blends' },
                  { key: 'canViewFixedBlends', label: 'View Fixed Blends' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.blends?.[key as keyof typeof formData.featurePermissions.blends] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('blends', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bundles" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium">Bundle Management</h4>
                {[
                  { key: 'canViewBundles', label: 'View Bundles' },
                  { key: 'canCreateBundles', label: 'Create Bundles' },
                  { key: 'canEditBundles', label: 'Edit Bundles' },
                  { key: 'canDeleteBundles', label: 'Delete Bundles' },
                  { key: 'canSetPricing', label: 'Set Bundle Pricing' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.bundles?.[key as keyof typeof formData.featurePermissions.bundles] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('bundles', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="management" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium">Suppliers</h4>
                {[
                  { key: 'canManageSuppliers', label: 'Manage Suppliers' },
                  { key: 'canCreateSuppliers', label: 'Create Suppliers' },
                  { key: 'canEditSuppliers', label: 'Edit Suppliers' },
                  { key: 'canDeleteSuppliers', label: 'Delete Suppliers' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.suppliers?.[key as keyof typeof formData.featurePermissions.suppliers] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('suppliers', key, checked)}
                    />
                  </div>
                ))}

                <h4 className="font-medium pt-4">Brands</h4>
                {[
                  { key: 'canManageBrands', label: 'Manage Brands' },
                  { key: 'canCreateBrands', label: 'Create Brands' },
                  { key: 'canEditBrands', label: 'Edit Brands' },
                  { key: 'canDeleteBrands', label: 'Delete Brands' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.brands?.[key as keyof typeof formData.featurePermissions.brands] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('brands', key, checked)}
                    />
                  </div>
                ))}

                <h4 className="font-medium pt-4">Container Types</h4>
                {[
                  { key: 'canManageContainerTypes', label: 'Manage Container Types' },
                  { key: 'canCreateTypes', label: 'Create Types' },
                  { key: 'canEditTypes', label: 'Edit Types' },
                  { key: 'canDeleteTypes', label: 'Delete Types' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.containers?.[key as keyof typeof formData.featurePermissions.containers] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('containers', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="appointments" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium">Appointment Management</h4>
                {[
                  { key: 'canViewAllAppointments', label: 'View All Appointments' },
                  { key: 'canCreateAppointments', label: 'Create Appointments' },
                  { key: 'canEditAppointments', label: 'Edit Appointments' },
                  { key: 'canDeleteAppointments', label: 'Delete Appointments' },
                  { key: 'canManageSchedules', label: 'Manage Schedules' },
                  { key: 'canOverrideBookings', label: 'Override Bookings' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.appointments?.[key as keyof typeof formData.featurePermissions.appointments] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('appointments', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium">User Management</h4>
                {[
                  { key: 'canViewUsers', label: 'View Users' },
                  { key: 'canCreateUsers', label: 'Create Users' },
                  { key: 'canEditUsers', label: 'Edit Users' },
                  { key: 'canDeleteUsers', label: 'Delete Users' },
                  { key: 'canAssignRoles', label: 'Assign Roles' },
                  { key: 'canChangeRoles', label: 'Change User Roles' },
                  { key: 'canManagePermissions', label: 'Manage Permissions' },
                  { key: 'canResetPasswords', label: 'Reset Passwords' },
                  { key: 'canViewSecurityLogs', label: 'View Security Logs' },
                  { key: 'canViewAuditLogs', label: 'View Audit Logs' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.userManagement?.[key as keyof typeof formData.featurePermissions.userManagement] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('userManagement', key, checked)}
                    />
                  </div>
                ))}

                <h4 className="font-medium pt-4">Transactions</h4>
                {[
                  { key: 'canViewTransactions', label: 'View Transactions' },
                  { key: 'canCreateTransactions', label: 'Create Transactions' },
                  { key: 'canEditTransactions', label: 'Edit Transactions' },
                  { key: 'canEditDrafts', label: 'Edit Drafts' },
                  { key: 'canDeleteTransactions', label: 'Delete Transactions' },
                  { key: 'canApplyDiscounts', label: 'Apply Discounts' },
                  { key: 'canRefundTransactions', label: 'Refund Transactions' },
                  { key: 'canViewFinancialDetails', label: 'View Financial Details' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.transactions?.[key as keyof typeof formData.featurePermissions.transactions] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('transactions', key, checked)}
                    />
                  </div>
                ))}
                
                <h4 className="font-medium pt-4">System Administration</h4>
                {[
                  { key: 'canViewSettings', label: 'View Settings' },
                  { key: 'canEditSettings', label: 'Edit Settings' },
                  { key: 'canManageIntegrations', label: 'Manage Integrations' },
                  { key: 'canConfigureSystem', label: 'Configure System' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Switch
                      checked={formData.featurePermissions?.settings?.[key as keyof typeof formData.featurePermissions.settings] as boolean || false}
                      onCheckedChange={(checked) => updateFeaturePermissions('settings', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </form>
  )
}