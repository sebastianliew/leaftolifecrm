import { Request, Response } from 'express';
import path from 'path';
import { blobStorageService } from '../services/BlobStorageService.js';

// GET /api/invoices/:filename - Download invoice PDF
export const downloadInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate filename (security: prevent path traversal)
    if (!filename || !filename.endsWith('.pdf') || filename.includes('..') || filename.includes('/')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    // Use process.cwd() to get project root (works in both dev and production)
    // In production on Azure: /home/site/wwwroot/invoices/
    // In development: C:\Users\...\l2l-backend\invoices\
    const localFilePath = path.join(process.cwd(), 'invoices', filename);

    console.log('[Invoice Download] Attempting to download:', filename);

    // Download from Azure Blob Storage or local storage
    const { stream, exists } = await blobStorageService.downloadFile(filename, localFilePath);

    if (!exists) {
      console.log('[Invoice Download] File not found:', filename);
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    console.log('[Invoice Download] Serving file:', filename);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Explicit CORS headers for file download (helps with browser extensions like IDM)
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // Stream the file
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('[Invoice Download] Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download invoice' });
      }
    });
  } catch (error) {
    console.error('[Invoice Download] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download invoice' });
    }
  }
};
