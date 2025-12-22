"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/providers/auth-provider'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

// Helper function to check if user has a valid token
const isUserAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false
  
  const localToken = localStorage.getItem('authToken')
  const cookies = document.cookie.split(';')
  const cookieToken = cookies.find(cookie => cookie.trim().startsWith('authToken='))
  const token = localToken || (cookieToken ? cookieToken.split('=')[1] : null)
  
  if (!token) return false
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    const payload = JSON.parse(atob(parts[1]))
    const isExpired = payload.exp && payload.exp * 1000 < Date.now()
    
    return !isExpired
  } catch {
    return false
  }
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { loading, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!requireAuth) return

    // Check client-side token directly to catch cases where auth provider missed it
    const hasValidToken = isUserAuthenticated()
    
    if (!loading && !isAuthenticated && !hasValidToken) {
      const loginUrl = `/login?redirectTo=${encodeURIComponent(pathname || '')}`
      router.push(loginUrl)
    }
  }, [isAuthenticated, loading, router, pathname, requireAuth])

  // Show loading state while checking authentication
  if (requireAuth && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Don't render content if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated && !isUserAuthenticated()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}