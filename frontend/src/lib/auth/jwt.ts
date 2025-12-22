/**
 * JWT Authentication Library for Next.js Edge Runtime
 * Uses Web Crypto API for Edge Runtime compatibility
 * Provides secure JWT signing and verification without Node.js dependencies
 */

export interface JWTPayload {
  sub?: string;       // Subject (user ID)
  email?: string;     // User email
  role?: string;      // User role
  iat?: number;       // Issued at
  exp?: number;       // Expiration time
  nbf?: number;       // Not before
  [key: string]: unknown; // Additional claims
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

/**
 * Base64URL encode a buffer or string
 */
function base64urlEncode(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decode a string to ArrayBuffer
 */
function base64urlDecode(str: string): ArrayBuffer {
  // Add padding if needed
  const padded = str + '==='.slice((str.length + 3) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Create HMAC signature using Web Crypto API
 */
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataBuffer = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  return base64urlEncode(signature);
}

/**
 * Verify HMAC signature using Web Crypto API
 */
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const dataBuffer = encoder.encode(data);
    const signatureBuffer = base64urlDecode(signature);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    return await crypto.subtle.verify('HMAC', cryptoKey, signatureBuffer, dataBuffer);
  } catch (error) {
    console.error('JWT signature verification error:', error);
    return false;
  }
}

/**
 * Sign a JWT token with the given payload
 */
export async function signJWT(payload: JWTPayload, secret: string, expiresIn = '15m'): Promise<string> {
  const header: JWTHeader = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  
  // Parse expiration time
  let expirationSeconds: number;
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiresIn format. Use format like "15m", "1h", "7d"');
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': expirationSeconds = value; break;
      case 'm': expirationSeconds = value * 60; break;
      case 'h': expirationSeconds = value * 60 * 60; break;
      case 'd': expirationSeconds = value * 24 * 60 * 60; break;
      default: throw new Error('Invalid time unit');
    }
  } else {
    expirationSeconds = expiresIn;
  }
  
  const finalPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expirationSeconds,
    nbf: now
  };
  
  const headerString = base64urlEncode(JSON.stringify(header));
  const payloadString = base64urlEncode(JSON.stringify(finalPayload));
  const dataToSign = `${headerString}.${payloadString}`;
  
  const signature = await createSignature(dataToSign, secret);
  
  return `${dataToSign}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  if (!token) {
    throw new Error('Token is required');
  }
  
  if (!secret) {
    throw new Error('Secret is required for JWT verification');
  }
  
  // Split token into parts
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const [headerB64, payloadB64, signature] = parts;
  
  try {
    // Decode header and payload
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64))) as JWTHeader;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as JWTPayload;
    
    // Verify algorithm
    if (header.alg !== 'HS256') {
      throw new Error(`Unsupported algorithm: ${header.alg}`);
    }
    
    // Verify signature
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const isValidSignature = await verifySignature(dataToVerify, signature, secret);
    
    if (!isValidSignature) {
      throw new Error('Invalid JWT signature');
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('JWT token has expired');
    }
    
    // Check not before
    if (payload.nbf && payload.nbf > now) {
      throw new Error('JWT token is not yet valid');
    }
    
    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to verify JWT token');
  }
}

/**
 * Decode JWT token without verification (for inspection only)
 * WARNING: Never use this for authentication - always use verifyJWT
 */
export function decodeJWT(token: string): { header: JWTHeader; payload: JWTPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [headerB64, payloadB64] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64))) as JWTHeader;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as JWTPayload;
    
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired without full verification
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded?.payload.exp) {
    return true; // Consider invalid tokens as expired
  }
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.payload.exp < now;
}

/**
 * Extract expiration time from token
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeJWT(token);
  if (!decoded?.payload.exp) {
    return null;
  }
  
  return new Date(decoded.payload.exp * 1000);
}

/**
 * Token pair interface for access and refresh tokens
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT Service class for easier use
 */
export class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;
  
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || '';
    this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || '';
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    
    // Only throw errors at runtime when actually using the service
    // This allows the build to succeed even without env vars
  }
  
  private validateSecrets(): void {
    if (!this.accessTokenSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (!this.refreshTokenSecret) {
      throw new Error('REFRESH_TOKEN_SECRET environment variable is required');
    }
  }
  
  async signAccessToken(payload: JWTPayload): Promise<string> {
    this.validateSecrets();
    return signJWT(payload, this.accessTokenSecret, this.accessTokenExpiry);
  }
  
  async signRefreshToken(payload: JWTPayload): Promise<string> {
    this.validateSecrets();
    return signJWT(payload, this.refreshTokenSecret, this.refreshTokenExpiry);
  }
  
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    this.validateSecrets();
    return verifyJWT(token, this.accessTokenSecret);
  }
  
  async verifyRefreshToken(token: string): Promise<JWTPayload> {
    this.validateSecrets();
    return verifyJWT(token, this.refreshTokenSecret);
  }
  
  async generateTokenPair(userId: string, email: string, role: string, username: string, isRootLogin?: boolean): Promise<TokenPair> {
    this.validateSecrets();
    
    const payload: JWTPayload = {
      sub: userId,
      email,
      role,
      username,
      type: 'access',
      isRootLogin: isRootLogin || false
    };
    
    const refreshPayload: JWTPayload = {
      sub: userId,
      type: 'refresh'
    };
    
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(payload),
      this.signRefreshToken(refreshPayload)
    ]);
    
    return { accessToken, refreshToken };
  }
}

// Default service instance - lazy loaded to avoid build-time env var requirements
let _jwtService: JWTService | null = null;

export function getJwtService(): JWTService {
  if (!_jwtService) {
    _jwtService = new JWTService();
  }
  return _jwtService;
}