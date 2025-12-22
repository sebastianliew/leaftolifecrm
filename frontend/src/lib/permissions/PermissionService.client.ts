// Client-safe version of PermissionService
// Note: Types are imported directly from types.ts to avoid module resolution conflicts
import type { FeaturePermissions } from './types';

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
          inventory: {
            canViewInventory: true,
            canAddProducts: true,
            canEditProducts: true,
            canDeleteProducts: true,
            canManageStock: true,
            canCreateRestockOrders: true,
            canBulkOperations: true,
            canEditCostPrices: false,
          },
          patients: {
            canCreatePatients: true,
            canEditPatients: true,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: true,
          },
          reports: {
            canViewFinancialReports: false,
            canViewInventoryReports: true,
            canViewUserReports: false,
            canViewSecurityMetrics: false,
            canExportReports: true,
          },
          settings: {
            canViewSettings: true,
            canEditSettings: false,
            canManageIntegrations: false,
            canConfigureSystem: false,
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
            canViewAuditLogs: false,
          },
          transactions: {
            canViewTransactions: true,
            canCreateTransactions: true,
            canEditTransactions: true,
            canDeleteTransactions: false,
            canApplyDiscounts: true,
            canRefundTransactions: false,
            canViewFinancialDetails: true,
          },
          bundles: {
            canViewBundles: true,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: false,
          },
          discounts: {
            canApplyProductDiscounts: true,
            canApplyBillDiscounts: true,
            maxDiscountPercent: 15,
            maxDiscountAmount: 100,
            unlimitedDiscounts: false,
          },
        },
      },
      {
        name: 'cashier',
        displayName: 'Cashier',
        description: 'Basic billing and patient interaction',
        permissions: {
          inventory: {
            canViewInventory: true,
            canAddProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageStock: false,
            canCreateRestockOrders: false,
            canBulkOperations: false,
            canEditCostPrices: false,
          },
          patients: {
            canCreatePatients: true,
            canEditPatients: true,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: false,
          },
          reports: {
            canViewFinancialReports: false,
            canViewInventoryReports: false,
            canViewUserReports: false,
            canViewSecurityMetrics: false,
            canExportReports: false,
          },
          settings: {
            canViewSettings: false,
            canEditSettings: false,
            canManageIntegrations: false,
            canConfigureSystem: false,
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
            canViewAuditLogs: false,
          },
          transactions: {
            canViewTransactions: true,
            canCreateTransactions: true,
            canEditTransactions: false,
            canDeleteTransactions: false,
            canApplyDiscounts: true,
            canRefundTransactions: false,
            canViewFinancialDetails: false,
          },
          bundles: {
            canViewBundles: true,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: false,
          },
          discounts: {
            canApplyProductDiscounts: true,
            canApplyBillDiscounts: false,
            maxDiscountPercent: 5,
            maxDiscountAmount: 50,
            unlimitedDiscounts: false,
          },
        },
      },
      {
        name: 'stock_controller',
        displayName: 'Stock Controller',
        description: 'Inventory management without pricing control',
        permissions: {
          inventory: {
            canViewInventory: true,
            canAddProducts: true,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageStock: true,
            canCreateRestockOrders: true,
            canBulkOperations: false,
            canEditCostPrices: false,
          },
          patients: {
            canCreatePatients: false,
            canEditPatients: false,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: false,
          },
          reports: {
            canViewFinancialReports: false,
            canViewInventoryReports: true,
            canViewUserReports: false,
            canViewSecurityMetrics: false,
            canExportReports: true,
          },
          settings: {
            canViewSettings: false,
            canEditSettings: false,
            canManageIntegrations: false,
            canConfigureSystem: false,
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
            canViewAuditLogs: false,
          },
          transactions: {
            canViewTransactions: false,
            canCreateTransactions: false,
            canEditTransactions: false,
            canDeleteTransactions: false,
            canApplyDiscounts: false,
            canRefundTransactions: false,
            canViewFinancialDetails: false,
          },
          bundles: {
            canViewBundles: false,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: false,
          },
          discounts: {
            canApplyProductDiscounts: false,
            canApplyBillDiscounts: false,
            maxDiscountPercent: 0,
            maxDiscountAmount: 0,
            unlimitedDiscounts: false,
          },
        },
      },
      {
        name: 'accountant',
        displayName: 'Accountant',
        description: 'Financial reporting and analysis',
        permissions: {
          inventory: {
            canViewInventory: false,
            canAddProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageStock: false,
            canCreateRestockOrders: false,
            canBulkOperations: false,
            canEditCostPrices: false,
          },
          patients: {
            canCreatePatients: false,
            canEditPatients: false,
            canDeletePatients: false,
            canViewMedicalHistory: false,
            canManagePrescriptions: false,
            canAccessAllPatients: false,
          },
          reports: {
            canViewFinancialReports: true,
            canViewInventoryReports: true,
            canViewUserReports: true,
            canViewSecurityMetrics: false,
            canExportReports: true,
          },
          settings: {
            canViewSettings: false,
            canEditSettings: false,
            canManageIntegrations: false,
            canConfigureSystem: false,
          },
          userManagement: {
            canViewUsers: true,
            canCreateUsers: true,
            canEditUsers: true,
            canDeleteUsers: true,
            canAssignRoles: false,
            canChangeRoles: false,
            canManagePermissions: false,
            canResetPasswords: true,
            canViewSecurityLogs: true,
            canViewAuditLogs: true,
          },
          transactions: {
            canViewTransactions: true,
            canCreateTransactions: false,
            canEditTransactions: false,
            canDeleteTransactions: false,
            canApplyDiscounts: false,
            canRefundTransactions: false,
            canViewFinancialDetails: true,
          },
          bundles: {
            canViewBundles: false,
            canCreateBundles: false,
            canEditBundles: false,
            canDeleteBundles: false,
            canSetPricing: false,
          },
          discounts: {
            canApplyProductDiscounts: false,
            canApplyBillDiscounts: false,
            maxDiscountPercent: 0,
            maxDiscountAmount: 0,
            unlimitedDiscounts: false,
          },
        },
      },
    ];
  }

  // Get default permissions for a role
  public getRoleDefaults(role: string): Partial<FeaturePermissions> {
    const templates = this.getRoleTemplates();
    const template = templates.find(t => t.name === role);
    if (template) {
      return template.permissions;
    }

    // Default permissions based on role
    switch (role) {
      case 'super_admin':
        return {
          inventory: { canViewInventory: true, canAddProducts: true, canEditProducts: true, canDeleteProducts: true, canManageStock: true, canCreateRestockOrders: true, canBulkOperations: true, canEditCostPrices: true },
          patients: { canCreatePatients: true, canEditPatients: true, canDeletePatients: true, canViewMedicalHistory: true, canManagePrescriptions: true, canAccessAllPatients: true },
          reports: { canViewFinancialReports: true, canViewInventoryReports: true, canViewUserReports: true, canViewSecurityMetrics: true, canExportReports: true },
          settings: { canViewSettings: true, canEditSettings: true, canManageIntegrations: true, canConfigureSystem: true },
          userManagement: { canViewUsers: true, canCreateUsers: true, canEditUsers: true, canDeleteUsers: true, canAssignRoles: true, canChangeRoles: true, canManagePermissions: true, canResetPasswords: true, canViewSecurityLogs: true, canViewAuditLogs: true },
          transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: true, canDeleteTransactions: true, canApplyDiscounts: true, canRefundTransactions: true, canViewFinancialDetails: true },
          bundles: { canViewBundles: true, canCreateBundles: true, canEditBundles: true, canDeleteBundles: true, canSetPricing: true },
          discounts: { canApplyProductDiscounts: true, canApplyBillDiscounts: true, maxDiscountPercent: 100, maxDiscountAmount: 999999, unlimitedDiscounts: true },
          blends: { canCreateFixedBlends: true, canEditFixedBlends: true, canDeleteFixedBlends: true, canViewFixedBlends: true, canCreateCustomBlends: true },
          suppliers: { canManageSuppliers: true, canCreateSuppliers: true, canEditSuppliers: true, canDeleteSuppliers: true },
          brands: { canManageBrands: true, canCreateBrands: true, canEditBrands: true, canDeleteBrands: true },
          containers: { canManageContainerTypes: true, canCreateTypes: true, canEditTypes: true, canDeleteTypes: true },
          appointments: { canViewAllAppointments: true, canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: true, canManageSchedules: true, canOverrideBookings: true },
        };
      case 'admin':
        return {
          inventory: { canViewInventory: true, canAddProducts: true, canEditProducts: true, canDeleteProducts: false, canManageStock: true, canCreateRestockOrders: true, canBulkOperations: true, canEditCostPrices: false },
          patients: { canCreatePatients: true, canEditPatients: true, canDeletePatients: false, canViewMedicalHistory: true, canManagePrescriptions: true, canAccessAllPatients: true },
          reports: { canViewFinancialReports: true, canViewInventoryReports: true, canViewUserReports: true, canViewSecurityMetrics: false, canExportReports: true },
          settings: { canViewSettings: true, canEditSettings: true, canManageIntegrations: false, canConfigureSystem: false },
          userManagement: { canViewUsers: true, canCreateUsers: true, canEditUsers: true, canDeleteUsers: false, canAssignRoles: false, canChangeRoles: false, canManagePermissions: false, canResetPasswords: true, canViewSecurityLogs: true, canViewAuditLogs: true },
          transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: true, canDeleteTransactions: false, canApplyDiscounts: true, canRefundTransactions: true, canViewFinancialDetails: true },
          bundles: { canViewBundles: true, canCreateBundles: true, canEditBundles: true, canDeleteBundles: false, canSetPricing: true },
          discounts: { canApplyProductDiscounts: true, canApplyBillDiscounts: true, maxDiscountPercent: 50, maxDiscountAmount: 1000, unlimitedDiscounts: false },
          blends: { canCreateFixedBlends: false, canEditFixedBlends: false, canDeleteFixedBlends: false, canViewFixedBlends: true, canCreateCustomBlends: false },
          suppliers: { canManageSuppliers: true, canCreateSuppliers: true, canEditSuppliers: true, canDeleteSuppliers: false },
          brands: { canManageBrands: true, canCreateBrands: true, canEditBrands: true, canDeleteBrands: false },
          containers: { canManageContainerTypes: true, canCreateTypes: true, canEditTypes: true, canDeleteTypes: false },
          appointments: { canViewAllAppointments: true, canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: false, canManageSchedules: true, canOverrideBookings: false },
        };
      case 'manager':
        return {
          inventory: { canViewInventory: true, canAddProducts: true, canEditProducts: true, canDeleteProducts: false, canManageStock: true, canCreateRestockOrders: true, canBulkOperations: false, canEditCostPrices: false },
          patients: { canCreatePatients: true, canEditPatients: true, canDeletePatients: false, canViewMedicalHistory: true, canManagePrescriptions: true, canAccessAllPatients: true },
          reports: { canViewFinancialReports: true, canViewInventoryReports: true, canViewUserReports: false, canViewSecurityMetrics: false, canExportReports: true },
          settings: { canViewSettings: true, canEditSettings: false, canManageIntegrations: false, canConfigureSystem: false },
          userManagement: { canViewUsers: true, canCreateUsers: false, canEditUsers: false, canDeleteUsers: false, canAssignRoles: false, canChangeRoles: false, canManagePermissions: false, canResetPasswords: false, canViewSecurityLogs: false, canViewAuditLogs: false },
          transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: true, canDeleteTransactions: false, canApplyDiscounts: true, canRefundTransactions: false, canViewFinancialDetails: true },
          bundles: { canViewBundles: true, canCreateBundles: false, canEditBundles: false, canDeleteBundles: false, canSetPricing: false },
          discounts: { canApplyProductDiscounts: true, canApplyBillDiscounts: true, maxDiscountPercent: 30, maxDiscountAmount: 500, unlimitedDiscounts: false },
          blends: { canCreateFixedBlends: false, canEditFixedBlends: false, canDeleteFixedBlends: false, canViewFixedBlends: true, canCreateCustomBlends: true },
          suppliers: { canManageSuppliers: true, canCreateSuppliers: false, canEditSuppliers: false, canDeleteSuppliers: false },
          brands: { canManageBrands: true, canCreateBrands: false, canEditBrands: false, canDeleteBrands: false },
          containers: { canManageContainerTypes: true, canCreateTypes: false, canEditTypes: false, canDeleteTypes: false },
          appointments: { canViewAllAppointments: true, canCreateAppointments: true, canEditAppointments: true, canDeleteAppointments: false, canManageSchedules: false, canOverrideBookings: false },
        };
      case 'staff':
        return {
          inventory: { canViewInventory: true, canAddProducts: false, canEditProducts: false, canDeleteProducts: false, canManageStock: false, canCreateRestockOrders: false, canBulkOperations: false, canEditCostPrices: false },
          patients: { canCreatePatients: true, canEditPatients: false, canDeletePatients: false, canViewMedicalHistory: false, canManagePrescriptions: false, canAccessAllPatients: false },
          reports: { canViewFinancialReports: false, canViewInventoryReports: false, canViewUserReports: false, canViewSecurityMetrics: false, canExportReports: false },
          settings: { canViewSettings: false, canEditSettings: false, canManageIntegrations: false, canConfigureSystem: false },
          userManagement: { canViewUsers: false, canCreateUsers: false, canEditUsers: false, canDeleteUsers: false, canAssignRoles: false, canChangeRoles: false, canManagePermissions: false, canResetPasswords: false, canViewSecurityLogs: false, canViewAuditLogs: false },
          transactions: { canViewTransactions: true, canCreateTransactions: true, canEditTransactions: false, canDeleteTransactions: false, canApplyDiscounts: true, canRefundTransactions: false, canViewFinancialDetails: false },
          bundles: { canViewBundles: true, canCreateBundles: false, canEditBundles: false, canDeleteBundles: false, canSetPricing: false },
          discounts: { canApplyProductDiscounts: false, canApplyBillDiscounts: false, maxDiscountPercent: 0, maxDiscountAmount: 0, unlimitedDiscounts: false },
          blends: { canCreateFixedBlends: false, canEditFixedBlends: false, canDeleteFixedBlends: false, canViewFixedBlends: false, canCreateCustomBlends: false },
          suppliers: { canManageSuppliers: false, canCreateSuppliers: false, canEditSuppliers: false, canDeleteSuppliers: false },
          brands: { canManageBrands: false, canCreateBrands: false, canEditBrands: false, canDeleteBrands: false },
          containers: { canManageContainerTypes: false, canCreateTypes: false, canEditTypes: false, canDeleteTypes: false },
          appointments: { canViewAllAppointments: false, canCreateAppointments: false, canEditAppointments: false, canDeleteAppointments: false, canManageSchedules: false, canOverrideBookings: false },
        };
      default:
        return this.getRoleDefaults('staff'); // Default to staff permissions
    }
  }
}