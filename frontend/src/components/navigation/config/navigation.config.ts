import { NavigationItem, NavigationConfig } from '../types/navigation.types'

export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'home',
  },
  {
    id: 'inventory',
    name: 'Inventory',
    href: '/inventory',
    icon: 'inventory',
    visibility: {
      permissions: [{ category: 'inventory', permission: 'canAddProducts' }]
    },
    children: [
      {
        id: 'products',
        name: 'Products',
        href: '/inventory',
        icon: 'products',
        description: 'Manage your product inventory'
      },
      {
        id: 'categories',
        name: 'Categories',
        href: '/inventory/category',
        icon: 'categories',
        description: 'Manage and organize your inventory categories'
      },
      {
        id: 'container-types',
        name: 'Container Types',
        href: '/containers/types',
        icon: 'container-types',
        description: 'Manage different types of containers'
      },
      {
        id: 'units',
        name: 'Units',
        href: '/inventory/units',
        icon: 'units',
        description: 'Manage units of measurement'
      },
      {
        id: 'suppliers',
        name: 'Suppliers',
        href: '/suppliers',
        icon: 'suppliers',
        description: 'Manage your suppliers and vendor information'
      },
      {
        id: 'brands',
        name: 'Brands',
        href: '/brands',
        icon: 'brands',
        description: 'Manage product brands and manufacturers'
      },
      {
        id: 'blend-templates',
        name: 'Blend Templates',
        href: '/blend-templates',
        icon: 'blend-templates',
        description: 'Create and manage custom blend templates'
      },
      {
        id: 'bundles',
        name: 'Bundles',
        href: '/bundles',
        icon: 'bundles',
        description: 'Create and manage product bundles with discounted pricing',
        visibility: {
          permissions: [{ category: 'bundles', permission: 'canCreateBundles' }]
        }
      },
      {
        id: 'restock',
        name: 'Restock',
        href: '/inventory/restock',
        icon: 'restock',
        description: 'Restock inventory items and manage stock levels',
        visibility: {
          permissions: [{ category: 'inventory', permission: 'canCreateRestockOrders' }]
        }
      }
    ]
  },
  {
    id: 'transactions',
    name: 'Transactions',
    href: '/transactions',
    icon: 'transactions',
    children: [
      {
        id: 'transaction-list',
        name: 'All Transactions',
        href: '/transactions',
        icon: 'transactions',
        description: 'View and manage all transactions'
      },
      {
        id: 'refunds',
        name: 'Refunds',
        href: '/refunds',
        icon: 'refund',
        description: 'Manage refunds and returns',
        visibility: {
          permissions: [{ category: 'transactions', permission: 'canProcessRefunds' }]
        }
      }
    ]
  },
  {
    id: 'history',
    name: 'History',
    href: '/history',
    icon: 'history',
  },
  {
    id: 'patients',
    name: 'Patients',
    href: '/patients',
    icon: 'patients',
  },
  {
    id: 'schedules',
    name: 'Schedules',
    href: '/dashboard/appointments',
    icon: 'schedules',
    visibility: {
      permissions: [{ category: 'appointments', permission: 'canManageSchedules' }]
    },
    children: [
      {
        id: 'manage-schedules',
        name: 'Manage Schedules',
        href: '/dashboard/appointments',
        icon: 'schedules',
        description: 'View and manage all schedules'
      },
      {
        id: 'book-schedule',
        name: 'Book Schedule',
        href: '/appointments',
        icon: 'schedules',
        description: 'Create a new schedule'
      }
    ]
  },
  {
    id: 'reports',
    name: 'Reports',
    href: '/reports',
    icon: 'reports',
    visibility: {
      permissions: [{ category: 'reports', permission: 'canViewInventoryReports' }]
    },
    children: [
      {
        id: 'item-sales',
        name: 'Item Sales Report',
        href: '/reports/item-sales',
        icon: 'item-sales',
        description: 'View detailed sales reports for individual items',
        visibility: {
          permissions: [{ category: 'reports', permission: 'canViewFinancialReports' }]
        }
      },
      {
        id: 'sales-trends',
        name: 'Sales Trends',
        href: '/reports/sales-trends',
        icon: 'sales-trends',
        description: 'Track sales performance over time and identify patterns',
        visibility: {
          permissions: [{ category: 'reports', permission: 'canViewFinancialReports' }]
        }
      },
      {
        id: 'revenue-analysis',
        name: 'Revenue Analysis',
        href: '/reports/revenue',
        icon: 'revenue',
        description: 'Comprehensive revenue breakdown by category and time period',
        visibility: {
          permissions: [{ category: 'reports', permission: 'canViewFinancialReports' }]
        }
      },
      {
        id: 'inventory-report',
        name: 'Inventory Report',
        href: '/reports/inventory',
        icon: 'inventory-report',
        description: 'Monitor stock levels, turnover rates, and inventory value',
        visibility: {
          permissions: [{ category: 'reports', permission: 'canViewInventoryReports' }]
        }
      },
      {
        id: 'inventory-cost-report',
        name: 'Inventory Cost Report',
        href: '/reports/inventory-cost',
        icon: 'inventory-cost',
        description: 'Detailed analysis of inventory costs and stock valuation',
        visibility: {
          permissions: [{ category: 'reports', permission: 'canViewInventoryReports' }]
        }
      },
      {
        id: 'customer-value',
        name: 'Customer Value Report',
        href: '/reports/customer-value',
        icon: 'customer-value',
        description: 'View top customers by purchase value and analyze profit margins',
        visibility: {
          permissions: [{ category: 'reports', permission: 'canViewFinancialReports' }]
        }
      }
    ]
  }
]

export const userMenuItems: NavigationItem[] = [
  {
    id: 'profile',
    name: 'Profile',
    href: '/profile',
    icon: 'profile',
    // No visibility restrictions - available to all users
  },
  {
    id: 'consultation-settings',
    name: 'Consultation Settings',
    href: '/settings/consultation',
    icon: 'consultation-settings',
    visibility: {
      roles: ['admin', 'super_admin']
    }
  },
  {
    id: 'user-management',
    name: 'User Management',
    href: '/users',
    icon: 'user-management',
    visibility: {
      roles: ['admin', 'super_admin']
    }
  },
  {
    id: 'menu-management',
    name: 'Menu Management',
    href: '/settings/menu-management',
    icon: 'menu-management',
    description: 'Configure navigation menus',
    visibility: {
      roles: ['admin', 'super_admin']
    }
  },
  {
    id: 'sign-out',
    name: 'Sign Out',
    href: '#',
    icon: 'sign-out',
    action: 'logout',
    // No visibility restrictions - available to all users
  }
]

// Staff-specific menu items
const staffAllowedMenuIds = ['dashboard', 'inventory', 'transactions', 'patients', 'schedules', 'history']

export const navigationConfig: NavigationConfig = {
  items: navigationItems,
  features: {
    enableSubmenus: true,
    enableBadges: true,
    enableDescriptions: true,
    enableKeyboardShortcuts: true,
  }
}

// Helper function to get navigation items for a specific role
export function getNavigationForRole(role: string): string[] {
  if (role === 'staff') {
    return staffAllowedMenuIds
  }
  // Admin and super_admin see everything
  return navigationItems.map(item => item.id)
}

// Plugin system for adding navigation items dynamically
class NavigationPlugin {
  private static additionalItems: NavigationItem[] = []

  static register(item: NavigationItem, position?: 'start' | 'end' | number): void {
    if (position === 'start') {
      this.additionalItems.unshift(item)
    } else if (typeof position === 'number') {
      this.additionalItems.splice(position, 0, item)
    } else {
      this.additionalItems.push(item)
    }
  }

  static getItems(): NavigationItem[] {
    return this.additionalItems
  }

  static clear(): void {
    this.additionalItems = []
  }
}

export { NavigationPlugin }