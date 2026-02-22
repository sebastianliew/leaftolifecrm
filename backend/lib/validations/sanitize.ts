import mongoose from 'mongoose';

// ─── ObjectId ────────────────────────────────────────────────────────────────

/** Strict ObjectId check (24-hex chars AND Mongoose agrees). */
export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id);
}

/** Throw 400 if `id` is not a valid ObjectId. Returns the validated string. */
export function requireObjectId(id: unknown, label = 'ID'): string {
  if (!isValidObjectId(id)) {
    throw Object.assign(new Error(`Invalid ${label}`), { statusCode: 400 });
  }
  return id;
}

// ─── Search ──────────────────────────────────────────────────────────────────

/** Escape regex special chars so user input is treated as literal text. */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a case-insensitive regex from user search input (escaped). */
export function safeSearchRegex(term: string): RegExp {
  return new RegExp(escapeRegex(term.trim()), 'i');
}

// ─── Strings ─────────────────────────────────────────────────────────────────

/** Normalize blank/whitespace-only strings to null (for sparse unique indexes). */
export function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

const MAX_PAGE_SIZE = 100;

/** Clamp page size to a safe maximum. */
export function clampLimit(raw: number, max = MAX_PAGE_SIZE): number {
  return Math.max(1, Math.min(max, raw));
}

// ─── Field whitelisting ─────────────────────────────────────────────────────

/** Pick only allowed keys from an object (mass-assignment protection). */
export function pickFields<T extends Record<string, unknown>>(
  data: T,
  allowed: ReadonlySet<string>
): Partial<T> {
  const clean = {} as Partial<T>;
  for (const key of Object.keys(data)) {
    if (allowed.has(key)) {
      (clean as Record<string, unknown>)[key] = data[key];
    }
  }
  return clean;
}

// ─── Dot notation ────────────────────────────────────────────────────────────

/** Flatten specified nested keys to dot notation for safe MongoDB $set updates. */
export function toDotNotation(
  data: Record<string, unknown>,
  nestedKeys: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (nestedKeys.includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nested, nestedVal] of Object.entries(value as Record<string, unknown>)) {
        result[`${key}.${nested}`] = nestedVal;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** Check that a date is not in the future. */
export function isPastOrToday(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}
