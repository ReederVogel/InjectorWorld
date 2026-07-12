// Shared response shapes for the admin analytics endpoints. Kept in one
// place so the dashboard container and its panels agree on field names.

export type SummaryResponse = {
  from: string
  to: string
  days: number
  series: { day: string; pageviews: number; visitors: number }[]
  totals: { pageviews: number; visitors: number; clinicViews: number; leads: number }
  todaySoFar: { pageviews: number; visitors: number }
  eventsByType: { type: string; count: number }[]
}

export type TopClinicRow = {
  id: number
  name: string
  city: string | null
  state: string | null
  views: number
  leads: number
}

export type TopResponse = {
  from: string
  to: string
  days: number
  topPaths: { path: string; views: number }[]
  topClinics: TopClinicRow[]
  visitorsByState: { state: string; visitors: number }[]
  visitorsByDevice: { device: string; visitors: number }[]
  topReferrers: { host: string; views: number }[]
}

export type FunnelResponse = {
  from: string
  to: string
  days: number
  sessions: {
    total: number
    clinicView: number
    bookingOpen: number
    bookingSubmit: number
    contactReveal: number
  }
}

export type ClinicAnalyticsResponse = {
  from: string
  to: string
  days: number
  clinicId: number
  series: { day: string; views: number }[]
  viewsTotal: number
  leads: number
  bookingOpen: number
  bookingSubmit: number
  contactReveal: number
}

export type RangeDays = 7 | 30 | 90
