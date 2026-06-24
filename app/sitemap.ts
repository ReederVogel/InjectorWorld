import type { MetadataRoute } from 'next'
import { getAllGuideSlugs } from '@/lib/guide-queries'
import { getAllNewsSlugs } from '@/lib/news-queries'
import { getAllProviderParams } from '@/lib/provider-queries'
import { getAllClinicParams } from '@/lib/clinic-queries'
import { getAllTreatmentSlugs, getAllStateSlugs, getAllStateCityPairs, getAllStateCityNeighborhoods } from '@/lib/location-queries'
import { bodyAreas } from '@/lib/body-areas-data'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function url(path: string): string {
  return `${siteUrl}${path}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [guideSlugs, newsSlugs, providerParams, clinicParams, treatmentSlugs, stateSlugs, stateCityPairs, stateCityHoods] =
    await Promise.all([
      getAllGuideSlugs().catch(() => [] as string[]),
      getAllNewsSlugs().catch(() => [] as string[]),
      getAllProviderParams().catch(() => [] as { state: string; city: string; slug: string }[]),
      getAllClinicParams().catch(() => [] as { state: string; city: string; slug: string }[]),
      getAllTreatmentSlugs().catch(() => [] as string[]),
      getAllStateSlugs().catch(() => [] as string[]),
      getAllStateCityPairs().catch(() => [] as { stateSlug: string; citySlug: string }[]),
      getAllStateCityNeighborhoods().catch(() => [] as { stateSlug: string; citySlug: string; neighborhoodSlug: string }[]),
    ])

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: url('/injectors'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: url('/clinics'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/services'), lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: url('/guides'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: url('/news'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/how-we-verify'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/editorial-standards'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/medical-advisory'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/list-your-practice'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: url('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: url('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: url('/hipaa'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Body area education pages
  const bodyAreaPages: MetadataRoute.Sitemap = bodyAreas.map((a) => ({
    url: url(`/treatments/${a.slug}`),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Guide pages
  const guidePages: MetadataRoute.Sitemap = guideSlugs.map((s) => ({
    url: url(`/guides/${s}`),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // News article pages
  const newsPages: MetadataRoute.Sitemap = newsSlugs.map((s) => ({
    url: url(`/news/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  // Provider profiles — /injectors/[state]/[city]/[slug]
  const providerPages: MetadataRoute.Sitemap = providerParams.map((p) => ({
    url: url(`/injectors/${p.state}/${p.city}/${p.slug}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Clinic profiles — /clinics/[state]/[city]/[slug]
  const clinicPages: MetadataRoute.Sitemap = clinicParams.map((c) => ({
    url: url(`/clinics/${c.state}/${c.city}/${c.slug}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Service pillars — /services/[service]
  const servicePillarPages: MetadataRoute.Sitemap = treatmentSlugs.map((s) => ({
    url: url(`/services/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Service + state pages — /services/[service]/[state]
  const serviceStatePages: MetadataRoute.Sitemap = treatmentSlugs.flatMap((t) =>
    stateSlugs.map((s) => ({
      url: url(`/services/${t}/${s}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  )

  // Service + city money pages — /services/[service]/[state]/[city]
  const serviceMoneyPages: MetadataRoute.Sitemap = treatmentSlugs.flatMap((t) =>
    stateCityPairs.map(({ stateSlug, citySlug }) => ({
      url: url(`/services/${t}/${stateSlug}/${citySlug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  )

  // Service + neighborhood pages — /services/[service]/[state]/[city]/[hood]
  const serviceNeighborhoodPages: MetadataRoute.Sitemap = treatmentSlugs.flatMap((t) =>
    stateCityHoods.map(({ stateSlug, citySlug, neighborhoodSlug }) => ({
      url: url(`/services/${t}/${stateSlug}/${citySlug}/${neighborhoodSlug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  )

  // State hubs — /[state]  (Find path)
  const statePages: MetadataRoute.Sitemap = stateSlugs.map((s) => ({
    url: url(`/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // City hubs — /[state]/[city]  (Find path)
  const cityHubPages: MetadataRoute.Sitemap = stateCityPairs.map(({ stateSlug, citySlug }) => ({
    url: url(`/${stateSlug}/${citySlug}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    ...staticPages,
    ...bodyAreaPages,
    ...guidePages,
    ...newsPages,
    ...providerPages,
    ...clinicPages,
    ...servicePillarPages,
    ...serviceStatePages,
    ...serviceMoneyPages,
    ...serviceNeighborhoodPages,
    ...statePages,
    ...cityHubPages,
  ]
}
