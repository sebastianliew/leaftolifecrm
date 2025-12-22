if (typeof Proxy === 'undefined') {
  console.warn('Proxy is not supported in this environment. Some features may not work correctly.');
}

if (typeof globalThis === 'undefined') {
  (window as Window).globalThis = window;
}

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSKU(_name: string, _categoryId: string): string {
  const namePrefix = _name.slice(0, 3).toUpperCase().padEnd(3, 'X');
  const categorySuffix = _categoryId.slice(-4).padStart(4, '0');
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  // Add additional randomness with crypto if available
  const additionalRandom = typeof crypto !== 'undefined' && crypto.getRandomValues 
    ? crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-4)
    : Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  
  return `${namePrefix}-${categorySuffix}-${timestamp}-${random}-${additionalRandom}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number): string {
  // Use a simple, consistent formatting to avoid hydration issues
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatDate(dateString: string): string {
  // Use UK date format (DD/MM/YYYY) for consistency with Singapore standards
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString // Return original if invalid

  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}` // Returns DD/MM/YYYY format
}
