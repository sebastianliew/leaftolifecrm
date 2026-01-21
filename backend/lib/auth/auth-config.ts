import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import { User } from '../../models/User.js'
import { getAccessTokenMaxAge } from '../../auth/jwt.js'

export const authOptions = {
  
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          await connectDB()
          
          // Find user in MongoDB
          const user = await User.findOne({ 
            email: credentials.email.toLowerCase() 
          }).select('+password')

          if (!user) {
            return null
          }

          // Check if user is active
          if (!user.isActive) {
            return null
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(
            credentials.password, 
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          // Update last login
          user.lastLogin = new Date()
          await user.save()

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.displayName || user.username,
            image: user.photoURL,
            role: user.role,
            username: user.username,
            isActive: user.isActive
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],

  callbacks: {

    async jwt({ token, user, account: _account }: { 
      token: Record<string, unknown>; 
      user?: { role: string; username: string; isActive: boolean }; 
      account?: Record<string, unknown> 
    }) {
      if (user) {
        // Store user info in JWT token
        token.role = user.role
        token.username = user.username
        token.isActive = user.isActive
      }
      
      return token
    },

    async session({ session, token }: { 
      session: { user: Record<string, unknown> }; 
      token: Record<string, unknown> & { sub?: string } 
    }) {
      if (token) {
        // Add custom fields to session
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.username = token.username as string
        session.user.isActive = token.isActive as boolean
      }
      
      return session
    }
  },

  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login'
  },

  session: {
    strategy: 'jwt',
    maxAge: getAccessTokenMaxAge(),
  },

  secret: process.env.NEXTAUTH_SECRET,
}