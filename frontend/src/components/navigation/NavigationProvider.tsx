"use client"

import React, { createContext, useContext, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions, FeaturePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  NavigationItem,
  NavigationContext,
  NavigationStrategy,
  NavigationConfig,
} from './types/navigation.types'
import { navigationConfig, NavigationPlugin, userMenuItems } from './config/navigation.config'
import { RoleStrategy } from './strategies/RoleStrategy'
import { PermissionStrategy } from './strategies/PermissionStrategy'
import { CompositeStrategy } from './strategies/CompositeStrategy'

interface NavigationProviderContextValue {
  navigationItems: NavigationItem[]
  userMenuItems: NavigationItem[]
  getFilteredItems: (items?: NavigationItem[]) => NavigationItem[]
  registerItem: (item: NavigationItem, position?: 'start' | 'end' | number) => void
  context: NavigationContext
}

const NavigationProviderContext = createContext<NavigationProviderContextValue | null>(null)

export function useNavigation() {
  const context = useContext(NavigationProviderContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

interface NavigationProviderProps {
  children: React.ReactNode
  config?: Partial<NavigationConfig>
  additionalStrategies?: NavigationStrategy[]
}

export function NavigationProvider({ 
  children, 
  config = {}, 
  additionalStrategies = [] 
}: NavigationProviderProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()

  // Merge default config with provided config
  const finalConfig: NavigationConfig = {
    ...navigationConfig,
    ...config,
    items: [...navigationConfig.items, ...NavigationPlugin.getItems()],
    features: {
      ...navigationConfig.features,
      ...config.features,
    }
  }

  // Create navigation context
  const navigationContext: NavigationContext = useMemo(() => {
    return {
      user: user ? { role: user.role } : null,
      pathname: pathname || '/',
      isMobile,
    };
  }, [user, pathname, isMobile])

  // Create composite strategy with all strategies
  const strategy = useMemo(() => {
    const strategies: NavigationStrategy[] = [
      new RoleStrategy(),
      new PermissionStrategy((category: string, permission: string) => 
        hasPermission(category as keyof FeaturePermissions, permission)
      ),
      ...additionalStrategies,
    ]
    return new CompositeStrategy(strategies)
  }, [hasPermission, additionalStrategies])

  // Get filtered navigation items
  const getFilteredItems = useCallback((items: NavigationItem[] = finalConfig.items) => {
    return strategy.filterItems(items, navigationContext)
  }, [strategy, navigationContext, finalConfig.items])

  // Get filtered user menu items
  const filteredUserMenuItems = useMemo(() => {
    return getFilteredItems(userMenuItems)
  }, [getFilteredItems])

  // Register new navigation item
  const registerItem = useCallback((item: NavigationItem, position?: 'start' | 'end' | number) => {
    NavigationPlugin.register(item, position)
  }, [])

  const value: NavigationProviderContextValue = {
    navigationItems: getFilteredItems(),
    userMenuItems: filteredUserMenuItems,
    getFilteredItems,
    registerItem,
    context: navigationContext,
  }

  return (
    <NavigationProviderContext.Provider value={value}>
      {children}
    </NavigationProviderContext.Provider>
  )
}