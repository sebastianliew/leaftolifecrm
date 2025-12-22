import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

export async function GET() {
  try {
    const response = await apiClient.get('/api/consultation/discount-presets');
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching discount presets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discount presets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const response = await apiClient.post('/api/consultation/discount-presets', data);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating discount preset:', error);
    return NextResponse.json(
      { error: 'Failed to create discount preset' },
      { status: 500 }
    );
  }
}