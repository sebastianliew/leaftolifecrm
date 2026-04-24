import type { StorageDriver } from './types.js';

/**
 * In-memory storage driver for tests. Keeps uploads in a Map keyed by the
 * object key; returns a fake URL so assertions can still verify round-trips.
 */
export function createMemoryDriver(): StorageDriver & { store: Map<string, Buffer> } {
  const store = new Map<string, Buffer>();
  return {
    store,
    async upload(key, body, _contentType) {
      store.set(key, body);
      return `memory://test-bucket/${key}`;
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
