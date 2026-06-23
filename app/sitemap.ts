import type { MetadataRoute } from 'next'
import { getAllGuideSlugs } from '@/lib/guide-queries'
import { getAllNewsSlugs } from '@/lib/news-queries'
import { getAllProviderParams } from '@/lib/provider-queries'
import { getAllClinicParams } from '@/lib/clinic-queries'
import { getAllTreatmentSlugs, getAllStateSlugs, getAllStateCityPairs } from '@/lib/location-queries'
import { bodyAreas } from '@/lib/body-areas-data'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function url(path: string): string {
  return `${siteUrl}${path}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [guideSlugs, newsSlugs, providerParams, clinicParams, treatmentSlugs, stateSlugs, stateCityPairs] =
    await Promise.all([
      getAllGuideSlugs().catch(() => [] as string[]),
      getAllNewsSlugs().catch(() => [] as string[]),
      getAllProviderParams().catch(() => [] as { state: string; city: string; slug: string }[]),
      getAllClinicParams().catch(() => [] as { state: string; city: string; slug: string }[]),
      getAllTreatmentSlugs().catch(() => [] as string[]),
      getAllStateSlugs().catch(() => [] as string[]),
      getAllStateCityPairs().catch(() => [] as { stateSlug: string; citySlug: string }[]),
    ])

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: url('/injectors'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: url('/clinics'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
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

  // Treatment pillars — /[treatment]
  const treatmentPages: MetadataRoute.Sitemap = treatmentSlugs.map((s) => ({
    url: url(`/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // State hubs — /[state]
  const statePages: MetadataRoute.Sitemap = stateSlugs.map((s) => ({
    url: url(`/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // City hubs — /[state]/[city]
  const cityHubPages: MetadataRoute.Sitemap = stateCityPairs.map(({ stateSlug, citySlug }) => ({
    url: url(`/${stateSlug}/${citySlug}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Treatment + state pages — /[treatment]/[state]
  const treatmentStatePages: MetadataRoute.Sitemap = treatmentSlugs.flatMap((t) =>
    stateSlugs.map((s) => ({
      url: url(`/${t}/${s}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  )

  // Treatment + city money pages — /[treatment]/[state]/[city]
  const TOP_TREATMENTS = ['botox', 'lip-filler', 'masseter-botox', 'tear-trough', 'cheek-filler', 'jawline-filler']
  const moneyPages: MetadataRoute.Sitemap = TOP_TREATMENTS.flatMap((t) =>
    stateCityPairs.map(({ stateSlug, citySlug }) => ({
      url: url(`/${t}/${stateSlug}/${citySlug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  )

  return [
    ...staticPages,
    ...bodyAreaPages,
    ...guidePages,
    ...newsPages,
    ...providerPages,
    ...clinicPages,
    ...treatmentPages,
    ...statePages,
    ...cityHubPages,
    ...treatmentStatePages,
    ...moneyPages,
  ]
}
