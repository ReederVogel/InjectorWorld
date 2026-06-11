export type Tier = 'free' | 'starter' | 'pro' | 'elite'
export type AnalyticsLevel = 'none' | 'basic' | 'full'

export interface TierLimits {
  maxPhotos: number
  socialLinks: boolean
  beforeAfterGallery: boolean
  video: boolean
  analytics: AnalyticsLevel
  adFreeProfile: boolean
  multiLocation: boolean
}

export const TIER_FEATURES: Record<Tier, TierLimits> = {
  free:    { maxPhotos: 1,        socialLinks: false, beforeAfterGallery: false, video: false, analytics: 'none',  adFreeProfile: false, multiLocation: false },
  starter: { maxPhotos: 5,        socialLinks: true,  beforeAfterGallery: false, video: false, analytics: 'none',  adFreeProfile: false, multiLocation: false },
  pro:     { maxPhotos: 15,       socialLinks: true,  beforeAfterGallery: true,  video: true,  analytics: 'basic', adFreeProfile: true,  multiLocation: false },
  elite:   { maxPhotos: Infinity, socialLinks: true,  beforeAfterGallery: true,  video: true,  analytics: 'full',  adFreeProfile: true,  multiLocation: true  },
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
