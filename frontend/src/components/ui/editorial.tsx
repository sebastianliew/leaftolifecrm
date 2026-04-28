"use client"

import * as React from "react"
import { useState, useRef, memo } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { HiMagnifyingGlass, HiChevronUp, HiChevronDown } from "react-icons/hi2"
import { cn } from "@/lib/utils"

/**
 * Editorial design system — extracted from /inventory page.
 * Poppins typography, no border-radius, kicker-style labels,
 * borderless underlined inputs, light-weight headlines.
 *
 * Use <EditorialPage> as the outermost wrapper on any list page.
 */

export function EditorialFontStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
      .editorial-page { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; color: #0A0A0A; }
      .editorial-page input::-webkit-outer-spin-button,
      .editorial-page input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .editorial-page input[type=number] { -moz-appearance: textfield; }
      @keyframes editorialRise {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .editorial-rise > * { animation: editorialRise 480ms cubic-bezier(0.2, 0.7, 0.1, 1) both; }
      .editorial-rise > *:nth-child(1) { animation-delay: 30ms; }
      .editorial-rise > *:nth-child(2) { animation-delay: 90ms; }
      .editorial-rise > *:nth-child(3) { animation-delay: 150ms; }
      .editorial-rise > *:nth-child(4) { animation-delay: 210ms; }
      .editorial-rise > *:nth-child(5) { animation-delay: 270ms; }
      .editorial-rise > *:nth-child(6) { animation-delay: 330ms; }
    `}</style>
  )
}

export function EditorialPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("editorial-page bg-white min-h-screen", className)}>
      <EditorialFontStyle />
      <div className="px-12 pt-12 pb-20 editorial-rise">{children}</div>
    </div>
  )
}

export function EditorialMasthead({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex items-end justify-between border-b border-[#E5E7EB] pb-8 gap-6 flex-wrap">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">{kicker}</p>
        <h1 className="font-light text-[48px] leading-[1] mt-3 text-[#0A0A0A]">{title}</h1>
        {subtitle && <p className="text-sm text-[#6B7280] mt-3 italic font-light">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-7 flex-wrap">{children}</div>}
    </header>
  )
}

export function EditorialKicker({ children, className, tone = "muted" }: { children: React.ReactNode; className?: string; tone?: "muted" | "ink" | "danger" | "warning" | "ok" }) {
  const colorMap = {
    muted: "text-[#6B7280]",
    ink: "text-[#0A0A0A]",
    danger: "text-[#DC2626]",
    warning: "text-[#EA580C]",
    ok: "text-[#16A34A]",
  }
  return <p className={cn("text-[10px] uppercase tracking-[0.4em]", colorMap[tone], className)}>{children}</p>
}

/**
 * Stats grid — 4 columns of headline numerics with kicker labels.
 */
export function EditorialStats({ children, columns = 4, className }: { children: React.ReactNode; columns?: 2 | 3 | 4; className?: string }) {
  const colMap = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" } as const
  return (
    <section className={cn("grid gap-10 border-b border-[#E5E7EB] py-8", colMap[columns], className)}>
      {children}
    </section>
  )
}

interface EditorialStatProps {
  index?: string // "i.", "ii.", etc.
  label: string
  value: React.ReactNode
  caption?: React.ReactNode
  tone?: "ink" | "danger" | "warning" | "ok"
  active?: boolean
  onClick?: () => void
  title?: string
}

export function EditorialStat({ index, label, value, caption, tone = "ink", active, onClick, title }: EditorialStatProps) {
  const valueColorMap = {
    ink: "text-[#0A0A0A]",
    danger: "text-[#DC2626]",
    warning: "text-[#EA580C]",
    ok: "text-[#16A34A]",
  }
  const labelActive = {
    ink: "text-[#0A0A0A]",
    danger: "text-[#DC2626]",
    warning: "text-[#EA580C]",
    ok: "text-[#16A34A]",
  }
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn("text-left", onClick && "group")}
    >
      <p
        className={cn(
          "text-[10px] uppercase tracking-[0.32em] transition-colors",
          active ? labelActive[tone] : "text-[#6B7280]",
          onClick && !active && "group-hover:text-[#0A0A0A]"
        )}
      >
        {index ? `${index} ${label}` : label}
      </p>
      <p className={cn("font-light text-[44px] leading-none tabular-nums mt-3", valueColorMap[tone])}>{value}</p>
      {caption && <p className="text-xs text-[#6B7280] mt-2 italic font-light">{caption}</p>}
    </Tag>
  )
}

/**
 * Debounced search input. Self-contained — typing here does not re-render
 * the parent page. Calls onSearch after 400ms of inactivity.
 */
export const EditorialSearch = memo(function EditorialSearch({
  onSearch,
  placeholder = "Search...",
  width = "w-72",
  initialValue = "",
}: {
  onSearch: (term: string) => void
  placeholder?: string
  width?: string
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearch(newValue), 400)
  }

  return (
    <div className={cn("relative", width)}>
      <HiMagnifyingGlass className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280]" />
      <input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 pl-6 pr-2 py-2 text-sm text-[#0A0A0A] placeholder:text-[#9CA3AF] transition-colors"
      />
    </div>
  )
})

interface EditorialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "ghost-active" | "danger-ghost"
  arrow?: boolean | "left" | "right"
  icon?: React.ReactNode
}

export function EditorialButton({
  children,
  variant = "ghost",
  arrow = false,
  icon,
  className,
  ...props
}: EditorialButtonProps) {
  const variantClasses = {
    primary:
      "group inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-7 py-2.5 hover:bg-black disabled:bg-[#9CA3AF] disabled:cursor-not-allowed",
    ghost: "text-[#6B7280] hover:text-[#0A0A0A] py-2 inline-flex items-center gap-2",
    "ghost-active": "text-[#0A0A0A] border-b border-[#0A0A0A] py-2 inline-flex items-center gap-2",
    "danger-ghost": "text-[#FCA5A5] hover:text-white inline-flex items-center gap-2",
  }
  const arrowEl =
    arrow === true || arrow === "right" ? (
      <span className="text-base normal-case tracking-normal opacity-80 group-hover:translate-x-0.5 transition-transform">
        →
      </span>
    ) : arrow === "left" ? (
      <span className="text-base normal-case tracking-normal opacity-80 group-hover:-translate-x-0.5 transition-transform">
        ←
      </span>
    ) : null

  return (
    <button
      {...props}
      className={cn("text-[11px] uppercase tracking-[0.28em] transition-colors", variantClasses[variant], className)}
    >
      {arrow === "left" && arrowEl}
      {icon}
      {children}
      {(arrow === true || arrow === "right") && arrowEl}
    </button>
  )
}

/**
 * Bordered field — label kicker plus a borderless underlined select / input below.
 * Use this inside <EditorialFilterRow> or any filter grid.
 */
export function EditorialField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] mb-1">{label}</p>
      {children}
    </div>
  )
}

export function EditorialSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-sm text-[#0A0A0A] cursor-pointer",
        props.className
      )}
    />
  )
}

export function EditorialInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-sm text-[#0A0A0A] placeholder:text-[#9CA3AF] transition-colors",
        props.className
      )}
    />
  )
}

export function EditorialTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-sm text-[#0A0A0A] placeholder:text-[#9CA3AF] transition-colors resize-none",
        props.className
      )}
    />
  )
}

export function EditorialFilterRow({
  children,
  columns = 3,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  const colMap = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const
  return (
    <section className={cn("border-b border-[#E5E7EB] py-6 grid gap-10", colMap[columns], className)}>
      {children}
    </section>
  )
}

/**
 * Bulk action bar — sticky black strip when items are selected.
 */
export function EditorialBulkBar({
  count,
  children,
  label = "selected",
}: {
  count: number
  children?: React.ReactNode
  label?: string
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between bg-[#0A0A0A] text-white px-6 py-3 mt-6">
      <span className="text-[11px] uppercase tracking-[0.28em]">
        <span className="tabular-nums">{count}</span> {label}
      </span>
      <div className="flex items-center gap-6">{children}</div>
    </div>
  )
}

/**
 * Editorial table primitives. Use the native <table> with helper components for cell styling.
 */
export function EditorialTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mt-8", className)}>
      <table className="w-full">{children}</table>
    </section>
  )
}

export function EditorialTHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[#0A0A0A]">{children}</tr>
    </thead>
  )
}

interface EditorialThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center"
  sortKey?: string
  currentSort?: string
  currentOrder?: "asc" | "desc"
  onSort?: (key: string) => void
  children: React.ReactNode
}

export function EditorialTh({
  align = "left",
  sortKey,
  currentSort,
  currentOrder,
  onSort,
  children,
  className,
  ...rest
}: EditorialThProps) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
  const buttonAlignClass = align === "right" ? "justify-end w-full" : align === "center" ? "justify-center w-full" : ""
  const isSortable = !!sortKey && !!onSort
  const isActive = sortKey && currentSort === sortKey
  const sortIcon = isActive ? (
    currentOrder === "asc" ? <HiChevronUp className="w-3 h-3 ml-1" /> : <HiChevronDown className="w-3 h-3 ml-1" />
  ) : null

  return (
    <th
      {...rest}
      className={cn("py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]", alignClass, className)}
    >
      {isSortable ? (
        <button
          type="button"
          onClick={() => onSort!(sortKey!)}
          className={cn("flex items-center hover:text-[#0A0A0A] transition-colors", buttonAlignClass)}
        >
          {children} {sortIcon}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function EditorialTr({ children, className, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr {...rest} className={cn("border-b border-[#E5E7EB] hover:bg-[#FAFAFA] transition-colors group", className)}>
      {children}
    </tr>
  )
}

export function EditorialTd({
  children,
  className,
  align = "left",
  size = "sm",
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center"; size?: "sm" | "md" | "lg" }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
  const sizeClass = size === "lg" ? "text-[14px] text-[#0A0A0A]" : size === "md" ? "text-[13px] text-[#0A0A0A]" : "text-[12px] text-[#6B7280]"
  return (
    <td {...rest} className={cn("py-4", alignClass, sizeClass, className)}>
      {children}
    </td>
  )
}

/**
 * Empty state row, full-width caption beneath an editorial table.
 */
export function EditorialEmptyRow({
  colSpan,
  title = "Nothing to show",
  description = "No records match the current filters.",
}: {
  colSpan: number
  title?: string
  description?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-20">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">{title}</p>
        <p className="text-sm italic font-light text-[#6B7280] mt-3">{description}</p>
      </td>
    </tr>
  )
}

/**
 * Pagination — left side range + per-page select, right side prev/next nav.
 */
interface EditorialPaginationProps {
  total: number
  page: number
  limit: number
  pages: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  perPageOptions?: number[]
}

export function EditorialPagination({
  total,
  page,
  limit,
  pages,
  onPageChange,
  onLimitChange,
  perPageOptions = [20, 50, 100],
}: EditorialPaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  return (
    <div className="flex items-center justify-between mt-10 flex-wrap gap-6">
      <div className="flex items-center gap-8 flex-wrap">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">
          <span className="tabular-nums text-[#0A0A0A]">
            {start}–{end}
          </span>{" "}
          of <span className="tabular-nums text-[#0A0A0A]">{total}</span>
        </p>
        {onLimitChange && (
          <select
            value={limit.toString()}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 pb-1 text-[10px] uppercase tracking-[0.22em] text-[#6B7280] cursor-pointer"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-7">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <span className="text-base normal-case tracking-normal">←</span> Previous
          </button>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">
            Page <span className="tabular-nums text-[#0A0A0A]">{page}</span> of{" "}
            <span className="tabular-nums text-[#0A0A0A]">{pages}</span>
          </p>
          <button
            onClick={() => onPageChange(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            Next <span className="text-base normal-case tracking-normal">→</span>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Loading skeleton matching the masthead/stats/table cadence.
 */
export function EditorialPageSkeleton({ statColumns = 4, rows = 10 }: { statColumns?: number; rows?: number }) {
  return (
    <EditorialPage>
      <div className="animate-pulse">
        <div className="h-3 w-32 bg-[#E5E7EB] mb-4" />
        <div className="h-12 w-1/2 bg-[#E5E7EB] mb-12" />
        <div className={`grid grid-cols-${statColumns} gap-10 mb-12 border-y border-[#E5E7EB] py-8`}>
          {Array.from({ length: statColumns }).map((_, i) => (
            <div key={i}>
              <div className="h-2 w-16 bg-[#E5E7EB] mb-3" />
              <div className="h-10 w-20 bg-[#E5E7EB]" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-10 bg-[#F3F4F6]" />
          ))}
        </div>
      </div>
    </EditorialPage>
  )
}

/**
 * Page-level error banner.
 */
export function EditorialErrorScreen({ title = "Could not load.", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <EditorialPage>
      <div className="max-w-lg mx-auto mt-24">
        <EditorialKicker>Error</EditorialKicker>
        <h2 className="font-light text-[40px] leading-[1.05] mt-3 text-[#0A0A0A]">{title}</h2>
        {description && <p className="text-sm text-[#6B7280] mt-4 max-w-md">{description}</p>}
        {onRetry && (
          <EditorialButton variant="primary" arrow onClick={onRetry} className="mt-8">
            Retry
          </EditorialButton>
        )}
      </div>
    </EditorialPage>
  )
}

/**
 * Editorial dialog — same Poppins typography, no border-radius, masthead kicker style.
 * Use for create/edit/confirm/destructive modals.
 */
interface EditorialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kicker?: string
  kickerTone?: "muted" | "ink" | "danger" | "warning" | "ok"
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "2xl"
}

export function EditorialModal({
  open,
  onOpenChange,
  kicker,
  kickerTone = "muted",
  title,
  description,
  children,
  size = "md",
}: EditorialModalProps) {
  const sizeMap = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
    "2xl": "sm:max-w-6xl",
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] max-h-[90vh] overflow-y-auto",
          sizeMap[size]
        )}
        style={{ borderRadius: 0, fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif" }}
      >
        <div className="px-10 pt-10 pb-8">
          {kicker && <EditorialKicker tone={kickerTone}>{kicker}</EditorialKicker>}
          <DialogTitle asChild>
            <h2 className="font-light text-[32px] leading-[1.1] mt-3 text-[#0A0A0A]">{title}</h2>
          </DialogTitle>
          {description && (
            <DialogDescription asChild>
              <p className="text-sm text-[#6B7280] mt-3 italic font-light">{description}</p>
            </DialogDescription>
          )}
          <div className="mt-7">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Footer row inside an EditorialModal — secondary action on the left, primary on the right.
 */
export function EditorialModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-8 flex items-center justify-end gap-6 flex-wrap", className)}>{children}</div>
}

/**
 * Small typography helper for table cell secondary lines (e.g. SKU under product name).
 */
export function EditorialMeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] text-[#9CA3AF] mt-0.5", className)}>{children}</p>
}

/* ==========================================================================
 * Detail-page primitives — used on /transactions/[id], /patients/[id], etc.
 * Same vocabulary as the list pages: thin rules, kicker labels, light heads.
 * ========================================================================== */

/**
 * Editorial breadcrumb — one short kicker line "Section · Subsection · Item".
 * Use as the first child of <EditorialPage> on a detail screen.
 */
export function EditorialBreadcrumb({
  segments,
  className,
}: {
  segments: Array<{ label: string; href?: string }>
  className?: string
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6B7280]", className)}
    >
      {segments.map((seg, i) => (
        <React.Fragment key={`${seg.label}-${i}`}>
          {seg.href ? (
            <a href={seg.href} className="hover:text-[#0A0A0A] transition-colors">
              {seg.label}
            </a>
          ) : (
            <span className={cn(i === segments.length - 1 ? "text-[#0A0A0A]" : "")}>{seg.label}</span>
          )}
          {i < segments.length - 1 && <span className="text-[#D1D5DB]">·</span>}
        </React.Fragment>
      ))}
    </nav>
  )
}

/**
 * Detail-page section — kicker label above a content block, separated by a thin rule.
 * Roman numeral via `index` mirrors the EditorialStat numbering convention.
 */
export function EditorialSection({
  index,
  title,
  description,
  children,
  className,
  actions,
}: {
  index?: string
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}) {
  return (
    <section className={cn("border-b border-[#E5E7EB] py-10", className)}>
      <header className="flex items-end justify-between gap-6 flex-wrap mb-7">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">
            {index ? `${index} ${title}` : title}
          </p>
          {description && (
            <p className="text-sm text-[#6B7280] mt-2 italic font-light">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-4 flex-wrap">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

/**
 * Definition list / spec sheet — label-value pairs in an editorial layout.
 * `cols` controls how many columns the grid spreads across at md+.
 */
export function EditorialDefList({
  items,
  cols = 2,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode; tone?: "ink" | "muted" | "danger" | "warning" | "ok" }>
  cols?: 1 | 2 | 3 | 4
  className?: string
}) {
  const colMap = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" } as const
  const toneMap = {
    ink: "text-[#0A0A0A]",
    muted: "text-[#6B7280]",
    danger: "text-[#DC2626]",
    warning: "text-[#EA580C]",
    ok: "text-[#16A34A]",
  }
  return (
    <dl className={cn("grid grid-cols-1 gap-x-12 gap-y-6", colMap[cols], className)}>
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`}>
          <dt className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">{item.label}</dt>
          <dd className={cn("text-[14px] mt-1", toneMap[item.tone || "ink"])}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Single key-value pair when EditorialDefList is overkill.
 */
export function EditorialKeyValue({
  label,
  children,
  tone = "ink",
  className,
}: {
  label: string
  children: React.ReactNode
  tone?: "ink" | "muted" | "danger" | "warning" | "ok"
  className?: string
}) {
  const toneMap = {
    ink: "text-[#0A0A0A]",
    muted: "text-[#6B7280]",
    danger: "text-[#DC2626]",
    warning: "text-[#EA580C]",
    ok: "text-[#16A34A]",
  }
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">{label}</p>
      <p className={cn("text-[14px] mt-1", toneMap[tone])}>{children}</p>
    </div>
  )
}

/**
 * Sidebar action bar — flush-right vertical stack of actions.
 * Sits next to a detail's main column on wide screens, above the content on narrow.
 */
export function EditorialAside({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <aside
      className={cn(
        "border-l border-[#E5E7EB] pl-10 space-y-6 self-start sticky top-12",
        className
      )}
    >
      {children}
    </aside>
  )
}

/**
 * Two-column detail layout — main content + aside sidebar.
 * Stacks on narrow screens.
 */
export function EditorialSplit({
  main,
  aside,
  className,
}: {
  main: React.ReactNode
  aside: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12", className)}>
      <div>{main}</div>
      <div>{aside}</div>
    </div>
  )
}

/**
 * Editorial pill — small caps tracking label with optional tone color.
 * Replaces shadcn Badge in editorial layouts.
 */
export function EditorialPill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode
  tone?: "muted" | "ink" | "danger" | "warning" | "ok"
  className?: string
}) {
  const toneMap = {
    muted: "text-[#6B7280] border-[#E5E7EB]",
    ink: "text-[#0A0A0A] border-[#0A0A0A]",
    danger: "text-[#DC2626] border-[#DC2626]",
    warning: "text-[#EA580C] border-[#EA580C]",
    ok: "text-[#16A34A] border-[#16A34A]",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-[10px] uppercase tracking-[0.22em] border",
        toneMap[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * Note block — left-rule callout for non-critical context. Tone controls the rule color.
 */
export function EditorialNote({
  children,
  tone = "ink",
  kicker,
  className,
}: {
  children: React.ReactNode
  tone?: "ink" | "warning" | "danger" | "ok"
  kicker?: string
  className?: string
}) {
  const ruleMap = {
    ink: "border-[#0A0A0A] bg-[#FAFAFA]",
    warning: "border-[#EA580C] bg-[#FFF7ED]",
    danger: "border-[#DC2626] bg-[#FEF2F2]",
    ok: "border-[#16A34A] bg-[#F0FDF4]",
  }
  const kickerColor = {
    ink: "text-[#6B7280]",
    warning: "text-[#EA580C]",
    danger: "text-[#DC2626]",
    ok: "text-[#16A34A]",
  }
  return (
    <div className={cn("border-l-2 px-5 py-4", ruleMap[tone], className)}>
      {kicker && (
        <p className={cn("text-[10px] uppercase tracking-[0.4em] mb-2", kickerColor[tone])}>{kicker}</p>
      )}
      <div className="text-[13px] text-[#0A0A0A] leading-relaxed">{children}</div>
    </div>
  )
}

/**
 * Tab bar — underlined active tab in editorial style.
 */
export function EditorialTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn("flex border-b border-[#E5E7EB]", className)}>
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "py-3 mr-8 text-[11px] uppercase tracking-[0.28em] transition-colors",
              isActive
                ? "text-[#0A0A0A] border-b-2 border-[#0A0A0A] -mb-[1px]"
                : "text-[#6B7280] hover:text-[#0A0A0A]"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className="ml-2 tabular-nums normal-case tracking-normal text-[#9CA3AF]">
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

