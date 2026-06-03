import type { MetadataRoute } from 'next'
import { getAllGuideSlugs } from '@/lib/guide-queries'
import { getAllProviderSlugs } from '@/lib/provider-queries'
import { getAllClinicSlugs } from '@/lib/clinic-queries'
import { getAllTreatmentSlugs, getAllStateSlugs, getAllCitySlugs } from '@/lib/location-queries'
import { bodyAreas } from '@/lib/body-areas-data'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function url(path: string): string {
  return `${siteUrl}${path}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [guideSlugs, providerSlugs, clinicSlugs, treatmentSlugs, stateSlugs, citySlugs] =
    await Promise.all([
      getAllGuideSlugs().catch(() => [] as string[]),
      getAllProviderSlugs().catch(() => [] as string[]),
      getAllClinicSlugs().catch(() => [] as string[]),
      getAllTreatmentSlugs().catch(() => [] as string[]),
      getAllStateSlugs().catch(() => [] as string[]),
      getAllCitySlugs().catch(() => [] as string[]),
    ])

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: url('/injectors'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: url('/clinics'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/guides'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
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

  // Provider profiles
  const providerPages: MetadataRoute.Sitemap = providerSlugs.map((s) => ({
    url: url(`/injectors/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Clinic profiles
  const clinicPages: MetadataRoute.Sitemap = clinicSlugs.map((s) => ({
    url: url(`/clinics/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Treatment pillars
  const treatmentPages: MetadataRoute.Sitemap = treatmentSlugs.map((s) => ({
    url: url(`/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // State hubs
  const statePages: MetadataRoute.Sitemap = stateSlugs.map((s) => ({
    url: url(`/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // City hubs
  const cityHubPages: MetadataRoute.Sitemap = citySlugs.map((s) => ({
    url: url(`/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Treatment + city money pages (top treatments × all cities)
  const TOP_TREATMENTS = ['botox', 'lip-filler', 'masseter-botox', 'tear-trough', 'cheek-filler', 'jawline-filler']
  const moneyPages: MetadataRoute.Sitemap = TOP_TREATMENTS.flatMap((t) =>
    citySlugs.map((c) => ({
      url: url(`/${t}/${c}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  )

  // Treatment + state pages
  const treatmentStatePages: MetadataRoute.Sitemap = TOP_TREATMENTS.flatMap((t) =>
    stateSlugs.map((s) => ({
      url: url(`/${t}/${s}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  )

  return [
    ...staticPages,
    ...bodyAreaPages,
    ...guidePages,
    ...providerPages,
    ...clinicPages,
    ...treatmentPages,
    ...statePages,
    ...cityHubPages,
    ...moneyPages,
    ...treatmentStatePages,
  ]
}
