// Permission types that can be used on both client and server

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface FeaturePermissions {
  discounts: {
    canApplyProductDiscounts: boolean;
    canApplyBillDiscounts: boolean;
    maxDiscountPercent: number;
    maxDiscountAmount: number;
    unlimitedDiscounts: boolean;
  };
  reports: {
    canViewFinancialReports: boolean;
    canViewInventoryReports: boolean;
    canViewUserReports: boolean;
    canViewSecurityMetrics: boolean;
    canExportReports: boolean;
  };
  inventory: {
    canViewInventory: boolean;  // View inventory list and details
    canAddProducts: boolean;
    canEditProducts: boolean;
    canDeleteProducts: boolean;
    canManageStock: boolean;
    canCreateRestockOrders: boolean;
    canBulkOperations: boolean;
    canEditCostPrices: boolean; // SUPER ADMIN ONLY
  };
  transactions: {
    canViewTransactions: boolean;  // View transactions list and details
    canCreateTransactions: boolean;
    canEditTransactions: boolean;
    canEditDrafts: boolean;  // Edit own draft transactions
    canDeleteTransactions: boolean;
    canApplyDiscounts: boolean;
    canRefundTransactions: boolean;
    canViewFinancialDetails: boolean;
  };
  patients: {
    canCreatePatients: boolean;
    canEditPatients: boolean;
    canDeletePatients: boolean;
    canViewMedicalHistory: boolean;
    canManagePrescriptions: boolean;
    canAccessAllPatients: boolean;
  };
  userManagement: {
    canViewUsers: boolean;  // View users list and details
    canCreateUsers: boolean;
    canEditUsers: boolean;
    canDeleteUsers: boolean;
    canAssignRoles: boolean;
    canChangeRoles: boolean;  // Alias for canAssignRoles
    canManagePermissions: boolean;
    canResetPasswords: boolean;
    canViewSecurityLogs: boolean;
    canViewAuditLogs: boolean;  // Alias for canViewSecurityLogs
  };
  prescriptions: {
    canCreatePrescriptions: boolean;
    canEditPrescriptions: boolean;
    canDeletePrescriptions: boolean;
    canViewAllPrescriptions: boolean;
    canPrintPrescriptions: boolean;
    canManageTemplates: boolean;
  };
  appointments: {
    canCreateAppointments: boolean;
    canEditAppointments: boolean;
    canDeleteAppointments: boolean;
    canViewAllAppointments: boolean;
    canManageSchedules: boolean;
    canOverrideBookings: boolean;
  };
  bundles: {
    canViewBundles: boolean;  // View bundles list and details
    canCreateBundles: boolean;
    canEditBundles: boolean;
    canDeleteBundles: boolean;
    canSetPricing: boolean;
  };
  blends: {
    canCreateFixedBlends: boolean;
    canEditFixedBlends: boolean;
    canDeleteFixedBlends: boolean;
    canViewFixedBlends: boolean;
    canCreateCustomBlends: boolean;
  };
  containers: {
    canManageContainerTypes: boolean;
    canCreateTypes: boolean;
    canEditTypes: boolean;
    canDeleteTypes: boolean;
  };
  brands: {
    canManageBrands: boolean;
    canCreateBrands: boolean;
    canEditBrands: boolean;
    canDeleteBrands: boolean;
  };
  dosageForms: {
    canManageDosageForms: boolean;
    canCreateForms: boolean;
    canEditForms: boolean;
    canDeleteForms: boolean;
  };
  categories: {
    canManageCategories: boolean;
    canCreateCategories: boolean;
    canEditCategories: boolean;
    canDeleteCategories: boolean;
  };
  units: {
    canManageUnits: boolean;
    canCreateUnits: boolean;
    canEditUnits: boolean;
    canDeleteUnits: boolean;
  };
  suppliers: {
    canManageSuppliers: boolean;
    canCreateSuppliers: boolean;
    canEditSuppliers: boolean;
    canDeleteSuppliers: boolean;
  };
  documents: {
    canUploadDocuments: boolean;
    canViewDocuments: boolean;
    canDeleteDocuments: boolean;
    canManageFolders: boolean;
  };
  security: {
    canViewSecurityLogs: boolean;
    canManageSecurity: boolean;
    canViewAuditTrails: boolean;
    canManageApiKeys: boolean;
  };
  settings: {
    canViewSettings: boolean;
    canEditSettings: boolean;
    canManageIntegrations: boolean;
    canConfigureSystem: boolean;
  };
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'staff' | 'user';

export const ROLE_PERMISSIONS: Record<UserRole, Partial<FeaturePermissions>> = {
  super_admin: {
    // Super admins have all permissions by default
  },
  admin: {
    discounts: {
      canApplyProductDiscounts: true,
      canApplyBillDiscounts: true,
      maxDiscountPercent: 50,
      maxDiscountAmount: 1000,
      unlimitedDiscounts: false,
    },
    reports: {
      canViewFinancialReports: true,
      canViewInventoryReports: true,
      canViewUserReports: true,
      canViewSecurityMetrics: true,
      canExportReports: true,
    },
    inventory: {
      canViewInventory: true,
      canAddProducts: true,
      canEditProducts: true,
      canDeleteProducts: true,
      canManageStock: true,
      canCreateRestockOrders: true,
      canBulkOperations: true,
      canEditCostPrices: false, // Only super admin
    },
    transactions: {
      canViewTransactions: true,
      canCreateTransactions: true,
      canEditTransactions: true,
      canEditDrafts: true,
      canDeleteTransactions: true,
      canApplyDiscounts: true,
      canRefundTransactions: true,
      canViewFinancialDetails: true,
    },
    patients: {
      canCreatePatients: true,
      canEditPatients: true,
      canDeletePatients: true,
      canViewMedicalHistory: true,
      canManagePrescriptions: true,
      canAccessAllPatients: true,
    },
    userManagement: {
      canViewUsers: true,
      canCreateUsers: true,
      canEditUsers: true,
      canDeleteUsers: false,
      canAssignRoles: true,
      canChangeRoles: true,
      canManagePermissions: false,
      canResetPasswords: true,
      canViewSecurityLogs: true,
      canViewAuditLogs: true,
    },
    bundles: {
      canViewBundles: true,
      canCreateBundles: true,
      canEditBundles: true,
      canDeleteBundles: false,
      canSetPricing: true,
    },
  },
  manager: {
    discounts: {
      canApplyProductDiscounts: true,
      canApplyBillDiscounts: true,
      maxDiscountPercent: 30,
      maxDiscountAmount: 500,
      unlimitedDiscounts: false,
    },
    reports: {
      canViewFinancialReports: true,
      canViewInventoryReports: true,
      canViewUserReports: false,
      canViewSecurityMetrics: false,
      canExportReports: true,
    },
    inventory: {
      canViewInventory: true,
      canAddProducts: true,
      canEditProducts: true,
      canDeleteProducts: false,
      canManageStock: true,
      canCreateRestockOrders: true,
      canBulkOperations: false,
      canEditCostPrices: false,
    },
    transactions: {
      canViewTransactions: true,
      canCreateTransactions: true,
      canEditTransactions: true,
      canEditDrafts: true,
      canDeleteTransactions: false,
      canApplyDiscounts: true,
      canRefundTransactions: true,
      canViewFinancialDetails: true,
    },
    patients: {
      canCreatePatients: true,
      canEditPatients: true,
      canDeletePatients: false,
      canViewMedicalHistory: true,
      canManagePrescriptions: true,
      canAccessAllPatients: true,
    },
    userManagement: {
      canViewUsers: true,
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
    bundles: {
      canViewBundles: true,
      canCreateBundles: false,
      canEditBundles: false,
      canDeleteBundles: false,
      canSetPricing: false,
    },
  },
  staff: {
    discounts: {
      canApplyProductDiscounts: true,
      canApplyBillDiscounts: false,
      maxDiscountPercent: 15,
      maxDiscountAmount: 200,
      unlimitedDiscounts: false,
    },
    reports: {
      canViewFinancialReports: false,
      canViewInventoryReports: true,
      canViewUserReports: false,
      canViewSecurityMetrics: false,
      canExportReports: false,
    },
    inventory: {
      canViewInventory: true,
      canAddProducts: false,
      canEditProducts: false,
      canDeleteProducts: false,
      canManageStock: true,
      canCreateRestockOrders: false,
      canBulkOperations: false,
      canEditCostPrices: false,
    },
    transactions: {
      canViewTransactions: true,
      canCreateTransactions: true,
      canEditTransactions: false,
      canEditDrafts: true,
      canDeleteTransactions: false,
      canApplyDiscounts: true,
      canRefundTransactions: false,
      canViewFinancialDetails: false,
    },
    patients: {
      canCreatePatients: true,
      canEditPatients: true,
      canDeletePatients: false,
      canViewMedicalHistory: true,
      canManagePrescriptions: false,
      canAccessAllPatients: false,
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
    bundles: {
      canViewBundles: true,
      canCreateBundles: false,
      canEditBundles: false,
      canDeleteBundles: false,
      canSetPricing: false,
    },
  },
  user: {
    // Basic users have minimal permissions
    reports: {
      canViewFinancialReports: false,
      canViewInventoryReports: false,
      canViewUserReports: false,
      canViewSecurityMetrics: false,
      canExportReports: false,
    },
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
    transactions: {
      canViewTransactions: false,
      canCreateTransactions: false,
      canEditTransactions: false,
      canEditDrafts: false,
      canDeleteTransactions: false,
      canApplyDiscounts: false,
      canRefundTransactions: false,
      canViewFinancialDetails: false,
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
    bundles: {
      canViewBundles: false,
      canCreateBundles: false,
      canEditBundles: false,
      canDeleteBundles: false,
      canSetPricing: false,
    },
  },
};