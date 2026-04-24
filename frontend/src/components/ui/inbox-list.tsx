"use client"

/**
 * InboxList Component
 *
 * Gmail-style inbox list. Pure white, minimal, no neumorphism.
 * Layout: Header (title + search + filters) → Toolbar (pagination) → Rows
 */

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Search } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface InboxColumn<T> {
  key: string;
  header?: string;
  width?: string; // tailwind width class like 'w-52', 'w-16'
  align?: 'left' | 'right';
  render: (item: T) => ReactNode;
}

export interface InboxListProps<T> {
  /** Page title shown top-left (hidden if empty string) */
  title?: string;
  /** Data items */
  data: T[];
  /** Column renderers (no headers — Gmail style) */
  columns: InboxColumn<T>[];
  /** Row key extractor */
  getRowKey: (item: T) => string;
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Search */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Pagination */
  page?: number;
  totalPages?: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /** Extra toolbar content (filters, add button, etc.) rendered after search */
  toolbar?: ReactNode;
  /** Filter area below header (extended filters) */
  filterArea?: ReactNode;
  /** Empty state */
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Extra class(es) applied to each row */
  rowClassName?: string;
  /** Loading overlay */
  loading?: boolean;
}

// =============================================================================
// INBOX LIST
// =============================================================================

export default function InboxList<T>({
  title,
  data,
  columns,
  getRowKey,
  onRowClick,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  page = 1,
  totalPages = 1,
  total = 0,
  pageSize = 12,
  onPageChange,
  toolbar,
  filterArea,
  emptyIcon,
  emptyTitle = 'No items found',
  rowClassName,
  emptyDescription = 'Try adjusting your filters',
  loading = false,
}: InboxListProps<T>) {
  const rangeStart = Math.min((page - 1) * pageSize + 1, total);
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col h-full">
      {/* Header: Title + Search + Filters (hidden when empty) */}
      {(title || onSearchChange || toolbar) && <div className="flex items-center gap-4 px-4 py-3">
        {/* Title with dropdown chevron */}
        {title && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        {onSearchChange && (
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-10 py-1.5 text-sm rounded-lg bg-gray-100 border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder-gray-400"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">⌘K</kbd>
          </div>
        )}

        {/* Extra toolbar (filter buttons, add button, etc.) */}
        {toolbar}
      </div>}

      {/* Filter area */}
      {filterArea}

      {/* List */}
      <div className="relative flex-1">
        {/* Loading overlay */}
        {loading && data.length > 0 && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Column headers */}
        {data.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50/50">
            {columns.map((col) => (
              <div
                key={col.key}
                className={`${
                  col.width ? `${col.width} flex-shrink-0` : 'flex-1 min-w-0'
                } ${col.align === 'right' ? 'text-right' : ''} text-xs font-medium text-gray-500 uppercase tracking-wider`}
              >
                {col.header}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && data.length === 0 ? (
          <div className="text-center py-20">
            {emptyIcon && <div className="flex justify-center mb-3">{emptyIcon}</div>}
            <p className="text-gray-600 font-medium">{emptyTitle}</p>
            <p className="text-gray-600 text-sm mt-1">{emptyDescription}</p>
          </div>
        ) : (
          /* Rows */
          data.map((item) => (
            <div
              key={getRowKey(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-[900ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.03] hover:-translate-y-[3px] hover:shadow-[0_12px_35px_rgba(0,0,0,0.12)] hover:z-10 relative rounded-lg hover:bg-white ${rowClassName || ''}`}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  className={`${
                    col.width ? `${col.width} flex-shrink-0` : 'flex-1 min-w-0'
                  } ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.render(item)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pagination row — below the table */}
      {total > 0 && (
        <div className="flex items-center justify-start px-4 py-1.5 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">
              {rangeStart} to {rangeEnd} from {total}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onPageChange?.(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1 rounded text-gray-600 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded text-gray-600 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/** Colored tag/pill — pass a color variant */
const TAG_COLORS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
  purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  gray: 'bg-gray-100 text-gray-500',
  muted: 'bg-gray-100 text-gray-600 italic',
};

export function InboxTag({ children, color = 'gray' }: { children: ReactNode; color?: string }) {
  const cls = TAG_COLORS[color] || TAG_COLORS.gray;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

/** Status badge with auto color */
const STATUS_MAP: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'Active' },
  INACTIVE: { color: 'gray', label: 'Inactive' },
  SUSPENDED: { color: 'amber', label: 'Suspended' },
  ARCHIVED: { color: 'red', label: 'Archived' },
  PENDING_APPROVAL: { color: 'blue', label: 'Pending' },
  DRAFT: { color: 'gray', label: 'Draft' },
};

export function InboxStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { color: 'gray', label: status };
  return <InboxTag color={s.color}>{s.label}</InboxTag>;
}

/** Round avatar with first letter fallback */
export function InboxAvatar({ name, url, size = 'w-8 h-8' }: { name: string; url?: string; size?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${size} rounded-full object-cover`} />;
  }
  const letter = (name[0] || '?').toUpperCase();
  return (
    <div className={`${size} rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0`}>
      <span className="text-xs font-semibold text-emerald-700">{letter}</span>
    </div>
  );
}

/** Loading skeleton for inbox list */
export function InboxSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="h-6 bg-gray-100 rounded w-32" />
        <div className="flex-1" />
        <div className="h-8 bg-gray-100 rounded-lg w-48" />
      </div>
      <div className="px-4 py-1.5 border-b border-gray-100">
        <div className="h-4 bg-gray-50 rounded w-32 ml-auto" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
          <div className="w-8 h-8 bg-gray-100 rounded-full" />
          <div className="h-4 bg-gray-100 rounded w-40" />
          <div className="h-4 bg-gray-50 rounded w-16" />
          <div className="flex-1 h-4 bg-gray-50 rounded" />
          <div className="h-4 bg-gray-50 rounded w-12" />
        </div>
      ))}
    </div>
  );
}
