import { type ComponentType } from 'react'
import { type FeaturePermissions } from '@/lib/permissions/types'

export interface NavigationItem {
  id: string
  name: string
  href: string
  icon: ComponentType<{ className?: string }> | string
  description?: string
  action?: string
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  visibility?: {
    roles?: string[]
    permissions?: {
      category: keyof FeaturePermissions
      permission: string
    }[]
    custom?: (context: NavigationContext) => boolean
  }
  children?: NavigationItem[]
  metadata?: Record<string, unknown>
}

export interface NavigationContext {
  user: {
    role: string
    permissions?: unknown
  } | null
  pathname: string
  isMobile: boolean
}

export interface NavigationStrategy {
  name: string
  shouldShow(item: NavigationItem, context: NavigationContext): boolean
  filterItems(items: NavigationItem[], context: NavigationContext): NavigationItem[]
}

export interface NavigationConfig {
  items: NavigationItem[]
  strategies?: NavigationStrategy[]
  features?: {
    enableSubmenus?: boolean
    enableBadges?: boolean
    enableDescriptions?: boolean
    enableKeyboardShortcuts?: boolean
  }
}

export interface NavigationItemRegistration {
  item: NavigationItem
  position?: 'start' | 'end' | number
  parentId?: string
}

export type NavigationItemFactory = (context: NavigationContext) => NavigationItem | null