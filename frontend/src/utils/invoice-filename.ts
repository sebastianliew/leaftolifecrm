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
