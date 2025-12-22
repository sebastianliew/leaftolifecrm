import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

async function proxyToBackend(request: NextRequest, endpoint: string) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const url = `${BACKEND_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Forward authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const options: RequestInit = {
    method: request.method,
    headers,
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to backend ${url}:`, error);
    return NextResponse.json({ error: 'Backend service unavailable' }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/reports/inventory-analysis');
}