import { NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

// Proxy to backend API  
export async function GET() {
  try {
    const response = await apiClient.get('/auth/temp-users')
    
    if (!response.ok) {
      return NextResponse.json(
        { error: response.error || 'Failed to get temp users' },
        { status: response.status }
      )
    }
    
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Temp users proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}