import { NavigationStrategy, NavigationItem, NavigationContext } from '../types/navigation.types'

export class PermissionStrategy implements NavigationStrategy {
  name = 'permission-based'
  
  constructor(
    private hasPermission: (category: string, permission: string) => boolean
  ) {}

  shouldShow(item: NavigationItem, context: NavigationContext): boolean {
    if (!context.user) return false
    
    // Super admin bypasses permission checks
    if (context.user.role === 'super_admin') return true
    
    // For staff users, check if this is a main navigation item they're allowed to see
    // If so, bypass permission checks for the main item (but not children)
    if (context.user.role === 'staff') {
      const staffAllowedIds = ['dashboard', 'inventory', 'transactions', 'patients', 'schedules', 'history']
      if (staffAllowedIds.includes(item.id)) {
        // Staff can see main navigation items regardless of permission requirements
        return true
      }
    }
    
    // Check permission-based visibility
    if (item.visibility?.permissions) {
      return item.visibility.permissions.every(({ category, permission }) => 
        this.hasPermission(String(category), String(permission))
      )
    }
    
    // Check custom visibility function
    if (item.visibility?.custom) {
      return item.visibility.custom(context)
    }
    
    // Default to showing if no visibility rules
    return true
  }

  filterItems(items: NavigationItem[], context: NavigationContext): NavigationItem[] {
    return items.filter(item => {
      // Check if main item should be shown
      if (!this.shouldShow(item, context)) {
        return false
      }
      
      // Filter children recursively
      if (item.children) {
        const filteredChildren = this.filterItems(item.children, context)
        
        // Return item with filtered children
        return {
          ...item,
          children: filteredChildren
        }
      }
      
      return true
    }).map(item => {
      if (item.children) {
        return {
          ...item,
          children: this.filterItems(item.children, context)
        }
      }
      return item
    })
  }
}