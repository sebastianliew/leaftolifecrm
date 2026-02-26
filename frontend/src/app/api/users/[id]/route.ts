import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';

async function proxyToBackend(request: NextRequest, userId: string) {
  const url = `${BACKEND_URL}/users/${userId}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const options: RequestInit = {
    method: request.method,
    headers,
  };

  if (['PUT', 'PATCH'].includes(request.method)) {
    try {
      const body = await request.json();
      options.body = JSON.stringify(body);
    } catch {
      // No body
    }
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to backend ${url}:`, error);
    return NextResponse.json({ error: 'Backend service unavailable' }, { status: 503 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return proxyToBackend(request, resolvedParams.id);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return proxyToBackend(request, resolvedParams.id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return proxyToBackend(request, resolvedParams.id);
}