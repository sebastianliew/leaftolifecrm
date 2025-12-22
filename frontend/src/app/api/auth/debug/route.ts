import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries())
  const cookies = Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value]))
  
  return NextResponse.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET_EXISTS: !!process.env.JWT_SECRET,
      MONGODB_URI_EXISTS: !!process.env.MONGODB_URI,
      VERCEL: process.env.VERCEL,
      VERCEL_URL: process.env.VERCEL_URL,
      FIREBASE_CONFIG: {
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Present' : 'Missing',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Missing',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Missing',
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'Missing',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'Missing',
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'Missing',
      }
    },
    request: {
      url: request.url,
      origin: headers.origin || 'not-set',
      host: headers.host,
      referer: headers.referer || 'not-set',
    },
    cookies: Object.keys(cookies).length > 0 ? Object.keys(cookies) : 'No cookies found',
    cookieHeader: headers.cookie || 'No cookie header',
  })
}