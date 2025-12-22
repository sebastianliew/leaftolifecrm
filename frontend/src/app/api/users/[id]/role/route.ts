import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

// Proxy to backend API
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await request.json();
    const resolvedParams = await params;
    const response = await apiClient.put(`/users/${resolvedParams.id}/role`, data);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: response.error || 'Failed to update role' },
        { status: response.status }
      );
    }
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Update role proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}