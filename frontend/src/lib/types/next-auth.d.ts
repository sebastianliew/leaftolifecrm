// Custom NextAuth type definitions to fix module resolution issues
import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;
      username?: string;
      isActive?: boolean;
      permissions?: string[];
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role?: string;
    username?: string;
    isActive?: boolean;
    permissions?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: string;
    username?: string;
    isActive?: boolean;
    permissions?: string[];
  }
}

// Fix cookie module types
declare module 'cookie' {
  interface CookieSerializeOptions {
    domain?: string;
    encode?(value: string): string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    priority?: 'low' | 'medium' | 'high';
    sameSite?: true | false | 'lax' | 'strict' | 'none';
    secure?: boolean;
  }

  interface CookieParseOptions {
    decode?(value: string): string;
  }

  function parse(str: string, options?: CookieParseOptions): Record<string, string>;
  function serialize(name: string, value: string, options?: CookieSerializeOptions): string;
}

export {};