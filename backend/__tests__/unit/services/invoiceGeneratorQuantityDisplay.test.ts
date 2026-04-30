import { describe, expect, it, jest } from '@jest/globals';
import { InvoiceGenerator } from '../../../services/invoiceGenerator.js';

describe('InvoiceGenerator quantity display', () => {
  it('prints client-facing sold quantities instead of backend base-unit quantities', async () => {
    const renderedText: string[] = [];
    const mockDoc = {
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn((text: string) => {
        renderedText.push(String(text));
        return mockDoc;
      }),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      strokeColor: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
    };

    const generator = new InvoiceGenerator();
    (generator as unknown as { doc: typeof mockDoc }).doc = mockDoc;
    (generator as unknown as { addItemsTable: (data: unknown) => void }).addItemsTable({
      items: [
        { name: 'PhytoEFA', quantity: 12, quantityDisplay: '12 bottles', unitPrice: 100, totalPrice: 1200, itemType: 'product' },
        { name: 'Phytolec+', quantity: 12, quantityDisplay: '12 bottles', unitPrice: 72, totalPrice: 864, itemType: 'product' },
        { name: 'PHYTOXIN', quantity: 10, quantityDisplay: '10 bottles', unitPrice: 70, totalPrice: 700, itemType: 'product' },
        { name: 'L2L GSH Plus', quantity: 2, quantityDisplay: '2 bottles', unitPrice: 80, totalPrice: 160, itemType: 'product' },
      ],
      currency: 'SGD',
    });

    const text = renderedText.join('\n');

    expect(text).toContain('12 bottles');
    expect(text).toContain('10 bottles');
    expect(text).toContain('2 bottles');
    expect(text).not.toContain('1440 bottle');
    expect(text).not.toContain('720 bottle');
    expect(text).not.toContain('10 Milliliter');
    expect(text).not.toContain('120 cap');
  });
});
