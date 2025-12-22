import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT, signJWT } from '@/lib/auth/jwt'

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = request.cookies.get('refreshToken')?.value
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      )
    }
    
    // Check if JWT_SECRET exists
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET is not set in environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    // Verify the refresh token
    let payload
    try {
      payload = await verifyJWT(refreshToken, jwtSecret)
    } catch (error) {
      console.error('Refresh token verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }
    
    // Generate new tokens
    const userId = (payload.sub || payload.userId) as string
    const accessToken = await signJWT(
      {
        sub: userId,
        userId: userId,
        email: payload.email as string,
        username: payload.username as string,
        role: payload.role as string
      },
      jwtSecret,
      '24h'
    )
    
    const newRefreshToken = await signJWT(
      {
        sub: userId,
        userId: userId,
        type: 'refresh'
      },
      jwtSecret,
      '7d'
    )
    
    // Create response
    const response = NextResponse.json({
      message: 'Token refreshed successfully',
      accessToken
    })
    
    // Set cookies
    const isProduction = process.env.NODE_ENV === 'production'
    
    response.cookies.set('authToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })
    
    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    })
    
    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    )
  }
}