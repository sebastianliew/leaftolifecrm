"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useNavigation } from './NavigationProvider'
import { NavigationItem } from './types/navigation.types'
import { resolveIcon } from './config/icons.registry'
import { useAuth } from '@/hooks/useAuth'
import { BRANDING } from '@/config/branding'

const ACCENT = "#209F85"
const INK = "#0A0A0A"
const MUTED = "#6B7280"
const HAIRLINE = "#E5E7EB"
const HOVER_BG = "#FAFAFA"

function NavStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
      .nav-shell { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; }
      @keyframes navAccentRise {
        from { transform: scaleY(0); }
        to   { transform: scaleY(1); }
      }
      .nav-accent {
        transform-origin: center;
        animation: navAccentRise 280ms cubic-bezier(0.2, 0.7, 0.1, 1);
      }
      @keyframes navPanelSlide {
        from { opacity: 0; transform: translateX(-12px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .nav-panel-rise > * {
        animation: navPanelSlide 360ms cubic-bezier(0.2, 0.7, 0.1, 1) both;
      }
      .nav-panel-rise > *:nth-child(1) { animation-delay: 30ms; }
      .nav-panel-rise > *:nth-child(2) { animation-delay: 70ms; }
      .nav-panel-rise > *:nth-child(3) { animation-delay: 110ms; }
      .nav-panel-rise > *:nth-child(4) { animation-delay: 150ms; }
      .nav-panel-rise > *:nth-child(5) { animation-delay: 190ms; }
      .nav-panel-rise > *:nth-child(6) { animation-delay: 230ms; }
      .nav-panel-rise > *:nth-child(7) { animation-delay: 270ms; }
      .nav-panel-rise > *:nth-child(8) { animation-delay: 310ms; }
    `}</style>
  )
}

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

  const getUserInitials = () => {
    const name = getUserDisplayName()
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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

  // ── Rail item — vertical icon + small-caps label, active = left accent bar ──
  const renderDesktopNavItem = (item: NavigationItem) => {
    const active = isActive(item.href)
    const hasSubmenus = item.children && item.children.length > 0
    const Icon = resolveIcon(item.icon)
    const isExpanded = submenuOpen === item.name

    return (
      <div key={item.id} className="relative w-full flex justify-center">
        {(active || isExpanded) && (
          <span
            className="nav-accent absolute left-0 top-1.5 bottom-1.5 w-[2px]"
            style={{ background: ACCENT }}
            aria-hidden
          />
        )}
        <Link
          href={item.href}
          onClick={(e) => {
            if (hasSubmenus) {
              e.preventDefault()
              handleSubmenuToggle(item.name)
            }
          }}
          className={cn(
            "group relative flex flex-col items-center justify-center w-16 py-3 transition-colors",
            "text-[10px] tracking-[0.18em] uppercase font-medium"
          )}
          style={{
            color: active || isExpanded ? INK : MUTED,
            background: 'transparent',
          }}
        >
          {Icon && (
            <span
              className="mb-1.5 inline-flex transition-colors"
              style={{ color: active || isExpanded ? ACCENT : 'currentColor' }}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <span className="leading-tight text-center max-w-[60px] truncate">
            {item.name}
          </span>
        </Link>
      </div>
    )
  }

  // ── Submenu item — full-width hairline-ruled rows, active = left accent bar ──
  const renderSubmenuItem = (subitem: NavigationItem) => {
    const active = isActive(subitem.href)
    const Icon = resolveIcon(subitem.icon)

    return (
      <Link
        key={subitem.id}
        href={subitem.href}
        onClick={(e) => handleItemClick(subitem, e)}
        className="group relative block border-b transition-colors"
        style={{ borderColor: HAIRLINE }}
      >
        {active && (
          <span
            className="absolute left-0 top-2 bottom-2 w-[2px]"
            style={{ background: ACCENT }}
            aria-hidden
          />
        )}
        <div
          className="flex items-start gap-3 px-6 py-3.5 transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = HOVER_BG }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          {Icon && (
            <span
              className="mt-0.5 flex-shrink-0 inline-flex transition-colors"
              style={{ color: active ? ACCENT : MUTED }}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[13px] font-medium tracking-tight transition-colors"
                style={{ color: active ? INK : '#374151' }}
              >
                {subitem.name}
              </span>
              {subitem.badge && (
                <span
                  className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5"
                  style={{
                    background:
                      subitem.badge.variant === 'destructive' ? '#FEE2E2' :
                      subitem.badge.variant === 'secondary' ? '#F3F4F6' :
                      subitem.badge.variant === 'outline' ? 'transparent' :
                      '#ECFDF5',
                    color:
                      subitem.badge.variant === 'destructive' ? '#DC2626' :
                      subitem.badge.variant === 'secondary' ? MUTED :
                      subitem.badge.variant === 'outline' ? MUTED :
                      ACCENT,
                    border: subitem.badge.variant === 'outline' ? `1px solid ${HAIRLINE}` : 'none',
                  }}
                >
                  {subitem.badge.text}
                </span>
              )}
              <span
                className="text-base leading-none opacity-0 group-hover:opacity-60 transition-opacity"
                style={{ color: active ? ACCENT : MUTED }}
                aria-hidden
              >
                →
              </span>
            </div>
            {subitem.description && (
              <p
                className="text-[11px] italic font-light mt-1 leading-snug"
                style={{ color: MUTED }}
              >
                {subitem.description}
              </p>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // ── Mobile (Sheet) item ──
  const renderMobileNavItem = (item: NavigationItem) => {
    const active = isActive(item.href)
    const hasSubmenus = item.children && item.children.length > 0
    const isSubmenuOpen = submenuOpen === item.name
    const Icon = resolveIcon(item.icon)

    return (
      <div key={item.id} className="border-b" style={{ borderColor: HAIRLINE }}>
        <div className="flex items-center">
          <Link
            href={item.href}
            onClick={() => setIsOpen(false)}
            className="group relative flex items-center flex-1 px-2 py-3.5"
          >
            {active && (
              <span
                className="absolute left-0 top-2 bottom-2 w-[2px]"
                style={{ background: ACCENT }}
                aria-hidden
              />
            )}
            {Icon && (
              <span
                className="mr-3 flex-shrink-0 inline-flex"
                style={{ color: active ? ACCENT : MUTED }}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <span
              className="text-[13px] font-medium tracking-tight"
              style={{ color: active ? INK : '#374151' }}
            >
              {item.name}
            </span>
          </Link>

          {hasSubmenus && (
            <button
              onClick={() => handleSubmenuToggle(item.name)}
              className="px-3 py-3 transition-colors"
              style={{ color: MUTED }}
              aria-label={`Toggle ${item.name} submenu`}
            >
              <span
                className="inline-block transition-transform text-base leading-none"
                style={{
                  transform: isSubmenuOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  color: isSubmenuOpen ? ACCENT : MUTED,
                }}
              >
                ›
              </span>
            </button>
          )}
        </div>

        {hasSubmenus && isSubmenuOpen && (
          <div className="pl-9 pb-2">
            {item.children?.map((subitem) => {
              const subActive = isActive(subitem.href)
              const SubIcon = resolveIcon(subitem.icon)
              return (
                <Link
                  key={subitem.id}
                  href={subitem.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center px-2 py-2.5 group"
                >
                  {SubIcon && (
                    <span
                      className="mr-3 flex-shrink-0 inline-flex"
                      style={{ color: subActive ? ACCENT : MUTED }}
                    >
                      <SubIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span
                    className="text-[12px] tracking-tight"
                    style={{ color: subActive ? INK : MUTED }}
                  >
                    {subitem.name}
                  </span>
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
      <NavStyles />

      {/* ── Desktop rail ── */}
      <nav
        className="nav-shell hidden lg:flex lg:flex-col lg:w-20 lg:fixed lg:inset-y-0 lg:bg-white lg:z-40"
        style={{ borderRight: `1px solid ${HAIRLINE}` }}
      >
        <div className="flex flex-col h-full">
          {/* Logo block — editorial brand mark */}
          <Link
            href="/dashboard"
            className="flex flex-col items-center justify-center h-20 flex-shrink-0 px-3 transition-colors hover:bg-[#FAFAFA]"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <Image
              src={BRANDING.logoPath}
              alt="L2L"
              width={32}
              height={32}
              className="mb-1"
            />
            <span
              className="text-[8px] uppercase tracking-[0.32em] font-medium"
              style={{ color: MUTED }}
            >
              L2L
            </span>
          </Link>

          {/* Section kicker */}
          <div
            className="px-3 pt-5 pb-2 text-center text-[8px] uppercase tracking-[0.32em] font-medium"
            style={{ color: '#9CA3AF' }}
          >
            Menu
          </div>

          {/* Main nav */}
          <div
            className="flex-1 flex flex-col items-stretch py-1 overflow-y-auto menu-scrollbar min-h-0"
          >
            {navigationItems.map(renderDesktopNavItem)}
          </div>

          {/* User block */}
          <div
            className="flex-shrink-0"
            style={{ borderTop: `1px solid ${HAIRLINE}` }}
          >
            <div
              className="px-3 pt-4 pb-2 text-center text-[8px] uppercase tracking-[0.32em] font-medium"
              style={{ color: '#9CA3AF' }}
            >
              Account
            </div>
            <div className="relative w-full flex justify-center pb-4">
              {submenuOpen === 'User Menu' && (
                <span
                  className="nav-accent absolute left-0 top-1.5 bottom-1.5 w-[2px]"
                  style={{ background: ACCENT }}
                  aria-hidden
                />
              )}
              <button
                onClick={() => handleSubmenuToggle('User Menu')}
                className="group flex flex-col items-center justify-center w-16 py-2 transition-colors text-[9px] tracking-[0.18em] uppercase font-medium"
                style={{ color: submenuOpen === 'User Menu' ? INK : MUTED }}
              >
                <span
                  className="flex items-center justify-center h-7 w-7 mb-1.5 text-[10px] tracking-[0.06em] font-semibold transition-colors"
                  style={{
                    background: submenuOpen === 'User Menu' ? ACCENT : '#F3F4F6',
                    color: submenuOpen === 'User Menu' ? '#fff' : INK,
                    borderRadius: '50%',
                  }}
                >
                  {getUserInitials()}
                </span>
                <span className="leading-tight text-center max-w-[60px] truncate">
                  {getUserDisplayName()}
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Extension panel — editorial submenu ── */}
      <div
        className={cn(
          "nav-shell hidden lg:block lg:fixed lg:inset-y-0 lg:left-20 lg:w-64 lg:bg-white lg:z-30 lg:transition-all lg:duration-300 lg:ease-out",
          submenuOpen ? "lg:translate-x-0 lg:opacity-100" : "lg:-translate-x-full lg:opacity-0 lg:pointer-events-none"
        )}
        style={{
          borderRight: `1px solid ${HAIRLINE}`,
          boxShadow: submenuOpen ? '24px 0 48px -32px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Editorial header */}
          <header
            className="flex items-end justify-between px-6 pt-6 pb-5"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.32em] font-medium"
                style={{ color: MUTED }}
              >
                Section
              </p>
              <h2
                className="font-light text-[22px] leading-[1.1] mt-2"
                style={{ color: INK }}
              >
                {submenuOpen}
              </h2>
            </div>
            <button
              onClick={() => setSubmenuOpen(null)}
              aria-label="Close section panel"
              className="text-[11px] uppercase tracking-[0.28em] transition-colors flex items-center gap-1.5 mb-1"
              style={{ color: MUTED }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = INK }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = MUTED }}
            >
              <span className="text-base leading-none">←</span>
            </button>
          </header>

          {/* Items */}
          <div className="flex-1 overflow-y-auto py-2 nav-panel-rise" key={submenuOpen ?? 'none'}>
            {submenuOpen === 'User Menu'
              ? userMenuItems.map(renderSubmenuItem)
              : navigationItems.find(item => item.name === submenuOpen)?.children?.map(renderSubmenuItem)
            }
          </div>

          {/* Footer caption */}
          <div
            className="px-6 py-3 text-[10px] uppercase tracking-[0.28em] font-medium"
            style={{ borderTop: `1px solid ${HAIRLINE}`, color: '#9CA3AF' }}
          >
            L2L · Inventory & Care
          </div>
        </div>
      </div>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden nav-shell">
        <div
          className="flex items-center justify-between bg-white px-4 py-3"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <Link href="/dashboard" className="flex items-center">
            <Image
              src={BRANDING.logoPath}
              alt="L2L"
              width={28}
              height={28}
              className="mr-3"
            />
            <div className="flex flex-col">
              <span
                className="text-[9px] uppercase tracking-[0.32em] font-medium"
                style={{ color: MUTED }}
              >
                Leaf to Life
              </span>
              <span
                className="text-[14px] font-light tracking-tight leading-tight"
                style={{ color: INK }}
              >
                Pharmacy
              </span>
            </div>
          </Link>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center justify-center w-10 h-10 gap-[5px]"
                aria-label="Open menu"
              >
                <span className="block w-5 h-px" style={{ background: INK }} />
                <span className="block w-5 h-px" style={{ background: INK }} />
                <span className="block w-5 h-px" style={{ background: INK }} />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="nav-shell w-72 bg-white p-0"
              style={{ borderRight: `1px solid ${HAIRLINE}` }}
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation menu for the application</SheetDescription>

              <div className="flex flex-col h-full">
                <div
                  className="px-6 pt-8 pb-6"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.32em] font-medium"
                    style={{ color: MUTED }}
                  >
                    Navigation
                  </p>
                  <h2
                    className="font-light text-[26px] leading-[1.1] mt-2"
                    style={{ color: INK }}
                  >
                    Menu
                  </h2>
                </div>

                <nav className="flex-1 px-4 overflow-y-auto min-h-0">
                  {navigationItems.map(renderMobileNavItem)}
                </nav>

                {/* Mobile user block */}
                <div
                  className="flex-shrink-0 px-4 py-3"
                  style={{ borderTop: `1px solid ${HAIRLINE}` }}
                >
                  <div className="flex items-center">
                    <button
                      onClick={() => handleSubmenuToggle('User Menu')}
                      className="group relative flex items-center flex-1 px-2 py-3"
                    >
                      {submenuOpen === 'User Menu' && (
                        <span
                          className="absolute left-0 top-2 bottom-2 w-[2px]"
                          style={{ background: ACCENT }}
                          aria-hidden
                        />
                      )}
                      <span
                        className="flex items-center justify-center h-7 w-7 mr-3 text-[10px] font-semibold"
                        style={{
                          background: submenuOpen === 'User Menu' ? ACCENT : '#F3F4F6',
                          color: submenuOpen === 'User Menu' ? '#fff' : INK,
                          borderRadius: '50%',
                        }}
                      >
                        {getUserInitials()}
                      </span>
                      <div className="flex flex-col text-left">
                        <span
                          className="text-[9px] uppercase tracking-[0.28em] font-medium"
                          style={{ color: MUTED }}
                        >
                          Account
                        </span>
                        <span
                          className="text-[13px] tracking-tight"
                          style={{ color: INK }}
                        >
                          {getUserDisplayName()}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleSubmenuToggle('User Menu')}
                      className="px-3 py-3"
                      aria-label="Toggle account menu"
                    >
                      <span
                        className="inline-block transition-transform text-base leading-none"
                        style={{
                          transform: submenuOpen === 'User Menu' ? 'rotate(90deg)' : 'rotate(0deg)',
                          color: submenuOpen === 'User Menu' ? ACCENT : MUTED,
                        }}
                      >
                        ›
                      </span>
                    </button>
                  </div>

                  {submenuOpen === 'User Menu' && (
                    <div className="pl-9 pb-2">
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
                            className="flex items-center px-2 py-2.5"
                          >
                            {UserIcon && (
                              <span
                                className="mr-3 flex-shrink-0 inline-flex"
                                style={{ color: userActive ? ACCENT : MUTED }}
                              >
                                <UserIcon className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <span
                              className="text-[12px] tracking-tight"
                              style={{ color: userActive ? INK : MUTED }}
                            >
                              {userItem.name}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}
