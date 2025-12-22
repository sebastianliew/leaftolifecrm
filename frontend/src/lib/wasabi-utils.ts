// Wasabi S3 utilities - AWS SDK dependencies disabled for compilation
// import { S3Client } from '@aws-sdk/client-s3'
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type UploadOptions = {
  contentType?: string;
  metadata?: Record<string, string>;
}

export async function uploadToWasabi(
  _key: string, 
  _body: Buffer | Uint8Array | string,
  _options?: UploadOptions
): Promise<{ url: string; key: string }> {
  throw new Error('Wasabi upload not configured - AWS SDK not installed')
}

export async function getSignedDownloadUrl(_key: string, _expiresIn: number = 3600): Promise<string> {
  throw new Error('Wasabi download not configured - AWS SDK not installed')
}

export async function deleteFromWasabi(_key: string): Promise<void> {
  throw new Error('Wasabi delete not configured - AWS SDK not installed')
}