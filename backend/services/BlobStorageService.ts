import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';

/**
 * Azure Blob Storage Service for managing invoice files
 * Falls back to local file system if Azure credentials are not configured
 */
export class BlobStorageService {
  private containerClient: ContainerClient | null = null;
  private isAzureEnabled: boolean = false;
  private containerName: string = 'invoices';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

    try {
      if (connectionString) {
        // Initialize with connection string
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.containerClient = blobServiceClient.getContainerClient(this.containerName);
        this.isAzureEnabled = true;
        console.log('[BlobStorage] Initialized with connection string');
      } else if (accountName && accountKey) {
        // Initialize with account name and key
        const blobServiceClient = new BlobServiceClient(
          `https://${accountName}.blob.core.windows.net`,
          {
            accountName,
            accountKey,
          } as never
        );
        this.containerClient = blobServiceClient.getContainerClient(this.containerName);
        this.isAzureEnabled = true;
        console.log('[BlobStorage] Initialized with account credentials');
      } else {
        console.log('[BlobStorage] Azure credentials not found, using local storage fallback');
        this.isAzureEnabled = false;
      }

      // Create container if it doesn't exist (only in Azure mode)
      if (this.isAzureEnabled && this.containerClient) {
        this.containerClient.createIfNotExists({ access: 'blob' }).catch((error) => {
          console.error('[BlobStorage] Error creating container:', error);
          // If container creation fails, fall back to local storage
          this.isAzureEnabled = false;
          this.containerClient = null;
        });
      }
    } catch (error) {
      console.error('[BlobStorage] Initialization error:', error);
      this.isAzureEnabled = false;
      this.containerClient = null;
    }
  }

  /**
   * Check if Azure Blob Storage is enabled
   */
  public isEnabled(): boolean {
    return this.isAzureEnabled;
  }

  /**
   * Upload a file to Azure Blob Storage or save locally
   */
  public async uploadFile(localFilePath: string, blobName: string): Promise<string> {
    if (this.isAzureEnabled && this.containerClient) {
      try {
        const blockBlobClient: BlockBlobClient = this.containerClient.getBlockBlobClient(blobName);

        // Read file and upload
        const fileContent = fs.readFileSync(localFilePath);
        await blockBlobClient.uploadData(fileContent, {
          blobHTTPHeaders: { blobContentType: 'application/pdf' },
        });

        console.log('[BlobStorage] Uploaded to Azure Blob Storage:', blobName);
        return blockBlobClient.url;
      } catch (error) {
        console.error('[BlobStorage] Upload error, falling back to local storage:', error);
        // File already exists locally, so just return local path
        return localFilePath;
      }
    }

    // Local storage mode - file already exists at localFilePath
    console.log('[BlobStorage] Using local storage:', localFilePath);
    return localFilePath;
  }

  /**
   * Download a file from Azure Blob Storage or read from local storage
   * Returns a readable stream
   */
  public async downloadFile(blobName: string, localFallbackPath: string): Promise<{
    stream: NodeJS.ReadableStream;
    exists: boolean;
  }> {
    if (this.isAzureEnabled && this.containerClient) {
      try {
        const blockBlobClient: BlockBlobClient = this.containerClient.getBlockBlobClient(blobName);

        // Check if blob exists
        const exists = await blockBlobClient.exists();
        if (!exists) {
          // Try local fallback
          if (fs.existsSync(localFallbackPath)) {
            console.log('[BlobStorage] Blob not found in Azure, using local fallback:', localFallbackPath);
            return {
              stream: fs.createReadStream(localFallbackPath),
              exists: true,
            };
          }
          return { stream: null as never, exists: false };
        }

        // Download from Azure
        const downloadResponse = await blockBlobClient.download();
        if (!downloadResponse.readableStreamBody) {
          throw new Error('No readable stream in download response');
        }

        console.log('[BlobStorage] Downloaded from Azure Blob Storage:', blobName);
        return {
          stream: downloadResponse.readableStreamBody as NodeJS.ReadableStream,
          exists: true,
        };
      } catch (error) {
        console.error('[BlobStorage] Download error, trying local fallback:', error);
        // Fall back to local storage
        if (fs.existsSync(localFallbackPath)) {
          return {
            stream: fs.createReadStream(localFallbackPath),
            exists: true,
          };
        }
        return { stream: null as never, exists: false };
      }
    }

    // Local storage mode
    if (fs.existsSync(localFallbackPath)) {
      console.log('[BlobStorage] Reading from local storage:', localFallbackPath);
      return {
        stream: fs.createReadStream(localFallbackPath),
        exists: true,
      };
    }

    return { stream: null as never, exists: false };
  }

  /**
   * Delete a file from Azure Blob Storage and/or local storage
   */
  public async deleteFile(blobName: string, localFallbackPath: string): Promise<boolean> {
    let deleted = false;

    // Delete from Azure if enabled
    if (this.isAzureEnabled && this.containerClient) {
      try {
        const blockBlobClient: BlockBlobClient = this.containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
        console.log('[BlobStorage] Deleted from Azure Blob Storage:', blobName);
        deleted = true;
      } catch (error) {
        console.error('[BlobStorage] Error deleting from Azure:', error);
      }
    }

    // Also delete from local storage if exists
    if (fs.existsSync(localFallbackPath)) {
      try {
        fs.unlinkSync(localFallbackPath);
        console.log('[BlobStorage] Deleted from local storage:', localFallbackPath);
        deleted = true;
      } catch (error) {
        console.error('[BlobStorage] Error deleting local file:', error);
      }
    }

    return deleted;
  }

  /**
   * Get the public URL for a blob (if Azure is enabled)
   */
  public getBlobUrl(blobName: string): string | null {
    if (this.isAzureEnabled && this.containerClient) {
      const blockBlobClient: BlockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      return blockBlobClient.url;
    }
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
