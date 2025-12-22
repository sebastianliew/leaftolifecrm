import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;
    
    const response = await fetch(`${BACKEND_URL}/users/permissions`, {
      method: 'GET',
      headers,
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Backend service unavailable' }, { status: 503 });
  }
}