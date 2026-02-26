import { format } from 'date-fns/format';

/**
 * Generates a unique batch number for a product
 * Format: {PRODUCT_CODE}-{DATE}-{SEQUENCE}
 * Example: ABC123-20240315-001
 */
export function generateBatchNumber(productCode: string, sequence: number): string {
  const date = format(new Date(), 'yyyyMMdd')
  const paddedSequence = String(sequence).padStart(3, '0')
  return `${productCode}-${date}-${paddedSequence}`
}

/**
 * Generates a unique transaction number
 * Format: TXN-MM_DD_YYYY-XXXX
 * Example: TXN-09_09_2025-0001
 * Note: This is a fallback function. The main generation logic is in Transaction model
 * using TransactionNumberTracking collection for proper sequential numbering.
 */
/** @deprecated Transaction numbers must be generated server-side via TransactionNumberTracking. */
export function generateTransactionNumber(): string {
  throw new Error('Transaction numbers must be generated server-side. Do not use this function.');
}

/**
 * Extracts the sequence number from a batch number
 */
export function extractSequenceFromBatchNumber(batchNumber: string): number {
  const parts = batchNumber.split('-')
  return parseInt(parts[parts.length - 1], 10)
}

/**
 * Validates if a string is a valid batch number format
 */
export function isValidBatchNumber(batchNumber: string): boolean {
  const batchNumberRegex = /^[A-Z0-9]+-\d{8}-\d{3}$/
  return batchNumberRegex.test(batchNumber)
}

/**
 * Generates a unique refund number
 * Format: REF-{YYYYMMDD}-{SEQUENCE}
 * Example: REF-20240315-0001
 * Note: This is a placeholder - the actual implementation with sequence tracking
 * is handled in the Refund model's static method
 */
export function generateRefundNumber(): string {
  const date = format(new Date(), 'yyyyMMdd')
  const randomSequence = Math.floor(Math.random() * 9999) + 1
  const paddedSequence = String(randomSequence).padStart(4, '0')
  return `REF-${date}-${paddedSequence}`
}