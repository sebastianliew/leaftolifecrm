"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { HiChevronRight, HiUser } from "react-icons/hi2"
import { useNavigation } from './NavigationProvider'
import { NavigationItem } from './types/navigation.types'
import { resolveIcon } from './config/icons.registry'
import { useAuth } from '@/hooks/useAuth'

export function NavigationRenderer() {
  const { navigationItems, userMenuItems, context } = useNavigation()
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null)
  const { pathname } = context

  const getUserDisplayName = () => {
    if (!context.user) return "User"
    const user = context.user as { displayName?: string; username?: string }
    return user?.displayName || user?.username || "User"
  }

  const isActive = (href: string) => {
    return pathname === href || (href !== "/" && pathname?.startsWith(href))
  }

  const handleSubmenuToggle = (name: string) => {
    setSubmenuOpen(submenuOpen === name ? null : name)
  }

  const handleItemClick = async (item: NavigationItem, e: React.MouseEvent) => {
    if (item.action === 'logout') {
      e.preventDefault()
      await logout()
    }
  }

  const renderIcon = (item: NavigationItem) => {
    const Icon = resolveIcon(item.icon)
    if (!Icon) return null
    return <Icon className="h-5 w-5 mb-1 flex-shrink-0" />
  }

  const renderDesktopNavItem = (item: NavigationItem) => {
    const active = isActive(item.href)
    const hasSubmenus = item.children && item.children.length > 0
    
    return (
      <div 
        key={item.id} 
        className="relative flex flex-col items-center flex-shrink-0"
      >
        <button
          onClick={() => hasSubmenus ? handleSubmenuToggle(item.name) : undefined}
          className={cn(
            "flex flex-col items-center justify-center transition-all duration-700 group relative min-h-[60px] flex-shrink-0 w-16 rounded-10px p-2",
            active ? "bg-medsy-green text-white shadow-counter" : "hover:bg-gray-100"
          )}>
          <Link
            href={item.href}
            onClick={(e) => hasSubmenus && e.preventDefault()}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-700 group relative",
              active ? "text-white" : "text-gray-700 hover:text-medsy-green",
            )}
          >
            {renderIcon(item)}
            <span className="text-11px font-medium text-center leading-tight">{item.name}</span>
          </Link>
          {hasSubmenus && (
            <HiChevronRight 
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 transition-transform duration-700",
                submenuOpen === item.name ? "rotate-90" : "",
                active ? "text-white" : "text-gray-500"
              )} 
            />
          )}
        </button>
      </div>
    )
  }

  const renderSubmenuItem = (subitem: NavigationItem) => {
    const active = isActive(subitem.href)
    const Icon = resolveIcon(subitem.icon)
    
    return (
      <div key={subitem.id} className="mb-2">
        <Link
          href={subitem.href}
          onClick={(e) => handleItemClick(subitem, e)}
          className={cn(
            "group flex items-center px-4 py-3 text-14px font-medium rounded-10px transition-all duration-350",
            active ? "text-medsy-green bg-medsy-medsy-green-light shadow-float" : "text-gray-700 hover:text-medsy-green hover:bg-gray-100",
          )}
        >
          {Icon && <Icon className="mr-3 h-5 w-5 flex-shrink-0" />}
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2">
              <span>{subitem.name}</span>
              {subitem.badge && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  subitem.badge.variant === 'secondary' && "bg-gray-100 text-gray-600",
                  subitem.badge.variant === 'destructive' && "bg-red-100 text-red-600",
                  subitem.badge.variant === 'outline' && "border border-gray-300",
                  (!subitem.badge.variant || subitem.badge.variant === 'default') && "bg-blue-100 text-blue-600"
                )}>
                  {subitem.badge.text}
                </span>
              )}
            </div>
            {subitem.description && (
              <span className="text-12px text-gray-500 mt-1">
                {subitem.description}
              </span>
            )}
          </div>
        </Link>
      </div>
    )
  }

  const renderMobileNavItem = (item: NavigationItem) => {
    const active = isActive(item.href)
    const hasSubmenus = item.children && item.children.length > 0
    const isSubmenuOpen = submenuOpen === item.name
    const Icon = resolveIcon(item.icon)
    
    return (
      <div key={item.id}>
        <div className="flex items-center">
          <Link
            href={item.href}
            onClick={() => setIsOpen(false)}
            className={cn(
              "group flex items-center flex-1 px-4 py-3 text-14px font-medium rounded-10px transition-all duration-350",
              active ? "text-medsy-green bg-medsy-medsy-green-light" : "text-gray-700 hover:text-medsy-green hover:bg-gray-100",
            )}
          >
            {Icon && <Icon className="mr-3 h-5 w-5 flex-shrink-0" />}
            {item.name}
          </Link>
          
          {hasSubmenus && (
            <button
              onClick={() => handleSubmenuToggle(item.name)}
              className="p-2 text-gray-500 hover:text-medsy-green transition-colors mr-1 rounded-full hover:bg-gray-100 flex items-center justify-center"
            >
              <HiChevronRight 
                className={cn(
                  "h-4 w-4 transition-transform duration-700",
                  isSubmenuOpen ? "rotate-90" : ""
                )} 
              />
            </button>
          )}
        </div>
        
        {hasSubmenus && isSubmenuOpen && (
          <div className="ml-6 mt-2 space-y-1">
            {item.children?.map((subitem) => {
              const subActive = isActive(subitem.href)
              const SubIcon = resolveIcon(subitem.icon)
              return (
                <Link
                  key={subitem.id}
                  href={subitem.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "group flex items-center px-4 py-2 text-13px font-medium rounded-10px transition-all duration-350",
                    subActive ? "text-medsy-green bg-medsy-medsy-green-light" : "text-gray-600 hover:text-medsy-green hover:bg-gray-100",
                  )}
                >
                  {SubIcon && <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" />}
                  {subitem.name}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex lg:flex-col lg:w-20 lg:fixed lg:inset-y-0 lg:bg-white lg:border-r lg:border-gray-300 lg:shadow-navigation lg:z-40">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 flex-shrink-0 px-4 border-b border-gray-200">
            <Image
              src="/logo.jpeg"
              alt="Logo"
              width={40}
              height={40}
              className="rounded-10px"
            />
          </div>

          {/* Main Navigation */}
          <div className="flex-1 flex flex-col items-center py-6 space-y-4 overflow-y-auto menu-scrollbar min-h-0">
            {navigationItems.map(renderDesktopNavItem)}
          </div>

          {/* User Menu */}
          <div className="flex flex-col items-center pb-4 space-y-3 flex-shrink-0 border-t border-gray-200 pt-4">
            <div className="relative flex flex-col items-center">
              <button
                onClick={() => handleSubmenuToggle('User Menu')}
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-16 rounded-10px transition-all duration-700 group relative",
                  submenuOpen === 'User Menu' ? "bg-medsy-green text-white shadow-counter" : "text-gray-500 hover:bg-gray-100 hover:text-medsy-green",
                )}
              >
                <HiUser className="h-5 w-5 mb-1 flex-shrink-0" />
                <span className="text-11px font-medium text-center leading-tight">{getUserDisplayName()}</span>
                <HiChevronRight 
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 transition-transform duration-700",
                    submenuOpen === 'User Menu' ? "rotate-90" : "",
                    submenuOpen === 'User Menu' ? "text-white" : "text-gray-500"
                  )} 
                />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Extension Sidebar for Submenus */}
      <div 
        className={cn(
          "hidden lg:block lg:fixed lg:inset-y-0 lg:left-20 lg:w-64 lg:bg-white lg:border-r lg:border-gray-200 lg:shadow-navigation lg:z-30 lg:transition-all lg:duration-700 lg:ease-in-out",
          submenuOpen ? "lg:translate-x-0 lg:opacity-100" : "lg:-translate-x-full lg:opacity-0 lg:pointer-events-none"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <span className="text-gray-900 font-semibold text-16px">{submenuOpen}</span>
            <button
              onClick={() => setSubmenuOpen(null)}
              className="text-gray-500 hover:text-medsy-green transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <HiChevronRight className="h-4 w-4 rotate-180" />
            </button>
          </div>
          
          {/* Submenu Items */}
          <div className="flex-1 py-4 px-3 overflow-y-auto">
            {submenuOpen === 'User Menu' ? (
              userMenuItems.map(renderSubmenuItem)
            ) : (
              navigationItems
                .find(item => item.name === submenuOpen)
                ?.children?.map(renderSubmenuItem)
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-white border-b border-gray-200 shadow-header px-4 py-3">
          <div className="flex items-center">
            <Image
              src="/logo.jpeg"
              alt="Logo"
              width={32}
              height={32}
              className="rounded-10px mr-3"
            />
            <span className="text-18px font-semibold text-gray-900">L2L Pharmacy</span>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-100 hover:text-medsy-green">
                <div className="menuIcon">
                  <div className="bar"></div>
                  <div className="bar"></div>
                  <div className="bar"></div>
                </div>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-white border-gray-200">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation menu for the application</SheetDescription>
              <div className="flex flex-col h-full">
                <div className="flex items-center mb-8">
                  <span className="text-18px font-semibold text-gray-900">Menu</span>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto min-h-0">
                  {navigationItems.map(renderMobileNavItem)}
                </nav>
                
                {/* User Menu - Fixed at bottom for mobile */}
                <div className="border-t border-gray-200 pt-4 mt-4 flex-shrink-0">
                  <div>
                    <div className="flex items-center">
                      <button
                        onClick={() => handleSubmenuToggle('User Menu')}
                        className={cn(
                          "group flex items-center flex-1 px-4 py-3 text-14px font-medium rounded-10px transition-all duration-350",
                          submenuOpen === 'User Menu' ? "text-medsy-green bg-medsy-medsy-green-light" : "text-gray-700 hover:text-medsy-green hover:bg-gray-100",
                        )}
                      >
                        <div className="w-5 h-5 bg-medsy-green rounded-full flex items-center justify-center mr-3">
                          <HiUser className="h-3 w-3 text-white" />
                        </div>
                        {getUserDisplayName()}
                      </button>
                      
                      <button
                        onClick={() => handleSubmenuToggle('User Menu')}
                        className="p-2 text-gray-500 hover:text-medsy-green transition-colors mr-1 rounded-full hover:bg-gray-100 flex items-center justify-center"
                      >
                        <HiChevronRight 
                          className={cn(
                            "h-4 w-4 transition-transform duration-700",
                            submenuOpen === 'User Menu' ? "rotate-90" : ""
                          )} 
                        />
                      </button>
                    </div>
                    
                    {submenuOpen === 'User Menu' && (
                      <div className="ml-6 mt-2 space-y-1">
                        {userMenuItems.map((userItem) => {
                          const userActive = isActive(userItem.href)
                          const UserIcon = resolveIcon(userItem.icon)
                          return (
                            <Link
                              key={userItem.id}
                              href={userItem.href}
                              onClick={(e) => {
                                handleItemClick(userItem, e)
                                setIsOpen(false)
                              }}
                              className={cn(
                                "group flex items-center px-4 py-2 text-13px font-medium rounded-10px transition-all duration-350",
                                userActive ? "text-medsy-green bg-medsy-medsy-green-light" : "text-gray-600 hover:text-medsy-green hover:bg-gray-100",
                              )}
                            >
                              {UserIcon && <UserIcon className="mr-3 h-4 w-4 flex-shrink-0" />}
                              {userItem.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Content offset for desktop */}
      <div className={cn(
        "transition-all duration-700",
        submenuOpen ? "lg:pl-84" : "lg:pl-20"
      )}>
      </div>
    </>
  )
}