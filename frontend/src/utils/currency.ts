/**
 * Currency formatting utilities for Singapore Dollar (SGD)
 */

export const CURRENCY_CODE = 'SGD';
export const CURRENCY_SYMBOL = 'S$';

/**
 * Format a number as SGD currency
 * @param amount - The amount to format
 * @param showCode - Whether to show currency code (default: false, shows symbol)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, showCode = false): string {
  // Validate amount is a valid number
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showCode ? 'SGD 0.00' : 'S$0.00';
  }

  if (showCode) {
    return `SGD ${amount.toFixed(2)}`;
  }
  return `S$${amount.toFixed(2)}`;
}

/**
 * Format a number as SGD currency with locale formatting
 * @param amount - The amount to format
 * @returns Formatted currency string with thousands separators
 */
export function formatCurrencyLocale(amount: number): string {
  // Validate amount is a valid number
  if (amount === undefined || amount === null || isNaN(amount)) {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(0);
  }

  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(amount);
}