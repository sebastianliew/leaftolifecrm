// Email validation regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321
  return EMAIL_REGEX.test(email);
}

export function isValidAmount(amount: number): boolean {
  if (typeof amount !== 'number') return false;
  if (isNaN(amount) || !isFinite(amount)) return false;
  if (amount < 0) return false;
  if (amount > 999999999.99) return false; // Reasonable max
  return true;
}

export function isValidDate(date: Date | undefined | null): boolean {
  if (!date) return false;
  if (!(date instanceof Date)) return false;
  if (isNaN(date.getTime())) return false;
  
  // Check if date is within reasonable bounds (1900 - 2100)
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return false;
  
  return true;
}

export function sanitizeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Basic HTML entity encoding to prevent XSS
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function formatCurrency(amount: number, currency: string = 'SGD'): string {
  if (!isValidAmount(amount)) return `${currency} 0.00`;
  
  try {
    // Use Intl.NumberFormat for proper currency formatting
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    // Fallback formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}