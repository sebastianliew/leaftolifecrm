/**
 * Smoke-test the Wasabi storage driver end-to-end:
 *   1. Upload a tiny PNG
 *   2. HEAD the returned URL to confirm it's actually reachable
 *   3. Delete the object
 *   4. HEAD again — expect non-200
 *
 * Run: cd backend && npx tsx scripts/smoke-wasabi.ts
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { wasabiDriver } from '../lib/storage/wasabi.js';

const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d494441547' +
    '89c6200010000050001' +
    '0d0a2db40000000049454e44ae426082',
  'hex'
);

async function head(url: string): Promise<number> {
  const res = await fetch(url, { method: 'HEAD' });
  return res.status;
}

async function main(): Promise<void> {
  const key = `smoke-tests/${crypto.randomUUID()}.png`;
  console.log(`[1/4] Uploading ${TINY_PNG.length} bytes to ${key}…`);
  const url = await wasabiDriver.upload(key, TINY_PNG, 'image/png');
  console.log(`      ✓ uploaded → ${url}`);

  console.log('[2/4] HEAD uploaded object…');
  const upStatus = await head(url);
  console.log(`      ${upStatus === 200 ? '✓' : '✗'} HTTP ${upStatus}`);
  if (upStatus !== 200) {
    throw new Error(`Expected 200 after upload, got ${upStatus}`);
  }

  console.log('[3/4] Deleting object…');
  await wasabiDriver.delete(key);
  console.log('      ✓ delete request returned');

  console.log('[4/4] HEAD after delete…');
  const delStatus = await head(url);
  console.log(`      ${delStatus !== 200 ? '✓' : '✗'} HTTP ${delStatus}`);
  if (delStatus === 200) {
    throw new Error(`Object still reachable after delete`);
  }

  console.log('\nAll smoke checks passed.');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
