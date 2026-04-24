import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageDriver } from './types.js';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: env('WASABI_REGION'),
    endpoint: env('WASABI_ENDPOINT'),
    credentials: {
      accessKeyId: env('WASABI_ACCESS_KEY'),
      secretAccessKey: env('WASABI_SECRET_KEY'),
    },
    forcePathStyle: false,
  });
  return _client;
}

export const wasabiDriver: StorageDriver = {
  async upload(key, body, contentType) {
    const bucket = env('WASABI_BUCKET_NAME');
    await client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
      })
    );
    // Wasabi virtual-hosted-style URL. WASABI_ENDPOINT is the region endpoint,
    // e.g. https://s3.ap-southeast-1.wasabisys.com → we want the bucket host.
    const endpoint = env('WASABI_ENDPOINT').replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${bucket}.${endpoint}/${encodeURI(key)}`;
  },

  async delete(key) {
    await client().send(
      new DeleteObjectCommand({
        Bucket: env('WASABI_BUCKET_NAME'),
        Key: key,
      })
    );
  },
};
