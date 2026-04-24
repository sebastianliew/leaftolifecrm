/**
 * StorageDriver — minimal abstraction over object storage so tests can swap in
 * an in-memory driver without touching real Wasabi buckets.
 *
 * `upload` returns the public URL the frontend will use in <img src>.
 */
export interface StorageDriver {
  upload(key: string, body: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}
