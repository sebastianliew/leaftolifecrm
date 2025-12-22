# Navigation System Documentation

## Overview

This is a flexible, OCP and DRY compliant navigation system that consolidates multiple navigation components into a unified architecture.

## Architecture

```
navigation/
├── NavigationProvider.tsx       # Context provider for navigation state
├── NavigationRenderer.tsx       # Single rendering component
├── config/
│   ├── navigation.config.ts    # Navigation structure configuration
│   ├── icons.registry.ts       # Icon registry for dynamic icon management
├── strategies/
│   ├── RoleStrategy.ts         # Role-based filtering
│   ├── PermissionStrategy.ts   # Permission-based filtering
│   └── CompositeStrategy.ts    # Combines multiple strategies
├── types/
│   └── navigation.types.ts     # TypeScript interfaces
└── hooks/
    └── useNavigationItem.ts    # Hook for dynamic navigation management
```

## Key Features

1. **Configuration-Driven** - Navigation items defined in config files
2. **Dynamic Icon Loading** - Icons registered and resolved by name
3. **Strategy Pattern** - Flexible filtering based on roles/permissions
4. **Plugin System** - Add navigation items dynamically at runtime
5. **Single Renderer** - One component handles all rendering logic
6. **Type-Safe** - Full TypeScript support

## Usage

### Basic Usage

```tsx
import { RoleAwareNavigation } from '@/components/layout/RoleAwareNavigation'

export function Layout({ children }) {
  return (
    <>
      <RoleAwareNavigation />
      <main>{children}</main>
    </>
  )
}
```

### Adding Navigation Items

#### Static Configuration

Edit `config/navigation.config.ts`:

```typescript
export const navigationItems: NavigationItem[] = [
  {
    id: 'new-feature',
    name: 'New Feature',
    href: '/new-feature',
    icon: 'star', // Icon name from registry
    visibility: {
      roles: ['admin'],
      permissions: [
        { category: 'features', permission: 'canAccessNewFeature' }
      ]
    }
  }
]
```

#### Dynamic Addition

```tsx
import { useNavigationItem } from '@/components/navigation/hooks/useNavigationItem'

export function MyComponent() {
  const { addNavigationItem } = useNavigationItem()

  useEffect(() => {
    addNavigationItem({
      id: 'dynamic-item',
      name: 'Dynamic Item',
      href: '/dynamic',
      icon: 'star',
    }, 'end') // Position: 'start', 'end', or index
  }, [])
}
```

### Custom Icons

Register custom icons in the IconRegistry:

```typescript
import { IconRegistry } from '@/components/navigation/config/icons.registry'
import { MyCustomIcon } from '@/icons/MyCustomIcon'

// Register single icon
IconRegistry.register('my-icon', MyCustomIcon)

// Register multiple icons
IconRegistry.registerMultiple({
  'icon1': Icon1Component,
  'icon2': Icon2Component
})
```

### Custom Visibility Rules

Add custom visibility logic:

```typescript
{
  id: 'conditional-item',
  name: 'Conditional Item',
  href: '/conditional',
  icon: 'check',
  visibility: {
    custom: (context) => {
      // Custom logic here
      return context.user?.role === 'admin' && someCondition
    }
  }
}
```

### Custom Strategies

Create custom filtering strategies:

```typescript
class FeatureFlagStrategy implements NavigationStrategy {
  name = 'feature-flags'
  
  shouldShow(item: NavigationItem, context: NavigationContext): boolean {
    if (item.metadata?.featureFlag) {
      return isFeatureEnabled(item.metadata.featureFlag)
    }
    return true
  }
  
  filterItems(items: NavigationItem[], context: NavigationContext): NavigationItem[] {
    return items.filter(item => this.shouldShow(item, context))
  }
}

// Use in NavigationProvider
<NavigationProvider additionalStrategies={[new FeatureFlagStrategy()]}>
  <NavigationRenderer />
</NavigationProvider>
```

## Benefits

1. **Open for Extension** - Add new items without modifying core components
2. **Closed for Modification** - Core logic remains untouched
3. **DRY Principle** - Single source of truth for navigation
4. **Maintainable** - Clear separation of concerns
5. **Testable** - Strategies can be tested independently
6. **Type-Safe** - Full TypeScript support throughout

## Migration Guide

To migrate from the old system:

1. Replace `RoleAwareNavigation` imports with the new version
2. Remove `PermissionAwareNavigation` component (no longer needed)
3. Move any custom navigation logic to strategies
4. Update icon imports to use the registry