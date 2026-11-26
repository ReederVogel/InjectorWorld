export type Tier = 'free' | 'starter' | 'pro' | 'elite'
export type AnalyticsLevel = 'none' | 'basic' | 'full'

export interface TierLimits {
  maxPhotos: number
  socialLinks: boolean
  beforeAfterGallery: boolean
  video: boolean
  analytics: AnalyticsLevel
  adFreeProfile: boolean
  /** Lead status changes and CSV export in the dashboard. */
  leadTools: boolean
}

// Several locations on one login is free for every owner (lib/owned-clinics.ts), so it is not a tier feature.
export const TIER_FEATURES: Record<Tier, TierLimits> = {
  free:    { maxPhotos: 1,        socialLinks: false, beforeAfterGallery: false, video: false, analytics: 'none',  adFreeProfile: false, leadTools: false },
  starter: { maxPhotos: 5,        socialLinks: true,  beforeAfterGallery: false, video: false, analytics: 'none',  adFreeProfile: false, leadTools: false },
  pro:     { maxPhotos: 15,       socialLinks: true,  beforeAfterGallery: true,  video: true,  analytics: 'basic', adFreeProfile: true,  leadTools: true  },
  elite:   { maxPhotos: 999,      socialLinks: true,  beforeAfterGallery: true,  video: true,  analytics: 'full',  adFreeProfile: true,  leadTools: true  },
}

/** Days of numbers each analytics level shows in the dashboard. */
export const ANALYTICS_DAYS: Record<AnalyticsLevel, number> = { none: 0, basic: 30, full: 90 }

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled'

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: 'Not active yet',
  active: 'Active',
  past_due: 'Payment past due',
  canceled: 'Canceled',
}

/**
 * The tier a clinic actually gets. Paid features run only while billing is
 * active; a paid tier with any other status works as Free until it is sorted.
 */
export function effectiveTier(clinic: { subscriptionTier?: string | null; subscriptionStatus?: string | null }): Tier {
  const tier = clinic.subscriptionTier as Tier
  return clinic.subscriptionStatus === 'active' && TIER_ORDER.includes(tier) ? tier : 'free'
}

export const TIER_PRICES: Record<Tier, number> = {
  free: 0,
  starter: 99,
  pro: 249,
  elite: 499,
}

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
}

export const TIER_ORDER: Tier[] = ['free', 'starter', 'pro', 'elite']

export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier)
}

export function atLeast(tier: Tier, minTier: Tier): boolean {
  return tierRank(tier) >= tierRank(minTier)
}

export function can(tier: Tier, feature: keyof Omit<TierLimits, 'maxPhotos' | 'analytics'>): boolean {
  return TIER_FEATURES[tier][feature] as boolean
}

export function limits(tier: Tier): TierLimits {
  return TIER_FEATURES[tier]
}

export function analyticsLevel(tier: Tier): AnalyticsLevel {
  return TIER_FEATURES[tier].analytics
}

export function minTierFor(feature: keyof Omit<TierLimits, 'maxPhotos' | 'analytics'>): Tier {
  return TIER_ORDER.find((t) => TIER_FEATURES[t][feature]) ?? 'elite'
}
