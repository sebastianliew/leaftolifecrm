"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  EditorialPage,
  EditorialPageSkeleton,
  EditorialErrorScreen,
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSection,
  EditorialPill,
} from "@/components/ui/editorial"

interface DashboardStats {
  totalProducts?: number
  productGrowth?: number
  activePatients?: number
  patientGrowth?: number
  expiredProducts?: number
  expiringSoonProducts?: number
  totalValue?: number
}

type IndexItem = {
  href: string
  label: string
  hint: string
  roles?: ReadonlyArray<string>
}

type IndexSection = {
  heading: string
  items: ReadonlyArray<IndexItem>
}

const INDEX: ReadonlyArray<IndexSection> = [
  {
    heading: "Materia medica",
    items: [
      { href: "/inventory", label: "View the dispensary", hint: "every tincture, herb & blend" },
      { href: "/inventory", label: "Receive a new product", hint: "log incoming stock" },
      { href: "/inventory", label: "Search the cabinet", hint: "by name, batch or supplier" },
      { href: "/blend-templates", label: "Blend templates", hint: "house formulas" },
      { href: "/reports", label: "Inventory reports", hint: "movement & valuation", roles: ["super_admin", "admin", "manager"] },
    ],
  },
  {
    heading: "Practice & people",
    items: [
      { href: "/patients", label: "Patient register", hint: "active records" },
      { href: "/patients", label: "Open a consultation", hint: "begin a new note" },
      { href: "/dashboard/appointments", label: "Today's appointments", hint: "the day's roster" },
      { href: "/appointments", label: "Schedule a visit", hint: "book new" },
    ],
  },
  {
    heading: "Counter & ledger",
    items: [
      { href: "/transactions", label: "Sales journal", hint: "all transactions" },
      { href: "/transactions", label: "Ring a sale", hint: "new transaction" },
      { href: "/refunds", label: "Refunds & returns", hint: "ledger reversals" },
      { href: "/suppliers", label: "Suppliers", hint: "trade partners" },
      { href: "/brands", label: "Brand directory", hint: "labels we stock" },
    ],
  },
  {
    heading: "House & settings",
    items: [
      { href: "/settings/consultation", label: "Consultation settings", hint: "fees & defaults" },
      { href: "/users", label: "Practitioners & staff", hint: "roles & access", roles: ["super_admin", "admin"] },
      { href: "/profile", label: "Your profile", hint: "personal record" },
      { href: "/history", label: "Activity log", hint: "what happened, when" },
    ],
  },
]

function useNow() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function greeting(d: Date | null) {
  if (!d) return "Welcome"
  const h = d.getHours()
  if (h < 5) return "Still up"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 21) return "Good evening"
  return "Working late"
}

function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ""
  const map: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ]
  let out = ""
  let v = Math.floor(n)
  for (const [k, s] of map) {
    while (v >= k) { out += s; v -= k }
  }
  return out
}

const ROMAN_NUMERALS = ['i.', 'ii.', 'iii.', 'iv.']

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const now = useNow()

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const r = await fetch("/api/dashboard/stats")
        if (r.ok) {
          const data = await r.json()
          if (!cancelled) setStats(data)
        }
      } catch {
        // silent — UI shows dashes
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const expiringTotal = (stats?.expiredProducts ?? 0) + (stats?.expiringSoonProducts ?? 0)

  const role = user?.role
  const visibleSections = useMemo(() => {
    return INDEX.map(s => ({
      ...s,
      items: s.items.filter(i => !i.roles || (role && i.roles.includes(role))),
    })).filter(s => s.items.length > 0)
  }, [role])

  const issueNumber = useMemo(() => {
    if (!now) return ""
    const start = new Date("2022-01-01T00:00:00Z").getTime()
    const diff = now.getTime() - start
    const days = Math.max(1, Math.floor(diff / 86_400_000))
    return toRoman(days)
  }, [now])

  if (authLoading) return <EditorialPageSkeleton />

  if (!isAuthenticated || !user) {
    return (
      <EditorialErrorScreen
        title="Sign in to consult the daybook."
        description="This page is only visible to authenticated practitioners."
        onRetry={() => (window.location.href = "/login")}
      />
    )
  }

  const firstName = user?.name?.split(" ")[0] || user?.username || "Practitioner"
  const longDate = now
    ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : ""
  const time = now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"
  const fmtMoney = (n: number) =>
    n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <EditorialPage>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-[#6B7280] mb-2">
        <span>
          The Daybook{issueNumber && <> · No. {issueNumber}</>}
        </span>
        <span suppressHydrationWarning>
          {time} <span className="text-[#D1D5DB] mx-2">·</span> {longDate}
        </span>
      </div>

      <EditorialMasthead
        kicker={greeting(now)}
        title={firstName}
        subtitle={
          <>
            A quiet round through the dispensary &amp; the day&rsquo;s register.
            {role === "super_admin" && (
              <span className="ml-3"><EditorialPill tone="warning">Super admin</EditorialPill></span>
            )}
            {role === "admin" && (
              <span className="ml-3"><EditorialPill>Admin</EditorialPill></span>
            )}
          </>
        }
      />

      {role !== "staff" && (
        <EditorialStats>
          <EditorialStat
            index="i."
            label="On the shelves"
            value={loading ? "…" : (stats?.totalProducts ?? 0).toLocaleString("en-GB")}
            caption={
              loading
                ? 'tallying'
                : stats?.productGrowth !== undefined
                  ? `${stats.productGrowth >= 0 ? '↑' : '↓'} ${Math.abs(stats.productGrowth)}% vs last moon`
                  : 'no comparison yet'
            }
          />
          <EditorialStat
            index="ii."
            label="Patients in care"
            value={loading ? "…" : (stats?.activePatients ?? 0).toLocaleString("en-GB")}
            caption={
              loading
                ? 'tallying'
                : stats?.patientGrowth !== undefined
                  ? `${stats.patientGrowth >= 0 ? '↑' : '↓'} ${Math.abs(stats.patientGrowth)}% vs last moon`
                  : 'no comparison yet'
            }
          />
          <EditorialStat
            index="iii."
            label="Asking after the apothecary"
            value={loading ? "…" : expiringTotal.toString()}
            caption={
              loading
                ? 'tallying'
                : expiringTotal > 0
                  ? `${stats?.expiredProducts ?? 0} expired · ${stats?.expiringSoonProducts ?? 0} soon`
                  : 'all is well stocked'
            }
            tone={expiringTotal > 0 ? 'warning' : 'ink'}
          />
          <EditorialStat
            index="iv."
            label="Worth on hand"
            value={loading ? "…" : `$${fmtMoney(stats?.totalValue ?? 0)}`}
            caption="cost-priced, positive stock"
          />
        </EditorialStats>
      )}

      <EditorialSection
        title="An index of things one might do today"
        description="Filed by department · numbered as one finds them in the cabinet."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {visibleSections.map((section, sIdx) => (
            <div key={section.heading}>
              <div className="flex items-center gap-3 pb-3 border-b border-[#0A0A0A] mb-4">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">
                  {ROMAN_NUMERALS[sIdx] || `${sIdx + 1}.`}
                </span>
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#0A0A0A]">{section.heading}</span>
              </div>
              <ul className="space-y-1">
                {section.items.map((item, iIdx) => (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      className="group flex items-baseline gap-3 py-2 hover:bg-[#FAFAFA] transition-colors"
                    >
                      <span className="text-[10px] tabular-nums text-[#9CA3AF] w-6 shrink-0">
                        {String(iIdx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[14px] text-[#0A0A0A]">{item.label}</span>
                      <span className="flex-1 border-b border-dotted border-[#E5E7EB] mb-1 mx-2" aria-hidden="true" />
                      <span className="text-[11px] italic font-light text-[#6B7280] shrink-0">{item.hint}</span>
                      <span className="text-base normal-case tracking-normal text-[#9CA3AF] group-hover:text-[#0A0A0A] group-hover:translate-x-0.5 transition-all">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </EditorialSection>

      <footer className="mt-12 pt-6 border-t border-[#E5E7EB] text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">
        <p className="text-center">
          Signed in as {user?.username || user?.email || "—"}
        </p>
      </footer>
    </EditorialPage>
  )
}
