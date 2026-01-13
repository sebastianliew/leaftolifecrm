import fs from 'fs';
import path from 'path';

/**
 * Local File Storage Service for managing invoice files
 * Simplified version - Azure Blob Storage has been removed (no longer used)
 */
export class BlobStorageService {
  constructor() {
    console.log('[FileStorage] Using local file storage');
  }

  /**
   * Check if external storage is enabled (always false for local-only mode)
   */
  public isEnabled(): boolean {
    return false;
  }

  /**
   * Save a file locally (file is already created by the invoice generator)
   * This method is kept for API compatibility with existing code
   */
  public async uploadFile(localFilePath: string, _blobName: string): Promise<string> {
    // File already exists at localFilePath from invoice generator
    // Just verify it exists and return the path
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }

    console.log('[FileStorage] File saved locally:', localFilePath);
    return localFilePath;
  }

  /**
   * Read a file from local storage
   * Returns a readable stream
   */
  public async downloadFile(_blobName: string, localFallbackPath: string): Promise<{
    stream: NodeJS.ReadableStream;
    exists: boolean;
  }> {
    console.log('[FileStorage] downloadFile called:', { localFallbackPath });

    if (fs.existsSync(localFallbackPath)) {
      console.log('[FileStorage] Reading from local storage:', localFallbackPath);
      return {
        stream: fs.createReadStream(localFallbackPath),
        exists: true,
      };
    }

    console.log('[FileStorage] File not found:', localFallbackPath);
    return { stream: null as never, exists: false };
  }

  /**
   * Delete a file from local storage
   */
  public async deleteFile(_blobName: string, localFallbackPath: string): Promise<boolean> {
    if (fs.existsSync(localFallbackPath)) {
      try {
        fs.unlinkSync(localFallbackPath);
        console.log('[FileStorage] Deleted from local storage:', localFallbackPath);
        return true;
      } catch (error) {
        console.error('[FileStorage] Error deleting local file:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get URL for a file (returns null for local storage)
   */
  public getBlobUrl(_blobName: string): string | null {
    return null;
  }

  /**
   * Get local file path for a blob name
   */
  public getLocalPath(blobName: string, baseDir: string): string {
    return path.join(baseDir, blobName);
  }
}

// Export a singleton instance
export const blobStorageService = new BlobStorageService();
