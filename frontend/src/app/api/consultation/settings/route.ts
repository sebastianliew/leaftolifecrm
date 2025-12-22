import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

export async function GET() {
  try {
    const response = await apiClient.get('/api/consultation/settings');
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching consultation settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consultation settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const response = await apiClient.put('/api/consultation/settings', data);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating consultation settings:', error);
    return NextResponse.json(
      { error: 'Failed to update consultation settings' },
      { status: 500 }
    );
  }
}