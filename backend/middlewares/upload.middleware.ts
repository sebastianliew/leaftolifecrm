/**
 * Multer middleware for patient medical photos.
 *
 * Uses memoryStorage — the file buffer is handed straight to the storage
 * driver (Wasabi in prod/dev, in-memory in tests). Nothing is ever written
 * to the backend's local disk.
 */

import multer from 'multer';
import type { Request } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MulterFile = any;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB per image

function imageFilter(
  _req: Request,
  file: MulterFile,
  cb: (err: Error | null, accept?: boolean) => void
): void {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
}

export const patientPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
  fileFilter: imageFilter,
});
