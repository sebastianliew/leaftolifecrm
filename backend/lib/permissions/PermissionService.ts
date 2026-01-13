import { User } from '../../models/User.js';
import type { PermissionCheck, FeaturePermissions } from './types.js';

export interface RoleTemplate {
  name: string;
  displayName: string;
  description: string;
  permissions: Partial<FeaturePermissions>;
}

export class PermissionService {
  private static instance: PermissionService;

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  // Role-based permission templates
  public getRoleTemplates(): RoleTemplate[] {
    return [
      {
        name: 'pharmacy_manager',
        displayName: 'Pharmacy Manager',
        description: 'Full inventory management with limited financial access',
        permissions: {
          discounts: {
            canApplyProductDiscounts: true,
            canApplyBillDiscounts: true,
            maxDiscountPercent: 25,
            maxDiscountAmount: 500,
            unlimitedDiscounts: false
          },
          reports: {
            canViewFinancialReports: false,
            canViewInventoryReports: true,
            canViewUserReports: false,
            canViewSecurityMetrics: false,
            canExportReports: true
          },
          inventory: {
            canViewInventory: true,
            canAddProducts: true,
            canEditProducts: true,
            canDeleteProducts: false,
            canManageStock: true,
            canCreateRestockOrders: true,
            canBulkOperations: true,
            canEditCostPrices: true
          },
          userManagement: {
            canViewUsers: false,
            canCreateUsers: false,
            canEditUsers: false,
            canDeleteUsers: false,
            canAssignRoles: false,
            canChangeRoles: false,
            canManagePermissions: false,
            canResetPasswords: false,
            canViewSecurityLogs: false,
            canViewAuditLogs: false
          },
          patients: {
            canCreatePatients: true,
            canEditPatients: true,
            canDeletePatients: false,
            canViewMedicalHistory: true,
            canManagePrescriptions: true,
            canAccessAllPatients: true
          },
          transactions: {
            canViewTransactions: true,
            canCreateTransactions: true,
            canEditTransactions: true,
            canEditDrafts: true,
            canDeleteTransactions: false,
            canApplyDiscounts: true,
            canRefundTransactions: false,
            canViewFinancialDetails: true
          },
          bundles: {
            canViewBundles: true,
            canCreateBundles: true,
            canEditBundles: true,
            canDeleteBundles: false,
            canSetPricing: true
          },
          security: {
            canViewSecurityLogs: false,
            canManageSecurity: false,
            canViewAuditTrails: false,
            canManageApiKeys: false
          }
        }
      },
      {
        name: 'sales_staff',
        displayName: 'Sales Staff',
        description: 'Transaction processing with basic inventory access',
        permissions: {
          discounts: {
            canApplyProductDiscounts: false,
            canApplyBillDiscounts: true,
            maxDiscountPercent: 10,
            maxDiscountAmount: 100,
            unlimitedDiscounts: false
          },
          reports: {
            canViewFinancialReports: false,
            canViewInventoryReports: false,
            canViewUserReports: false,
            canViewSecurityMetrics: false,
            canExportReports: false
          },
          inventory: {
            canViewInventory: true,
            canAddProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageStock: false,
            canCreateRestockOrders: false,
            canBulkOperations: false,
            canEditCostPrices: false
          },
          userManagement: {
            canViewUsers: false,
            canCreateUsers: false,
            canEditUsers: false,
            canDeleteUsers: false,
            canAssignRoles: false,
            canChangeRoles: false,
            canManagePermissions: false,
            canResetPasswords: false,
            canViewSecurityLogs: false,
            canViewAuditLogs: false
          },
          patients: {
            canCreatePatients: true,
            canEditPatients: false,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: true
          },
          transactions: {
            canViewTransactions: true,
            canCreateTransactions: true,
            canEditTransactions: false,
            canEditDrafts: true,
            canDeleteTransactions: false,
            canRefundTransactions: false,
            canApplyDiscounts: true,
            canViewFinancialDetails: true
          },
          bundles: {
            canViewBundles: true,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: false
          },
          security: {
            canViewSecurityLogs: false,
            canManageSecurity: false,
            canViewAuditTrails: false,
            canManageApiKeys: false
          }
        }
      },
      {
        name: 'financial_officer',
        displayName: 'Financial Officer',
        description: 'All financial features with reporting access',
        permissions: {
          discounts: {
            canApplyProductDiscounts: true,
            canApplyBillDiscounts: true,
            maxDiscountPercent: 50,
            maxDiscountAmount: 2000,
            unlimitedDiscounts: false
          },
          reports: {
            canViewFinancialReports: true,
            canViewInventoryReports: true,
            canViewUserReports: false,
            canViewSecurityMetrics: false,
            canExportReports: true
          },
          inventory: {
            canViewInventory: true,
            canAddProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageStock: false,
            canCreateRestockOrders: false,
            canBulkOperations: false,
            canEditCostPrices: false
          },
          userManagement: {
            canViewUsers: false,
            canCreateUsers: false,
            canEditUsers: false,
            canDeleteUsers: false,
            canAssignRoles: false,
            canChangeRoles: false,
            canManagePermissions: false,
            canResetPasswords: false,
            canViewSecurityLogs: false,
            canViewAuditLogs: false
          },
          patients: {
            canCreatePatients: true,
            canEditPatients: false,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: true
          },
          transactions: {
            canViewTransactions: true,
            canCreateTransactions: true,
            canEditTransactions: true,
            canEditDrafts: true,
            canDeleteTransactions: true,
            canApplyDiscounts: true,
            canRefundTransactions: true,
            canViewFinancialDetails: true
          },
          bundles: {
            canViewBundles: true,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: true
          },
          security: {
            canViewSecurityLogs: false,
            canManageSecurity: false,
            canViewAuditTrails: false,
            canManageApiKeys: false
          }
        }
      },
      {
        name: 'it_administrator',
        displayName: 'IT Administrator',
        description: 'System administration and user management',
        permissions: {
          discounts: {
            canApplyProductDiscounts: false,
            canApplyBillDiscounts: false,
            maxDiscountPercent: 0,
            maxDiscountAmount: 0,
            unlimitedDiscounts: false
          },
          reports: {
            canViewFinancialReports: false,
            canViewInventoryReports: false,
            canViewUserReports: true,
            canViewSecurityMetrics: true,
            canExportReports: true
          },
          inventory: {
            canViewInventory: false,
            canAddProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageStock: false,
            canCreateRestockOrders: false,
            canBulkOperations: false,
            canEditCostPrices: false
          },
          userManagement: {
            canViewUsers: true,
            canCreateUsers: true,
            canEditUsers: true,
            canDeleteUsers: true,
            canAssignRoles: true,
            canChangeRoles: true,
            canManagePermissions: true,
            canResetPasswords: true,
            canViewSecurityLogs: true,
            canViewAuditLogs: true
          },
          patients: {
            canCreatePatients: false,
            canEditPatients: false,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: false
          },
          transactions: {
            canViewTransactions: false,
            canCreateTransactions: false,
            canEditTransactions: false,
            canEditDrafts: false,
            canDeleteTransactions: false,
            canApplyDiscounts: false,
            canRefundTransactions: false,
            canViewFinancialDetails: false
          },
          bundles: {
            canViewBundles: false,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: false
          },
          settings: {
            canViewSettings: true,
            canEditSettings: true,
            canManageIntegrations: true,
            canConfigureSystem: true
          }
        }
      }
    ];
  }

  // Check if user has specific feature permission
  public hasPermission(user: { role: string; featurePermissions?: Partial<FeaturePermissions> }, category: keyof FeaturePermissions, permission: string): boolean {
    // Super admin has unlimited access
    if (user.role === 'super_admin') {
      return true;
    }

    // Check if user has an explicit override for this permission
    if (user.featurePermissions && user.featurePermissions[category]) {
      const categoryPerms = user.featurePermissions[category as keyof FeaturePermissions] as Record<string, boolean | number>;
      // Check if the permission key exists (including explicit false values)
      if (categoryPerms && permission in categoryPerms) {
        const value = categoryPerms[permission];
        return typeof value === 'boolean' ? value : !!value;
      }
    }

    // Fallback to role-based defaults only if no user override exists
    const roleDefaults = this.getRoleDefaults(user.role);
    const categoryDefaults = roleDefaults[category as keyof FeaturePermissions] as Record<string, boolean | number>;
    const value = categoryDefaults?.[permission];
    return typeof value === 'boolean' ? value : !!value;
  }

  // Check discount permissions with limits
  public checkDiscountPermission(user: { role: string; featurePermissions?: Partial<FeaturePermissions> }, discountPercent: number = 0, discountAmount: number = 0, type: 'product' | 'bill' = 'bill'): PermissionCheck {
    // Super admin has unlimited access
    if (user.role === 'super_admin') {
      return { allowed: true };
    }

    // Get discount permissions: merge role defaults with user overrides
    const roleDefaults = this.getRoleDefaults(user.role).discounts;
    const userOverrides = user.featurePermissions?.discounts || {};
    const discountPerms = { ...roleDefaults, ...userOverrides };

    // Check if user can apply this type of discount
    if (type === 'product' && !discountPerms.canApplyProductDiscounts) {
      return { allowed: false, reason: 'No product discount permissions' };
    }
    if (type === 'bill' && !discountPerms.canApplyBillDiscounts) {
      return { allowed: false, reason: 'No bill discount permissions' };
    }

    // Check limits
    if (discountPerms.unlimitedDiscounts) {
      return { allowed: true };
    }

    if (discountPercent > discountPerms.maxDiscountPercent) {
      return { 
        allowed: false, 
        reason: `Discount percent exceeds limit of ${discountPerms.maxDiscountPercent}%` 
      };
    }

    if (discountAmount > discountPerms.maxDiscountAmount) {
      return { 
        allowed: false, 
        reason: `Discount amount exceeds limit of $${discountPerms.maxDiscountAmount}` 
      };
    }

    return { allowed: true };
  }

  // Bulk permission operations
  public async updateUserPermissions(userId: string, permissions: Partial<FeaturePermissions>): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { featurePermissions: permissions }
    });
  }

  public async applyRoleTemplate(userId: string, templateName: string): Promise<void> {
    const template = this.getRoleTemplates().find(t => t.name === templateName);
    if (!template) {
      throw new Error(`Role template '${templateName}' not found`);
    }

    await this.updateUserPermissions(userId, template.permissions);
  }

  public async bulkUpdatePermissions(userIds: string[], permissions: Partial<FeaturePermissions>): Promise<void> {
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { featurePermissions: permissions } }
    );
  }

  // Get effective permissions for a user (combines role defaults with overrides)
  public getEffectivePermissions(user: { role: string; featurePermissions?: Partial<FeaturePermissions> }): FeaturePermissions {
    const roleDefaults = this.getRoleDefaults(user.role);
    const userOverrides = user.featurePermissions || {};

    // Deep merge role defaults with user overrides
    const effective: FeaturePermissions = { ...roleDefaults };
    
    Object.keys(userOverrides).forEach(category => {
      if (effective[category as keyof FeaturePermissions]) {
        Object.assign(
          effective[category as keyof FeaturePermissions], 
          (userOverrides as Record<string, Record<string, boolean | number>>)[category]
        );
      }
    });

    return effective;
  }

  // Get role-based default permissions
  public getRoleDefaults(role: string): FeaturePermissions {
    const roleDefaults: Record<string, FeaturePermissions> = {
      super_admin: {
        discounts: { canApplyProductDiscounts: true, canApplyBillDiscounts: true, maxDiscountPercent: 100, maxDiscountAmount: 999999, unlimitedDiscounts: true },
        reports: { canViewFinancialReports: true, canViewInventoryReports: true, canViewUserReports: true, canViewSecurityMetrics: true, canExportReports: true },
        inventory: { canViewInventory: true, canAddProducts: true, canEditProducts: true, canDeleteProducts: true, canManageStock: true, canCreateRestockOrders: true, canBulkOperations: true, canEditCostPrices: true },
        userManagement: { canViewUsers: true, canCreateUsers: true, canEditUsers: true, canDeleteUsers: true, canAssignRoles: true, canChangeRoles: true, canManagePermissions: true, canResetPasswords: true, canViewSecurityLogs: true, canViewAuditLogs: true },
        patients: { canCreatePatients: true, canEditPatients: true, canDeletePatients: true, canViewMedicalHistory: true, canManagePrescriptions: true, canAccessAllPatients: true },
        transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: true, canEditDrafts: true, canDeleteTransactions: true, canApplyDiscounts: true, canRefundTransactions: true, canViewFinancialDetails: true },
        bundles: { canViewBundles: true, canCreateBundles: true, canEditBundles: true, canDeleteBundles: true, canSetPricing: true },
        suppliers: { canManageSuppliers: true, canCreateSuppliers: true, canEditSuppliers: true, canDeleteSuppliers: true },
        blends: { canCreateFixedBlends: true, canEditFixedBlends: true, canDeleteFixedBlends: true, canViewFixedBlends: true, canCreateCustomBlends: true },
        prescriptions: { canCreatePrescriptions: true, canEditPrescriptions: true, canDeletePrescriptions: true, canViewAllPrescriptions: true, canPrintPrescriptions: true, canManageTemplates: true },
        appointments: { canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: true, canViewAllAppointments: true, canManageSchedules: true, canOverrideBookings: true },
        containers: { canManageContainerTypes: true, canCreateTypes: true, canEditTypes: true, canDeleteTypes: true },
        brands: { canManageBrands: true, canCreateBrands: true, canEditBrands: true, canDeleteBrands: true },
        dosageForms: { canManageDosageForms: true, canCreateForms: true, canEditForms: true, canDeleteForms: true },
        categories: { canManageCategories: true, canCreateCategories: true, canEditCategories: true, canDeleteCategories: true },
        units: { canManageUnits: true, canCreateUnits: true, canEditUnits: true, canDeleteUnits: true },
        documents: { canUploadDocuments: true, canViewDocuments: true, canDeleteDocuments: true, canManageFolders: true },
        security: { canViewSecurityLogs: true, canManageSecurity: true, canViewAuditTrails: true, canManageApiKeys: true },
        settings: { canViewSettings: true, canEditSettings: true, canManageIntegrations: true, canConfigureSystem: true }
      },
      admin: {
        discounts: { canApplyProductDiscounts: true, canApplyBillDiscounts: true, maxDiscountPercent: 50, maxDiscountAmount: 1000, unlimitedDiscounts: false },
        reports: { canViewFinancialReports: true, canViewInventoryReports: true, canViewUserReports: true, canViewSecurityMetrics: false, canExportReports: true },
        inventory: { canViewInventory: true, canAddProducts: true, canEditProducts: true, canDeleteProducts: true, canManageStock: true, canCreateRestockOrders: true, canBulkOperations: true, canEditCostPrices: false }, // Cost prices restricted to super_admin only
        userManagement: { canViewUsers: true, canCreateUsers: true, canEditUsers: true, canDeleteUsers: false, canAssignRoles: false, canChangeRoles: false, canManagePermissions: false, canResetPasswords: true, canViewSecurityLogs: true, canViewAuditLogs: true },
        patients: { canCreatePatients: true, canEditPatients: true, canDeletePatients: true, canViewMedicalHistory: true, canManagePrescriptions: true, canAccessAllPatients: true },
        transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: true, canEditDrafts: true, canDeleteTransactions: false, canApplyDiscounts: true, canRefundTransactions: true, canViewFinancialDetails: true },
        bundles: { canViewBundles: true, canCreateBundles: true, canEditBundles: true, canDeleteBundles: false, canSetPricing: true },
        suppliers: { canManageSuppliers: false, canCreateSuppliers: false, canEditSuppliers: false, canDeleteSuppliers: false },
        blends: { canCreateFixedBlends: false, canEditFixedBlends: false, canDeleteFixedBlends: false, canViewFixedBlends: true, canCreateCustomBlends: false },
        prescriptions: { canCreatePrescriptions: true, canEditPrescriptions: true, canDeletePrescriptions: false, canViewAllPrescriptions: true, canPrintPrescriptions: true, canManageTemplates: false },
        appointments: { canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: false, canViewAllAppointments: true, canManageSchedules: true, canOverrideBookings: false },
        containers: { canManageContainerTypes: false, canCreateTypes: false, canEditTypes: false, canDeleteTypes: false },
        brands: { canManageBrands: false, canCreateBrands: false, canEditBrands: false, canDeleteBrands: false },
        dosageForms: { canManageDosageForms: false, canCreateForms: false, canEditForms: false, canDeleteForms: false },
        categories: { canManageCategories: false, canCreateCategories: false, canEditCategories: false, canDeleteCategories: false },
        units: { canManageUnits: false, canCreateUnits: false, canEditUnits: false, canDeleteUnits: false },
        documents: { canUploadDocuments: true, canViewDocuments: true, canDeleteDocuments: false, canManageFolders: false },
        security: { canViewSecurityLogs: true, canManageSecurity: false, canViewAuditTrails: true, canManageApiKeys: false },
        settings: { canViewSettings: false, canEditSettings: false, canManageIntegrations: false, canConfigureSystem: false }
      },
      manager: {
        discounts: { canApplyProductDiscounts: true, canApplyBillDiscounts: true, maxDiscountPercent: 25, maxDiscountAmount: 500, unlimitedDiscounts: false },
        reports: { canViewFinancialReports: true, canViewInventoryReports: true, canViewUserReports: false, canViewSecurityMetrics: false, canExportReports: true },
        inventory: { canViewInventory: true, canAddProducts: true, canEditProducts: true, canDeleteProducts: false, canManageStock: true, canCreateRestockOrders: true, canBulkOperations: false, canEditCostPrices: false }, // Cost prices restricted to super_admin only
        userManagement: { canViewUsers: true, canCreateUsers: false, canEditUsers: false, canDeleteUsers: false, canAssignRoles: false, canChangeRoles: false, canManagePermissions: false, canResetPasswords: false, canViewSecurityLogs: false, canViewAuditLogs: false },
        patients: { canCreatePatients: true, canEditPatients: true, canDeletePatients: false, canViewMedicalHistory: true, canManagePrescriptions: true, canAccessAllPatients: true },
        transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: true, canEditDrafts: true, canDeleteTransactions: false, canApplyDiscounts: true, canRefundTransactions: false, canViewFinancialDetails: true },
        bundles: { canViewBundles: true, canCreateBundles: false, canEditBundles: false, canDeleteBundles: false, canSetPricing: false },
        suppliers: { canManageSuppliers: true, canCreateSuppliers: false, canEditSuppliers: false, canDeleteSuppliers: false },
        blends: { canCreateFixedBlends: false, canEditFixedBlends: false, canDeleteFixedBlends: false, canViewFixedBlends: true, canCreateCustomBlends: true },
        prescriptions: { canCreatePrescriptions: true, canEditPrescriptions: true, canDeletePrescriptions: false, canViewAllPrescriptions: true, canPrintPrescriptions: true, canManageTemplates: false },
        appointments: { canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: false, canViewAllAppointments: false, canManageSchedules: false, canOverrideBookings: false },
        containers: { canManageContainerTypes: false, canCreateTypes: false, canEditTypes: false, canDeleteTypes: false },
        brands: { canManageBrands: false, canCreateBrands: false, canEditBrands: false, canDeleteBrands: false },
        dosageForms: { canManageDosageForms: false, canCreateForms: false, canEditForms: false, canDeleteForms: false },
        categories: { canManageCategories: false, canCreateCategories: false, canEditCategories: false, canDeleteCategories: false },
        units: { canManageUnits: false, canCreateUnits: false, canEditUnits: false, canDeleteUnits: false },
        documents: { canUploadDocuments: false, canViewDocuments: true, canDeleteDocuments: false, canManageFolders: false },
        security: { canViewSecurityLogs: false, canManageSecurity: false, canViewAuditTrails: false, canManageApiKeys: false },
        settings: { canViewSettings: false, canEditSettings: false, canManageIntegrations: true, canConfigureSystem: false }
      },
      staff: {
        discounts: { canApplyProductDiscounts: false, canApplyBillDiscounts: true, maxDiscountPercent: 10, maxDiscountAmount: 100, unlimitedDiscounts: false },
        reports: { canViewFinancialReports: false, canViewInventoryReports: false, canViewUserReports: false, canViewSecurityMetrics: false, canExportReports: false },
        inventory: { canViewInventory: true, canAddProducts: false, canEditProducts: false, canDeleteProducts: false, canManageStock: false, canCreateRestockOrders: false, canBulkOperations: false, canEditCostPrices: false },
        userManagement: { canViewUsers: false, canCreateUsers: false, canEditUsers: false, canDeleteUsers: false, canAssignRoles: false, canChangeRoles: false, canManagePermissions: false, canResetPasswords: false, canViewSecurityLogs: false, canViewAuditLogs: false },
        patients: { canCreatePatients: true, canEditPatients: false, canDeletePatients: false, canViewMedicalHistory: false, canManagePrescriptions: false, canAccessAllPatients: true },
        transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: false, canEditDrafts: true, canDeleteTransactions: false, canApplyDiscounts: true, canRefundTransactions: false, canViewFinancialDetails: false },
        bundles: { canViewBundles: true, canCreateBundles: false, canEditBundles: false, canDeleteBundles: false, canSetPricing: false },
        suppliers: { canManageSuppliers: false, canCreateSuppliers: false, canEditSuppliers: false, canDeleteSuppliers: false },
        blends: { canCreateFixedBlends: false, canEditFixedBlends: false, canDeleteFixedBlends: false, canViewFixedBlends: false, canCreateCustomBlends: false },
        prescriptions: { canCreatePrescriptions: false, canEditPrescriptions: false, canDeletePrescriptions: false, canViewAllPrescriptions: false, canPrintPrescriptions: false, canManageTemplates: false },
        appointments: { canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: false, canViewAllAppointments: false, canManageSchedules: false, canOverrideBookings: false },
        containers: { canManageContainerTypes: false, canCreateTypes: false, canEditTypes: false, canDeleteTypes: false },
        brands: { canManageBrands: false, canCreateBrands: false, canEditBrands: false, canDeleteBrands: false },
        dosageForms: { canManageDosageForms: false, canCreateForms: false, canEditForms: false, canDeleteForms: false },
        categories: { canManageCategories: false, canCreateCategories: false, canEditCategories: false, canDeleteCategories: false },
        units: { canManageUnits: false, canCreateUnits: false, canEditUnits: false, canDeleteUnits: false },
        documents: { canUploadDocuments: false, canViewDocuments: true, canDeleteDocuments: false, canManageFolders: false },
        security: { canViewSecurityLogs: false, canManageSecurity: false, canViewAuditTrails: false, canManageApiKeys: false },
        settings: { canViewSettings: false, canEditSettings: false, canManageIntegrations: false, canConfigureSystem: false }
      }
    };

    return roleDefaults[role] || roleDefaults.staff;
  }

  // Permission validation helpers
  public validatePermissionStructure(permissions: unknown): permissions is FeaturePermissions {
    if (!permissions || typeof permissions !== 'object') {
      return false;
    }
    
    const permObj = permissions as Record<string, unknown>;
    const requiredCategories = ['discounts', 'reports', 'inventory', 'transactions', 'patients', 'userManagement', 'prescriptions', 'appointments', 'bundles', 'blends', 'containers', 'brands', 'dosageForms', 'categories', 'units', 'suppliers', 'documents', 'security', 'settings'];
    
    for (const category of requiredCategories) {
      if (!permObj[category] || typeof permObj[category] !== 'object') {
        return false;
      }
    }
    
    return true;
  }

  // Get permission summary for UI display
  public getPermissionSummary(user: { role: string; featurePermissions?: Partial<FeaturePermissions> }): { category: string; permissions: string[] }[] {
    const effective = this.getEffectivePermissions(user);
    const summary: { category: string; permissions: string[] }[] = [];

    Object.entries(effective).forEach(([category, perms]) => {
      const enabledPermissions = Object.entries(perms as Record<string, unknown>)
        .filter(([_, value]) => value === true)
        .map(([key, _]) => key);
      
      if (enabledPermissions.length > 0) {
        summary.push({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          permissions: enabledPermissions
        });
      }
    });

    return summary;
  }
}

// Re-export types at the end to maintain backward compatibility
export type { PermissionCheck, FeaturePermissions };

export default PermissionService;