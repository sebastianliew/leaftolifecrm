import { format, parse, isValid } from 'date-fns';
import { enGB } from 'date-fns/locale';

/**
 * UK Date Formatting Utility
 * All dates are formatted to UK standard (DD/MM/YYYY)
 * This is the single source of truth for date formatting in the application
 */

/**
 * Converts any date input to a valid Date object
 */
function toDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!isValid(dateObj)) return null;

  return dateObj;
}

/**
 * Format date to UK standard DD/MM/YYYY
 * @example formatDateUK('2025-01-29') => '29/01/2025'
 */
export function formatDateUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'dd/MM/yyyy', { locale: enGB });
}

/**
 * Format date with time to UK standard DD/MM/YYYY HH:mm
 * @example formatDateTimeUK('2025-01-29T14:30:00') => '29/01/2025 14:30'
 */
export function formatDateTimeUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: enGB });
}

/**
 * Format date to long UK format
 * @example formatDateLongUK('2025-01-29') => '29 January 2025'
 */
export function formatDateLongUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'dd MMMM yyyy', { locale: enGB });
}

/**
 * Format date to medium UK format
 * @example formatDateMediumUK('2025-01-29') => '29 Jan 2025'
 */
export function formatDateMediumUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'dd MMM yyyy', { locale: enGB });
}

/**
 * Format date with full day name
 * @example formatDateWithDayUK('2025-01-29') => 'Wednesday, 29 January 2025'
 */
export function formatDateWithDayUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'EEEE, dd MMMM yyyy', { locale: enGB });
}

/**
 * Format time only in 24-hour format
 * @example formatTimeUK('2025-01-29T14:30:00') => '14:30'
 */
export function formatTimeUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'HH:mm', { locale: enGB });
}

/**
 * Format time only in 12-hour format with AM/PM
 * @example formatTime12UK('2025-01-29T14:30:00') => '2:30 PM'
 */
export function formatTime12UK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'h:mm a', { locale: enGB });
}

/**
 * Format for file names (safe characters)
 * @example formatDateForFileUK('2025-01-29') => '29-01-2025'
 */
export function formatDateForFileUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  return format(dateObj, 'dd-MM-yyyy', { locale: enGB });
}

/**
 * Parse UK format date string to Date object
 * @example parseUKDate('29/01/2025') => Date object
 */
export function parseUKDate(dateString: string): Date | null {
  try {
    // Try parsing DD/MM/YYYY format
    const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date(), { locale: enGB });
    if (isValid(parsedDate)) return parsedDate;

    // Try parsing DD-MM-YYYY format
    const parsedDate2 = parse(dateString, 'dd-MM-yyyy', new Date(), { locale: enGB });
    if (isValid(parsedDate2)) return parsedDate2;

    // Fallback to native Date parsing for ISO formats
    const fallbackDate = new Date(dateString);
    if (isValid(fallbackDate)) return fallbackDate;

    return null;
  } catch {
    return null;
  }
}

/**
 * Get relative date text
 * @example getRelativeDateUK(yesterday) => 'Yesterday'
 * @example getRelativeDateUK(today) => 'Today'
 * @example getRelativeDateUK(tomorrow) => 'Tomorrow'
 */
export function getRelativeDateUK(date: Date | string | null | undefined): string {
  const dateObj = toDate(date);
  if (!dateObj) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const compareDate = new Date(dateObj);
  compareDate.setHours(0, 0, 0, 0);

  const diffTime = compareDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return formatDateUK(dateObj);
}

/**
 * Format date range
 * @example formatDateRangeUK('2025-01-01', '2025-01-31') => '01/01/2025 - 31/01/2025'
 */
export function formatDateRangeUK(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  const start = formatDateUK(startDate);
  const end = formatDateUK(endDate);

  if (!start && !end) return '';
  if (!start) return `Until ${end}`;
  if (!end) return `From ${start}`;

  return `${start} - ${end}`;
}

/**
 * Legacy compatibility - maps to UK format
 * This maintains backward compatibility while migrating to UK standard
 */
export const formatDate = formatDateUK;
export const formatDateTime = formatDateTimeUK;
export const formatTime = formatTimeUK;

/**
 * Default locale for use with native JavaScript Date methods
 */
export const DEFAULT_LOCALE = 'en-GB';
export const DEFAULT_LOCALE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
};