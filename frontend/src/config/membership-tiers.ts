/** Membership tier configuration — single source of truth. */

export type MembershipTier = 'standard' | 'silver' | 'gold' | 'vip' | 'platinum'

export const TIER_CONFIG: Record<MembershipTier, { discount: number; color: string; label: string }> = {
  standard: { discount: 0, color: 'bg-gray-100 text-gray-800', label: 'Standard (0%)' },
  silver:   { discount: 10, color: 'bg-slate-200 text-slate-800', label: 'Silver (10%)' },
  gold:     { discount: 20, color: 'bg-amber-100 text-amber-800', label: 'Gold (20%)' },
  vip:      { discount: 20, color: 'bg-purple-100 text-purple-800', label: 'VIP (20%)' },
  platinum: { discount: 40, color: 'bg-indigo-100 text-indigo-800', label: 'Platinum (40%)' },
}

export const TIER_DISCOUNTS: Record<MembershipTier, number> = Object.fromEntries(
  Object.entries(TIER_CONFIG).map(([k, v]) => [k, v.discount])
) as Record<MembershipTier, number>

export const TIER_COLORS: Record<MembershipTier, string> = Object.fromEntries(
  Object.entries(TIER_CONFIG).map(([k, v]) => [k, v.color])
) as Record<MembershipTier, string>

export const ALL_TIERS = Object.keys(TIER_CONFIG) as MembershipTier[]
