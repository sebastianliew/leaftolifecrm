import { afterEach, describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { InvoiceGenerator } from '../../../services/invoiceGenerator.js';

const generatedFiles: string[] = [];

afterEach(() => {
  for (const file of generatedFiles.splice(0)) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

describe('InvoiceGenerator quantity display', () => {
  it('prints client-facing sold quantities instead of backend base-unit quantities', async () => {
    const outputPath = path.join(os.tmpdir(), `invoice-quantity-display-${Date.now()}.pdf`);
    generatedFiles.push(outputPath);

    await new InvoiceGenerator().generateInvoice({
      invoiceNumber: 'TXN-TEST-001',
      transactionNumber: 'TXN-TEST-001',
      transactionDate: new Date('2026-04-30T00:00:00Z'),
      customerName: 'Test Customer',
      items: [
        { name: 'PhytoEFA', quantity: 12, quantityDisplay: '12 bottles', unitPrice: 100, totalPrice: 1200, itemType: 'product' },
        { name: 'Phytolec+', quantity: 12, quantityDisplay: '12 bottles', unitPrice: 72, totalPrice: 864, itemType: 'product' },
        { name: 'PHYTOXIN', quantity: 10, quantityDisplay: '10 bottles', unitPrice: 70, totalPrice: 700, itemType: 'product' },
        { name: 'L2L GSH Plus', quantity: 2, quantityDisplay: '2 bottles', unitPrice: 80, totalPrice: 160, itemType: 'product' },
      ],
      subtotal: 2924,
      discountAmount: 0,
      totalAmount: 2924,
      currency: 'SGD',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      paidAmount: 2924,
    }, outputPath);

    const text = execFileSync('pdftotext', [outputPath, '-'], { encoding: 'utf8' });

    expect(text).toContain('12 bottles');
    expect(text).toContain('10 bottles');
    expect(text).toContain('2 bottles');
    expect(text).not.toContain('1440 bottle');
    expect(text).not.toContain('720 bottle');
    expect(text).not.toContain('10 Milliliter');
    expect(text).not.toContain('120 cap');
  });
});
