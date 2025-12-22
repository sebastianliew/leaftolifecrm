import { NavigationStrategy, NavigationItem, NavigationContext } from '../types/navigation.types'
import { getNavigationForRole } from '../config/navigation.config'

export class RoleStrategy implements NavigationStrategy {
  name = 'role-based'

  shouldShow(item: NavigationItem, context: NavigationContext): boolean {
    if (!context.user) return false
    
    const { role } = context.user
    
    // Super admin sees everything
    if (role === 'super_admin') return true
    
    // Check role-based visibility if specified
    if (item.visibility?.roles) {
      return item.visibility.roles.includes(role)
    }
    
    // Check if staff user and item is in allowed list (for main navigation items)
    if (role === 'staff') {
      const allowedIds = getNavigationForRole('staff')
      // If it's a main navigation item, check the allowed list
      if (allowedIds.includes(item.id)) {
        return true
      }
      // For items without explicit role restrictions, allow them (like user menu items)
      if (!item.visibility?.roles) {
        return true
      }
      return false
    }
    
    // Admin sees everything except items with explicit role restrictions
    if (role === 'admin') {
      // If there are no role restrictions or admin is in the allowed roles
      if (!item.visibility?.roles || item.visibility.roles.includes('admin')) {
        return true
      }
      return false
    }
    
    // Default to not showing
    return false
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
        
        // Only include item if it has visible children or is a leaf node
        if (filteredChildren.length === 0 && item.children.length > 0) {
          return false
        }
        
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