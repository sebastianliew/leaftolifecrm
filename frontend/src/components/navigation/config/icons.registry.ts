import { ComponentType } from 'react'
import {
  HiArchiveBox,
  HiUsers,
  HiChartBar,
  HiCurrencyDollar,
  HiHome,
  HiReceiptRefund,
  HiChevronRight,
  HiFolderOpen,
  HiSquare2Stack,
  HiCube,
  HiBuildingOffice,
  HiTag,
  HiCalendar,
  HiClock,
  HiUser,
  HiArrowRightOnRectangle,
  HiUserCircle,
  HiCog6Tooth,
  HiArrowUp,
  HiArrowTrendingUp,
  HiUserPlus,
  HiClipboardDocumentList,
  HiCalculator,
} from "react-icons/hi2"

type IconMap = Record<string, ComponentType<{ className?: string }>>

const iconMap: IconMap = {
  // Main navigation icons
  'home': HiHome,
  'inventory': HiArchiveBox,
  'transactions': HiReceiptRefund,
  'history': HiClock,
  'patients': HiUsers,
  'schedules': HiCalendar,
  'reports': HiChartBar,
  'logs': HiClipboardDocumentList,
  
  // Inventory submenu icons
  'products': HiCube,
  'categories': HiFolderOpen,
  'units': HiSquare2Stack,
  'suppliers': HiBuildingOffice,
  'brands': HiTag,
  'blend-templates': HiSquare2Stack,
  'bundles': HiCube,
  'restock': HiArrowUp,
  
  // Patient submenu icons
  'patient-list': HiUsers,
  'new-patient': HiUserPlus,
  
  // Report submenu icons
  'item-sales': HiChartBar,
  'sales-trends': HiArrowTrendingUp,
  'revenue': HiCurrencyDollar,
  'inventory-report': HiCube,
  'inventory-cost': HiCalculator,
  'customer-value': HiUsers,
  
  // User menu icons
  'profile': HiUserCircle,
  'settings': HiCog6Tooth,
  'consultation-settings': HiCurrencyDollar,
  'user-management': HiUsers,
  'menu-management': HiCog6Tooth,
  'sign-out': HiArrowRightOnRectangle,
  
  // Utility icons
  'chevron-right': HiChevronRight,
  'user': HiUser,
}

export class IconRegistry {
  private static icons: IconMap = { ...iconMap }

  static register(name: string, icon: ComponentType<{ className?: string }>): void {
    this.icons[name] = icon
  }

  static registerMultiple(icons: IconMap): void {
    Object.assign(this.icons, icons)
  }

  static get(name: string): ComponentType<{ className?: string }> | null {
    return this.icons[name] || null
  }

  static getOrDefault(name: string, defaultIcon: ComponentType<{ className?: string }>): ComponentType<{ className?: string }> {
    return this.icons[name] || defaultIcon
  }

  static has(name: string): boolean {
    return name in this.icons
  }

  static list(): string[] {
    return Object.keys(this.icons)
  }
}

// Helper function to resolve icon from string or component
export function resolveIcon(icon: string | ComponentType<{ className?: string }>): ComponentType<{ className?: string }> | null {
  if (typeof icon === 'string') {
    return IconRegistry.get(icon)
  }
  return icon
}