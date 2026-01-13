import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | null = null;

export async function setupTestDB(): Promise<void> {
  if (mongoServer) {
    return; // Already set up
  }

  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri);
  console.log('[Test DB] Connected to in-memory MongoDB');
}

export async function teardownTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }

  console.log('[Test DB] Disconnected and stopped MongoDB');
}

export async function clearCollections(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    throw new Error('Database not connected');
  }

  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export function getMongoUri(): string {
  if (!mongoServer) {
    throw new Error('MongoDB server not started');
  }
  return mongoServer.getUri();
}
