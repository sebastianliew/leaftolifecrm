import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Middleware to validate database connection before processing requests.
 * Returns 503 Service Unavailable if MongoDB is not connected.
 */
export const checkDbConnection = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  const readyState = mongoose.connection.readyState;

  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (readyState !== 1) {
    const stateMap: Record<number, string> = {
      0: 'disconnected',
      2: 'connecting',
      3: 'disconnecting'
    };

    console.error(`[DB] Database not ready. State: ${stateMap[readyState] || 'unknown'}`);

    res.status(503).json({
      error: 'Database unavailable',
      message: 'The database connection is not ready. Please try again in a moment.',
      retryAfter: 5
    });
    return;
  }

  next();
};

/**
 * Get current database connection status.
 * Useful for health check endpoints.
 */
export const getDbStatus = (): {
  connected: boolean;
  state: string;
  host?: string;
  name?: string;
} => {
  const connection = mongoose.connection;
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    connected: connection.readyState === 1,
    state: stateMap[connection.readyState] || 'unknown',
    host: connection.host,
    name: connection.name
  };
};
