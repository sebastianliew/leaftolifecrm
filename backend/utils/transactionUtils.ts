/**
 * Utility functions for transaction processing
 *
 * @module transactionUtils
 */

/**
 * Type-safe interface for transaction normalization data
 */
export interface TransactionNormalizationData {
  paymentStatus?: 'pending' | 'paid' | 'partial' | 'overdue' | 'failed';
  status?: 'pending' | 'completed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'draft';
  type?: 'DRAFT' | 'COMPLETED';
}

/**
 * Formats invoice filename as: TXN_CustomerName_DDMMYYYY.pdf
 *
 * @param transactionNumber - The transaction number (e.g., 'TXN-20260122-0001')
 * @param customerName - The customer's name (will be sanitized)
 * @param transactionDate - The transaction date as Date object or ISO string
 * @returns Formatted filename with .pdf extension
 * @throws Error if transactionDate is invalid
 *
 * @example
 * formatInvoiceFilename('TXN-001', 'John Smith', new Date('2026-01-22'))
 * // Returns: 'TXN-001_John_Smith_22012026.pdf'
 *
 * @example
 * // Handles special characters - falls back to 'Customer' if name becomes empty
 * formatInvoiceFilename('TXN-001', '李明', new Date('2026-01-22'))
 * // Returns: 'TXN-001_Customer_22012026.pdf'
 */
export function formatInvoiceFilename(
  transactionNumber: string,
  customerName: string,
  transactionDate: Date | string
): string {
  // Sanitize name: replace spaces with underscores, remove non-alphanumeric characters
  // Also remove leading/trailing underscores and collapse multiple underscores
  // Fallback to 'Customer' if sanitized name is empty (e.g., all special characters or only spaces)
  const sanitizedName = customerName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')  // Remove leading/trailing underscores
    .replace(/_+/g, '_')      // Collapse multiple underscores to single
    || 'Customer';

  const date = new Date(transactionDate);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid transaction date provided for invoice filename');
  }

  // Convert to Singapore timezone (UTC+8) for consistent filename dates
  const sgDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  const day = String(sgDate.getDate()).padStart(2, '0');
  const month = String(sgDate.getMonth() + 1).padStart(2, '0');
  const year = sgDate.getFullYear();

  return `${transactionNumber}_${sanitizedName}_${day}${month}${year}.pdf`;
}

/**
 * Normalizes transaction type and status when payment is marked as paid.
 *
 * ## Business Rule
 * **Paid transactions cannot be drafts.** When a transaction has `paymentStatus === 'paid'`,
 * the system enforces that it must be a completed transaction, not a draft.
 *
 * ## State Transitions
 * When `paymentStatus` is `'paid'`:
 * - `type: 'DRAFT'` → `type: 'COMPLETED'`
 * - `status: 'draft'` → `status: 'completed'`
 *
 * ## Architecture: Dual Invocation Points
 * This function is intentionally called from two places to ensure consistent normalization:
 *
 * 1. **Pre-save middleware** (`Transaction.ts`):
 *    - Catches all `.save()` calls (new transactions, direct document updates)
 *    - Provides automatic enforcement for Mongoose document operations
 *
 * 2. **Controller logic** (`transactions.controller.ts`):
 *    - Required because `findByIdAndUpdate()` does NOT trigger pre-save middleware
 *    - Controllers have full context (existing document + update payload) to make
 *      informed decisions about state transitions
 *
 * ## Why No pre-findOneAndUpdate Middleware?
 * Mongoose's `pre-findOneAndUpdate` middleware only has access to the update object,
 * not the existing document values. This makes it impossible to correctly handle
 * partial updates where we need to know both the current state and the intended
 * changes. Controllers fetch the existing document first, enabling proper logic
 * like "was this a draft being completed?" checks.
 *
 * @param data - Object containing paymentStatus, status, and type fields
 * @returns void - mutates the data object in place
 *
 * @example
 * // Direct mutation for update payload
 * const updateData = { paymentStatus: 'paid', type: 'DRAFT', status: 'draft' };
 * normalizeTransactionForPayment(updateData);
 * // Result: { paymentStatus: 'paid', type: 'COMPLETED', status: 'completed' }
 *
 * @example
 * // No change when payment is not 'paid'
 * const pendingData = { paymentStatus: 'pending', type: 'DRAFT', status: 'draft' };
 * normalizeTransactionForPayment(pendingData);
 * // Result: unchanged - { paymentStatus: 'pending', type: 'DRAFT', status: 'draft' }
 */
export function normalizeTransactionForPayment(data: TransactionNormalizationData): void {
  if (data.paymentStatus === 'paid') {
    if (data.type === 'DRAFT') {
      data.type = 'COMPLETED';
    }
    if (data.status === 'draft') {
      data.status = 'completed';
    }
  }
}
