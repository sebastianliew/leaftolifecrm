import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-config'
import { redirect } from 'next/navigation'

export async function getAuthSession() {
  return await getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getAuthSession()
  
  if (!session) {
    redirect('/login')
  }
  
  return session
}

export async function getAuthUser() {
  const session = await getAuthSession()
  return session?.user || null
}