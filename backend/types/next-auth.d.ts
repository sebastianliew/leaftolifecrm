declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string
    image?: string
    role: string
    username: string
    isActive: boolean
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role: string
      username: string
      isActive: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    username: string
    isActive: boolean
  }
}