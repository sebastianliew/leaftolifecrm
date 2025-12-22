import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define protected and public routes
const protectedRoutes = [
  '/inventory',
  '/dashboard', 
  '/transactions',
  '/patients',
  '/users',
  '/reports',
  '/settings',
  '/brands',
  '/suppliers',
  '/bundles',
  '/blend-templates',
  '/history',
  '/refunds'
]


// Helper function to check if token is expired
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    
    const payload = JSON.parse(atob(parts[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    
    return payload.exp < currentTime
  } catch {
    return true
  }
}

// Helper function to get token from request
function getTokenFromRequest(request: NextRequest): string | null {
  // Try to get token from cookie first
  const tokenFromCookie = request.cookies.get('authToken')?.value
  if (tokenFromCookie) return tokenFromCookie
  
  // Try to get from Authorization header as fallback
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow API routes to pass through (they handle their own auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }
  
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
  
  // Get authentication token
  const token = getTokenFromRequest(request)
  
  // Check if user is authenticated
  const isAuthenticated = token && !isTokenExpired(token)
  
  // Handle protected routes
  if (isProtectedRoute && !isAuthenticated) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // Handle authenticated users trying to access login page
  if (pathname === '/login' && isAuthenticated) {
    // Check if there's a redirect URL
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    const redirectUrl = new URL(redirectTo || '/dashboard', request.url)
    return NextResponse.redirect(redirectUrl)
  }
  
  // Allow the request to proceed
  return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}