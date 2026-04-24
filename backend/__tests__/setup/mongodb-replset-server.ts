/**
 * Replica-set variant of the in-memory MongoDB setup, needed for tests that
 * drive code paths which open mongoose sessions / transactions (refunds,
 * transaction inventory with session). Standalone MongoMemoryServer rejects
 * `session.startTransaction()` with "Transaction numbers are only allowed
 * on a replica set member or mongos".
 */

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet: MongoMemoryReplSet | null = null;

export async function setupReplSetDB(): Promise<void> {
  if (replSet) return;

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
}

export async function teardownReplSetDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

export async function clearReplSetCollections(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    throw new Error('Database not connected');
  }
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
