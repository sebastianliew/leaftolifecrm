/**
 * MongoDB Connection Utility
 *
 * NOTE: The primary connection is now managed centrally in server.ts
 * This file is kept for backward compatibility with existing imports.
 * The server waits for MongoDB connection before accepting requests,
 * so services can use mongoose directly without calling connectDB().
 */

import mongoose from 'mongoose';

/**
 * Returns the existing mongoose connection.
 * The connection is established in server.ts before the server starts.
 *
 * @deprecated Use mongoose directly - connection is managed by server.ts
 */
async function connectDB(): Promise<typeof mongoose> {
  // Connection is already established by server.ts
  if (mongoose.connection.readyState !== 1) {
    console.warn('[connectDB] Warning: Called before server connection was established');

    // Fallback: try to connect if not connected (shouldn't happen normally)
    if (!process.env.MONGODB_URI) {
      throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    }

    await mongoose.connect(process.env.MONGODB_URI);
  }

  return mongoose;
}

export default connectDB;
export { connectDB }; 