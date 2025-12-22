import { NavigationItem } from './navigation.types'

export interface MenuItemFormData {
  id: string
  name: string
  href: string
  icon: string
  description?: string
  parentId?: string | null
  order: number
  visibility: {
    enabled: boolean
    roles: string[]
    permissions: Array<{
      category: string
      permission: string
    }>
  }
  badge?: {
    enabled: boolean
    text: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
}

export interface MenuConfiguration {
  id: string
  name: string
  description?: string
  items: NavigationItem[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
  isActive: boolean
}

export interface MenuManagementState {
  configurations: MenuConfiguration[]
  activeConfigId: string | null
  isDirty: boolean
}

export type MenuItemAction = 
  | { type: 'ADD_ITEM'; payload: MenuItemFormData }
  | { type: 'UPDATE_ITEM'; payload: { id: string; data: Partial<MenuItemFormData> } }
  | { type: 'DELETE_ITEM'; payload: { id: string } }
  | { type: 'REORDER_ITEMS'; payload: { items: NavigationItem[] } }
  | { type: 'MOVE_ITEM'; payload: { itemId: string; newParentId: string | null; newIndex: number } }