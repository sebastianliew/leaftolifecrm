---
title: Storage Abstraction (Wasabi / S3)
description: How backend services upload binary assets to object storage, and how tests swap the driver for an in-memory one.
tags: [storage, wasabi, s3, architecture, testing]
created: 2026-04-17
---

# Storage Abstraction

**TL;DR** — `backend/lib/storage/` exposes a tiny `StorageDriver` interface with `upload(key, buffer, contentType) → publicUrl` and `delete(key)`. Production swaps in a Wasabi (S3-compatible) driver at boot; tests swap in an in-memory driver so they never hit real infra. No file is ever written to the backend's local disk.

## The interface

```ts
// lib/storage/types.ts
export interface StorageDriver {
  upload(key: string, body: Buffer, contentType: string): Promise<string>; // returns public URL
  delete(key: string): Promise<void>;
}
```

That's the entire contract. Three methods less than S3 has, because nothing in the CRM needs list/head/copy semantics yet — add them only when a feature demands it.

## The registry

```ts
// lib/storage/index.ts
let activeDriver: StorageDriver = wasabiDriver;
export const getStorageDriver = () => activeDriver;
export const setStorageDriver = (d: StorageDriver) => { activeDriver = d; };
```

Boot picks `wasabiDriver` by default. Tests call `setStorageDriver(createMemoryDriver())` once in `beforeAll`. No env flag, no DI container — just a module-level pointer that the one place that matters (`PatientService`) reads through `getStorageDriver()`.

## Drivers

### Wasabi (`lib/storage/wasabi.ts`)

Thin wrapper over `@aws-sdk/client-s3` configured with:
- `endpoint: process.env.WASABI_ENDPOINT` (regional host like `https://s3.ap-southeast-1.wasabisys.com`)
- `region: process.env.WASABI_REGION`
- `credentials` from `WASABI_ACCESS_KEY` / `WASABI_SECRET_KEY`
- `forcePathStyle: false` — virtual-hosted-style bucket URLs

Upload issues `PutObjectCommand` with `ACL: 'public-read'` and returns the virtual-hosted URL `https://<bucket>.<endpoint-host>/<key>`. Delete issues `DeleteObjectCommand`. Client is lazy-initialised and cached on first call — avoids env-var reads at import time, which matters for the test path.

### Memory (`lib/storage/memory.ts`)

```ts
export function createMemoryDriver(): StorageDriver & { store: Map<string, Buffer> } {
  const store = new Map();
  return {
    store,
    async upload(key, body) { store.set(key, body); return `memory://test-bucket/${key}`; },
    async delete(key) { store.delete(key); },
  };
}
```

Tests assert on `memDriver.store.has(key)` and `memDriver.store.get(key)!.length` — exactly what they'd assert on disk, without the filesystem.

## Why a driver abstraction at all

1. **No-fs tests** — we don't want CI writing real files under `backend/uploads/` or talking to Wasabi on every run. The memory driver takes `fileFilter`, `mimetype`, `size`, and routing entirely at face value without I/O.
2. **Portable providers** — Wasabi is S3-compatible, so the same SDK works. But if the project ever moves to Cloudflare R2, Backblaze B2, or plain AWS S3, only `wasabi.ts` changes.
3. **Fail-safe services** — services that call `getStorageDriver().upload(...)` don't know what's downstream. They can wrap the call in a try/catch + delete-on-failure without leaking AWS-specific error types.

## Don't confuse this with `BlobStorageService`

[[BlobStorageService.ts]] is a **separate, older module** in `backend/services/` that used to wrap Azure Blob for invoice PDFs. It has since been reduced to a local-filesystem no-op. New features should **not** call it.

| Need | Use |
|---|---|
| Upload user-visible image/binary to object storage | `getStorageDriver()` from `lib/storage/` |
| Temporarily locate an invoice PDF on disk for email attachment | `BlobStorageService` (legacy) |

Eventually BlobStorageService should be removed or collapsed into the new driver; filed under "open questions" until someone feels strongly about it.

## Env config

```
WASABI_ACCESS_KEY=
WASABI_SECRET_KEY=
WASABI_BUCKET_NAME=leaftolife
WASABI_REGION=ap-southeast-1
WASABI_ENDPOINT=https://s3.ap-southeast-1.wasabisys.com
```

Missing vars throw at first `upload`/`delete` call — not at boot — so the test path (which never touches `wasabiDriver`) doesn't care whether they're set.

## Using it in a new feature

```ts
import { getStorageDriver } from '../lib/storage/index.js';

async function saveSomething(buffer: Buffer, contentType: string) {
  const key = `some-prefix/${crypto.randomUUID()}${ext}`;
  const url = await getStorageDriver().upload(key, buffer, contentType);
  try {
    await MyModel.create({ storageKey: key, url });
  } catch (err) {
    await getStorageDriver().delete(key).catch(() => {}); // rollback
    throw err;
  }
}
```

Two rules:
1. **Fail-fast before upload** wherever possible (e.g. check the parent record exists). Prevents orphan objects in the happy-failure-path.
2. **Best-effort delete-on-failure** after upload. Don't let storage errors mask the original DB error.

## Live smoke test

`backend/scripts/smoke-wasabi.ts` — uploads a 1×1 PNG, HEADs it (expects 200), deletes it, HEADs again (expects non-200). Confirms the SDK wiring, the bucket, the region, and the ACL are all in agreement. Run when credentials change or the bucket moves regions.

## Gotchas / open questions

- **Lazy env reads** — `wasabi.ts` throws on missing env inside `client()`, not at module top-level. This is deliberate: tests import the module transitively (via `lib/storage/index.ts`) but never call through it, so they shouldn't need Wasabi env set.
- **Public ACL** — every upload is public-read. For anything sensitive, switch to presigned URLs and have the frontend fetch the URL just in time. See [[patient-medical-photos]] for the only current use site.
- **No multipart upload** — `PutObjectCommand` is fine up to the 10 MB Multer cap. If a feature needs >100 MB uploads, introduce `@aws-sdk/lib-storage`'s `Upload` helper.
- **Test flakiness** — because `activeDriver` is a module singleton, a suite that sets the memory driver and forgets to reset it will leak into later suites. Put `setStorageDriver` in `beforeAll`; don't rely on the default still being Wasabi afterwards.
