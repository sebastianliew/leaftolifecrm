import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Test backend login attempt:', {
      apiUrl: API_URL,
      email: body.email,
      passwordLength: body.password?.length
    })
    
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    const data = await response.json()
    
    console.log('Backend response:', {
      status: response.status,
      ok: response.ok,
      data: data
    })
    
    return NextResponse.json({
      status: response.status,
      ok: response.ok,
      data: data,
      debug: {
        apiUrl: API_URL,
        requestBody: { email: body.email, passwordProvided: !!body.password }
      }
    })
  } catch (error) {
    console.error('Test backend error:', error)
    return NextResponse.json({
      error: 'Failed to connect to backend',
      details: error instanceof Error ? error.message : 'Unknown error',
      apiUrl: API_URL
    }, { status: 500 })
  }
}