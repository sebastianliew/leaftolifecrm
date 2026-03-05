import { normalizeTransactionForPayment, formatInvoiceFilename } from '../../../utils/transactionUtils';

describe('transactionUtils', () => {
  describe('normalizeTransactionForPayment', () => {
    it('should convert DRAFT to COMPLETED when paymentStatus is paid', () => {
      const data = { paymentStatus: 'paid' as const, type: 'DRAFT' as const, status: 'draft' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('COMPLETED');
      expect(data.status).toBe('completed');
    });

    it('should not modify data when paymentStatus is not paid', () => {
      const data = { paymentStatus: 'pending' as const, type: 'DRAFT' as const, status: 'draft' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('DRAFT');
      expect(data.status).toBe('draft');
    });

    it('should handle partial paymentStatus gracefully', () => {
      const data = { paymentStatus: 'partial' as const, type: 'DRAFT' as const, status: 'draft' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('DRAFT');
      expect(data.status).toBe('draft');
    });

    it('should handle overdue paymentStatus gracefully', () => {
      const data = { paymentStatus: 'overdue' as const, type: 'DRAFT' as const, status: 'draft' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('DRAFT');
      expect(data.status).toBe('draft');
    });

    it('should handle failed paymentStatus gracefully', () => {
      const data = { paymentStatus: 'failed' as const, type: 'DRAFT' as const, status: 'draft' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('DRAFT');
      expect(data.status).toBe('draft');
    });

    it('should handle partial data when only paymentStatus is provided', () => {
      const data = { paymentStatus: 'paid' as const };
      normalizeTransactionForPayment(data);
      expect(data).toEqual({ paymentStatus: 'paid' });
    });

    it('should handle empty object gracefully', () => {
      const data = {};
      normalizeTransactionForPayment(data);
      expect(data).toEqual({});
    });

    it('should only convert type if type is DRAFT', () => {
      const data = { paymentStatus: 'paid' as const, type: 'COMPLETED' as const, status: 'draft' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('COMPLETED');
      expect(data.status).toBe('completed');
    });

    it('should only convert status if status is draft', () => {
      const data = { paymentStatus: 'paid' as const, type: 'DRAFT' as const, status: 'completed' as const };
      normalizeTransactionForPayment(data);
      expect(data.type).toBe('COMPLETED');
      expect(data.status).toBe('completed');
    });
  });

  describe('formatInvoiceFilename', () => {
    it('should format filename correctly with standard name', () => {
      const result = formatInvoiceFilename('TXN-001', 'John Smith', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_John_Smith_22012026.pdf');
    });

    it('should handle multiple spaces in name by collapsing to single underscores', () => {
      const result = formatInvoiceFilename('TXN-001', 'John  Michael   Smith', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_John_Michael_Smith_22012026.pdf');
    });

    it('should handle special characters in name', () => {
      const result = formatInvoiceFilename('TXN-001', 'José García', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_Jos_Garca_22012026.pdf');
    });

    it('should fallback to Customer when name is all special characters', () => {
      const result = formatInvoiceFilename('TXN-001', '李明', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_Customer_22012026.pdf');
    });

    it('should fallback to Customer when name is empty', () => {
      const result = formatInvoiceFilename('TXN-001', '', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_Customer_22012026.pdf');
    });

    it('should fallback to Customer when name has only spaces', () => {
      const result = formatInvoiceFilename('TXN-001', '   ', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_Customer_22012026.pdf');
    });

    it('should fallback to Customer when name has only special characters and spaces', () => {
      const result = formatInvoiceFilename('TXN-001', '!@#$% ^&*()', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_Customer_22012026.pdf');
    });

    it('should throw error for invalid date string', () => {
      expect(() => formatInvoiceFilename('TXN-001', 'John', 'invalid-date'))
        .toThrow('Invalid transaction date provided for invoice filename');
    });

    it('should throw error for Invalid Date object', () => {
      expect(() => formatInvoiceFilename('TXN-001', 'John', new Date('not-a-date')))
        .toThrow('Invalid transaction date provided for invoice filename');
    });

    it('should accept Date object', () => {
      const result = formatInvoiceFilename('TXN-001', 'John', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_John_22012026.pdf');
    });

    it('should accept ISO date string', () => {
      const result = formatInvoiceFilename('TXN-001', 'John', '2026-01-22');
      expect(result).toBe('TXN-001_John_22012026.pdf');
    });

    it('should accept ISO datetime string', () => {
      const result = formatInvoiceFilename('TXN-001', 'John', '2026-01-22T10:30:00.000Z');
      expect(result).toBe('TXN-001_John_22012026.pdf');
    });

    it('should produce same result for Date object and string representation', () => {
      const date = new Date('2026-01-22');
      const resultDate = formatInvoiceFilename('TXN-001', 'John', date);
      const resultString = formatInvoiceFilename('TXN-001', 'John', '2026-01-22');
      expect(resultDate).toBe(resultString);
    });

    it('should handle single digit day correctly', () => {
      const result = formatInvoiceFilename('TXN-001', 'John', new Date('2026-01-05'));
      expect(result).toBe('TXN-001_John_05012026.pdf');
    });

    it('should handle single digit month correctly', () => {
      const result = formatInvoiceFilename('TXN-001', 'John', new Date('2026-03-22'));
      expect(result).toBe('TXN-001_John_22032026.pdf');
    });

    it('should handle transaction number with dashes', () => {
      const result = formatInvoiceFilename('TXN-20260122-0001', 'John Smith', new Date('2026-01-22'));
      expect(result).toBe('TXN-20260122-0001_John_Smith_22012026.pdf');
    });

    it('should preserve underscores in names that already have them', () => {
      const result = formatInvoiceFilename('TXN-001', 'John_Smith', new Date('2026-01-22'));
      expect(result).toBe('TXN-001_John_Smith_22012026.pdf');
    });

    it('should handle mixed alphanumeric and special characters in name', () => {
      const result = formatInvoiceFilename('TXN-001', "O'Connor-Smith III", new Date('2026-01-22'));
      expect(result).toBe('TXN-001_OConnorSmith_III_22012026.pdf');
    });
  });
});
