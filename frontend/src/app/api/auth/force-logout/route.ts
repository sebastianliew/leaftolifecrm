import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Get all cookies
    const cookieStore = await cookies()
    
    // Delete session token
    cookieStore.delete('sessionToken')
    
    // Delete any other auth-related cookies
    const allCookies = cookieStore.getAll()
    allCookies.forEach(cookie => {
      if (cookie.name.includes('auth') || cookie.name.includes('firebase') || cookie.name.includes('token')) {
        cookieStore.delete(cookie.name)
      }
    })
    
    // Redirect to login
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'))
  } catch (error) {
    console.error('Force logout error:', error)
    // Even on error, redirect to login
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'))
  }
}