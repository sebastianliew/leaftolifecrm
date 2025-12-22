// Puppeteer invoice generator - dependencies disabled for frontend compilation
// import puppeteerCore from 'puppeteer-core';
// import chromium from '@sparticuz/chromium';

import type { Transaction } from '@/types/transaction';

export async function generateInvoicePDF(_transaction: Transaction): Promise<string> {
  throw new Error('PDF generation not available in frontend - use backend API')
}

export async function generateInvoiceBuffer(_transaction: Transaction): Promise<Buffer> {
  throw new Error('PDF generation not available in frontend - use backend API')
}