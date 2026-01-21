/**
 * Token Configuration Utility
 * Provides centralized token expiration configuration from environment variables
 */

/**
 * Parse time string (e.g., "24h", "30d", "15m") to seconds
 */
export function parseTimeToSeconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Use format like "15m", "1h", "7d", "30d"`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: throw new Error(`Invalid time unit: ${unit}`);
  }
}

/**
 * Get access token expiration string from env (e.g., "24h")
 * Default: 24h (1 day)
 */
export function getAccessTokenExpiry(): string {
  return process.env.JWT_EXPIRES_IN || '24h';
}

/**
 * Get refresh token expiration string from env (e.g., "30d")
 * Default: 30d (1 month)
 */
export function getRefreshTokenExpiry(): string {
  return process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
}

/**
 * Get access token maxAge in seconds for cookies
 */
export function getAccessTokenMaxAge(): number {
  return parseTimeToSeconds(getAccessTokenExpiry());
}

/**
 * Get refresh token maxAge in seconds for cookies
 */
export function getRefreshTokenMaxAge(): number {
  return parseTimeToSeconds(getRefreshTokenExpiry());
}

/**
 * Get access token expiration in days for js-cookie
 */
export function getAccessTokenExpiryDays(): number {
  return getAccessTokenMaxAge() / (24 * 60 * 60);
}

/**
 * Get refresh token expiration in days for js-cookie
 */
export function getRefreshTokenExpiryDays(): number {
  return getRefreshTokenMaxAge() / (24 * 60 * 60);
}
