import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Please use /api/auth/firebase-login for authentication' },
    { status: 400 }
  )
}