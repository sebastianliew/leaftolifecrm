import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

// Proxy to backend API
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const response = await apiClient.post('/auth/create-admin', data)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: response.error || 'Failed to create admin' },
        { status: response.status }
      )
    }
    
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Create admin proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}