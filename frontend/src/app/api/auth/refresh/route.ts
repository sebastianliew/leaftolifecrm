import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT, signJWT } from '@/lib/auth/jwt'
import { getAccessTokenExpiry, getRefreshTokenExpiry, getAccessTokenMaxAge, getRefreshTokenMaxAge } from '@/lib/auth/token-config'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/User'

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

    // Check if secrets exist
    const jwtSecret = process.env.JWT_SECRET
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET

    if (!jwtSecret) {
      console.error('JWT_SECRET is not set in environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!refreshTokenSecret) {
      console.error('REFRESH_TOKEN_SECRET is not set in environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Verify the refresh token using REFRESH_TOKEN_SECRET
    let payload
    try {
      payload = await verifyJWT(refreshToken, refreshTokenSecret)
    } catch (error) {
      console.error('Refresh token verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // Get user ID from the refresh token payload
    const userId = (payload.sub || payload.userId) as string

    // Connect to database and fetch user details
    await connectDB()
    const user = await User.findById(userId).select('-password')

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 401 }
      )
    }

    // Generate new access token using JWT_SECRET with user data from database
    const accessToken = await signJWT(
      {
        sub: userId,
        userId: userId,
        email: user.email,
        username: user.username,
        role: user.role
      },
      jwtSecret,
      getAccessTokenExpiry()
    )

    // Generate new refresh token using REFRESH_TOKEN_SECRET
    const newRefreshToken = await signJWT(
      {
        sub: userId,
        userId: userId,
        type: 'refresh'
      },
      refreshTokenSecret,
      getRefreshTokenExpiry()
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
      maxAge: getAccessTokenMaxAge(),
      path: '/'
    })

    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: getRefreshTokenMaxAge(),
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