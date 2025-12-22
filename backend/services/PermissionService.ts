import { User } from '../models/User.js';
import connectDB from '../lib/mongodb.js';

type PermissionCategory = {
  [key: string]: boolean | number;
};

type FeaturePermissions = {
  discounts?: PermissionCategory;
  reports?: PermissionCategory;
  inventory?: PermissionCategory;
  userManagement?: PermissionCategory;
  dataAccess?: PermissionCategory;
  transactions?: PermissionCategory;
  bundles?: PermissionCategory;
  suppliers?: PermissionCategory;
  blends?: PermissionCategory;
  systemAdmin?: PermissionCategory;
  appointments?: PermissionCategory;
  patients?: PermissionCategory;
  security?: PermissionCategory;
};

type UserPermissionData = {
  _id: string;
  name?: string;
  email: string;
  role: string;
  featurePermissions?: FeaturePermissions;
  discountPermissions?: {
    canApplyDiscounts: boolean;
    maxDiscountPercent: number;
    maxDiscountAmount: number;
    unlimitedDiscounts: boolean;
  };
};

export class PermissionService {
  static async getUserPermissions(userId: string) {
    await connectDB();

    const user = await User.findById(userId)
      .select('name email role featurePermissions discountPermissions')
      .lean() as UserPermissionData | null;

    if (!user) {
      throw new Error('User not found');
    }

    // Get effective permissions based on role and custom permissions
    const roleDefaults = this.getDefaultPermissionsByRole(user.role);
    const effectivePermissions = { ...roleDefaults };
    
    // Deep merge user's custom permissions over role defaults
    if (user.featurePermissions) {
      Object.keys(user.featurePermissions).forEach(category => {
        if (effectivePermissions[category as keyof typeof effectivePermissions]) {
          const roleDefaults = effectivePermissions[category as keyof typeof effectivePermissions] as PermissionCategory;
          const userPerms = user.featurePermissions![category as keyof FeaturePermissions] as PermissionCategory;
          const merged: Record<string, unknown> = { ...roleDefaults };
          
          // For each permission in the category, user overrides take precedence
          Object.keys(userPerms).forEach(perm => {
            // User override takes precedence over role default
            // This allows turning OFF permissions or reducing limits below role defaults
            merged[perm] = userPerms[perm];
          });
          
          (effectivePermissions as Record<string, unknown>)[category] = merged;
        } else {
          (effectivePermissions as Record<string, unknown>)[category] = user.featurePermissions![category as keyof FeaturePermissions];
        }
      });
    }

    return {
      user: {
        ...user,
        effectivePermissions
      }
    };
  }

  static getDefaultPermissionsByRole(role: string) {
    const defaultPermissions: FeaturePermissions = {
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
        canViewUserReports: false,
        canViewSecurityMetrics: false,
        canExportReports: false
      },
      inventory: {
        canAddProducts: false,
        canEditProducts: false,
        canDeleteProducts: false,
        canManageStock: false,
        canCreateRestockOrders: false,
        canBulkOperations: false,
        canViewCostPrices: false,
        canEditCostPrices: false
      },
      userManagement: {
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canChangeRoles: false,
        canResetPasswords: false,
        canUpdatePasswords: false,
        canViewAuditLogs: false
      },
      dataAccess: {
        canViewPatients: false,
        canEditPatients: false,
        canDeletePatients: false,
        canBulkDeletePatients: false,
        canViewCustomers: false,
        canManageAppointments: false
      },
      transactions: {
        canCreateTransactions: false,
        canEditTransactions: false,
        canDeleteTransactions: false,
        canProcessRefunds: false,
        canGenerateInvoices: false
      },
      bundles: {
        canCreateBundles: false,
        canEditBundles: false,
        canDeleteBundles: false,
        canManageBundlePricing: false,
        canViewBundleStats: false
      },
      suppliers: {
        canAddSuppliers: false,
        canEditSuppliers: false,
        canDeleteSuppliers: false,
        canManageSuppliers: false
      },
      blends: {
        canCreateFixedBlends: false,
        canEditFixedBlends: false,
        canDeleteFixedBlends: false,
        canViewFixedBlends: false
      },
      systemAdmin: {
        canAccessSystemSettings: false,
        canManageDatabase: false,
        canViewSecurityLogs: false,
        canConfigureSystem: false
      },
      appointments: {
        canManageSchedules: false
      },
      patients: {
        canAccessAllPatients: false
      },
      security: {
        canViewSecurityLogs: false
      }
    };

    // Set permissions based on role
    switch (role) {
      case 'super_admin':
        // Super admin has all permissions
        Object.keys(defaultPermissions).forEach(category => {
          const categoryPerms = defaultPermissions[category as keyof typeof defaultPermissions];
          if (categoryPerms) {
            Object.keys(categoryPerms).forEach(permission => {
              const perms = categoryPerms as Record<string, boolean | number>;
              perms[permission] = permission.includes('max') ? 100 :
                                  permission.includes('Amount') ? 999999 : true;
            });
          }
        });
        break;

      case 'admin':
        // Admin has most permissions except system admin and some financial
        defaultPermissions.inventory = {
          canAddProducts: true,
          canEditProducts: true,
          canDeleteProducts: true,
          canManageStock: true,
          canCreateRestockOrders: true,
          canBulkOperations: true,
          canViewCostPrices: false,
          canEditCostPrices: false
        };
        defaultPermissions.userManagement = {
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: false,
          canChangeRoles: false,
          canResetPasswords: true,
          canUpdatePasswords: true,
          canViewAuditLogs: false
        };
        defaultPermissions.reports = {
          canViewFinancialReports: false,
          canViewInventoryReports: true,
          canViewUserReports: true,
          canViewSecurityMetrics: false,
          canExportReports: true
        };
        defaultPermissions.transactions = {
          canCreateTransactions: true,
          canEditTransactions: true,
          canDeleteTransactions: true,
          canProcessRefunds: true,
          canGenerateInvoices: true
        };
        defaultPermissions.dataAccess = {
          canViewPatients: true,
          canEditPatients: true,
          canDeletePatients: true,
          canBulkDeletePatients: false,
          canViewCustomers: true,
          canManageAppointments: true
        };
        defaultPermissions.discounts = {
          canApplyProductDiscounts: true,
          canApplyBillDiscounts: true,
          maxDiscountPercent: 20,
          maxDiscountAmount: 500,
          unlimitedDiscounts: false
        };
        defaultPermissions.bundles = {
          canCreateBundles: true,
          canEditBundles: true,
          canDeleteBundles: true,
          canManageBundlePricing: true,
          canViewBundleStats: true
        };
        defaultPermissions.suppliers = {
          canAddSuppliers: true,
          canEditSuppliers: true,
          canDeleteSuppliers: true,
          canManageSuppliers: true
        };
        defaultPermissions.blends = {
          canCreateFixedBlends: true,
          canEditFixedBlends: true,
          canDeleteFixedBlends: true,
          canViewFixedBlends: true
        };
        defaultPermissions.appointments = {
          canManageSchedules: true
        };
        defaultPermissions.patients = {
          canAccessAllPatients: true
        };
        break;

      case 'manager':
        defaultPermissions.inventory = {
          canAddProducts: true,
          canEditProducts: true,
          canDeleteProducts: false,
          canManageStock: true,
          canCreateRestockOrders: true,
          canBulkOperations: false,
          canViewCostPrices: false,
          canEditCostPrices: false
        };
        defaultPermissions.reports = {
          canViewFinancialReports: false,
          canViewInventoryReports: true,
          canViewUserReports: false,
          canViewSecurityMetrics: false,
          canExportReports: false
        };
        defaultPermissions.transactions = {
          canCreateTransactions: true,
          canEditTransactions: true,
          canDeleteTransactions: false,
          canProcessRefunds: false,
          canGenerateInvoices: true
        };
        defaultPermissions.dataAccess = {
          canViewPatients: true,
          canEditPatients: true,
          canDeletePatients: false,
          canBulkDeletePatients: false,
          canViewCustomers: true,
          canManageAppointments: true
        };
        defaultPermissions.discounts = {
          canApplyProductDiscounts: true,
          canApplyBillDiscounts: true,
          maxDiscountPercent: 10,
          maxDiscountAmount: 200,
          unlimitedDiscounts: false
        };
        defaultPermissions.appointments = {
          canManageSchedules: true
        };
        break;

      case 'staff':
        defaultPermissions.transactions = {
          canCreateTransactions: true,
          canEditTransactions: false,
          canDeleteTransactions: false,
          canProcessRefunds: false,
          canGenerateInvoices: true
        };
        defaultPermissions.dataAccess = {
          canViewPatients: true,
          canEditPatients: false,
          canDeletePatients: false,
          canBulkDeletePatients: false,
          canViewCustomers: true,
          canManageAppointments: false
        };
        defaultPermissions.inventory = {
          canAddProducts: true,
          canEditProducts: false,
          canDeleteProducts: false,
          canManageStock: false,
          canCreateRestockOrders: false,
          canBulkOperations: false,
          canViewCostPrices: false,
          canEditCostPrices: false
        };
        defaultPermissions.patients = {
          canAccessAllPatients: true
        };
        break;
    }

    return defaultPermissions;
  }
}