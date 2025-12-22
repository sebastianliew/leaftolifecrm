import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({
      message: 'Logout successful'
    })

    // Clear session cookie
    const isProduction = process.env.NODE_ENV === 'production'
    
    response.cookies.set('sessionToken', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    // Even if there's an error, clear the cookies and respond with success
    const response = NextResponse.json({
      message: 'Logout successful'
    })
    
    const isProduction = process.env.NODE_ENV === 'production'
    
    response.cookies.set('sessionToken', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })
    
    return response
  }
}