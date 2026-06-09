import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveRoute, getAllRoutePaths } from '@/lib/route-resolver'
import {
  getCityDirectory, getTreatmentPillar, getTreatmentState,
  getNeighborhoodDirectory, getStateHub, getCityHub,
} from '@/lib/location-queries'
import { getPromotions, getActiveBanner, getOrganicPins } from '@/lib/promotion-queries'
import { applyMeritOrder } from '@/lib/merit'
import { isMarketNoindex, NOINDEX_ROBOTS } from '@/lib/markets'
import { CityDirectoryPage } from '@/components/pages/CityDirectoryPage'
import { TreatmentPillarPage } from '@/components/pages/TreatmentPillarPage'
import { TreatmentStatePage } from '@/components/pages/TreatmentStatePage'
import { NeighborhoodPage } from '@/components/pages/NeighborhoodPage'
import { StateHubPage } from '@/components/pages/StateHubPage'
import { CityHubPage } from '@/components/pages/CityHubPage'

export const revalidate = 300

export async function generateStaticParams() {
  try {
    const paths = await getAllRoutePaths()
    return paths.map((p) => ({ path: p }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>
}): Promise<Metadata> {
  const { path } = await params
  const resolved = await resolveRoute(path)
  const siteUrl = 'https://injector.world'

  if (resolved.type === 'city-directory') {
    const data = await getCityDirectory(resolved.treatmentSlug, resolved.citySlug)
    if (!data) return {}
    const city = data.city.name.replace(/\s+city$/i, '')
    const title = `${data.treatment.name} in ${city}, ${data.city.stateCode}`
    const desc = `Find ${data.providers.length > 0 ? data.providers.length + ' ' : ''}verified ${data.treatment.name} providers in ${city}. License-checked, patient-reviewed.`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/${resolved.treatmentSlug}/${resolved.citySlug}` },
      openGraph: { title, description: desc, url: `${siteUrl}/${resolved.treatmentSlug}/${resolved.citySlug}` },
      ...(isMarketNoindex(data.city) ? { robots: NOINDEX_ROBOTS } : {}),
    }
  }

  if (resolved.type === 'state-hub') {
    const data = await getStateHub(resolved.stateSlug)
    if (!data) return {}
    const title = `Verified Injectors in ${data.state.name}`
    const desc = `Browse license-verified Botox and aesthetic injectors across ${data.state.name}. Real patient reviews.`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/${resolved.stateSlug}` },
      ...(isMarketNoindex(data.state) ? { robots: NOINDEX_ROBOTS } : {}),
    }
  }

  if (resolved.type === 'city-hub') {
    const data = await getCityHub(resolved.citySlug)
    if (!data) return {}
    const cityDisplay = data.city.name.replace(/\s+city$/i, '')
    const title = `Aesthetic Injectors in ${cityDisplay}, ${data.city.stateCode}`
    const desc = `Browse ${data.treatments.length} treatments and verified aesthetic providers in ${cityDisplay}. Choose a treatment to see license-checked injectors near you.`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/${resolved.citySlug}` },
      ...(isMarketNoindex(data.city) ? { robots: NOINDEX_ROBOTS } : {}),
    }
  }

  if (resolved.type === 'treatment-pillar') {
    const data = await getTreatmentPillar(resolved.treatmentSlug)
    if (!data) return {}
    const title = `${data.treatment.name} Injectors`
    const desc = `Find verified ${data.treatment.name} providers across the US. ${data.treatment.tagline ?? ''}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc.trim(),
      alternates: { canonical: `${siteUrl}/${resolved.treatmentSlug}` },
    }
  }

  if (resolved.type === 'treatment-state') {
    const data = await getTreatmentState(resolved.treatmentSlug, resolved.stateSlug)
    if (!data) return {}
    const title = `${data.treatment.name} in ${data.state.name}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: `Find verified ${data.treatment.name} providers in ${data.state.name}. Browse by city.`,
      alternates: { canonical: `${siteUrl}/${resolved.treatmentSlug}/${resolved.stateSlug}` },
      ...(isMarketNoindex(data.state) ? { robots: NOINDEX_ROBOTS } : {}),
    }
  }

  if (resolved.type === 'neighborhood') {
    const data = await getNeighborhoodDirectory(resolved.treatmentSlug, resolved.citySlug, resolved.neighborhoodSlug)
    if (!data) return {}
    const title = `${data.treatment.name} in ${data.neighborhood.name}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: `Find verified ${data.treatment.name} providers near ${data.neighborhood.name}.`,
      alternates: { canonical: `${siteUrl}/${resolved.treatmentSlug}/${resolved.citySlug}/${resolved.neighborhoodSlug}` },
      ...(isMarketNoindex(data.city) ? { robots: NOINDEX_ROBOTS } : {}),
    }
  }

  return {}
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ path: string[] }>
}) {
  const { path } = await params
  const resolved = await resolveRoute(path)
  const siteUrl = 'https://injector.world'

  // ── City directory (1.1) ───────────────────────────────────────────────────
  if (resolved.type === 'city-directory') {
    const data = await getCityDirectory(resolved.treatmentSlug, resolved.citySlug)
    if (!data) notFound()

    const [sponsored, banner, pins] = await Promise.all([
      getPromotions('treatment+city', data.treatment.id, data.city.id),
      getActiveBanner('treatment+city', data.treatment.id, data.city.id),
      getOrganicPins('treatment+city', data.treatment.id, data.city.id),
    ])

    // Apply merit order: admin pins first (by rank), then merit score desc.
    // Sponsored providers are excluded from the organic list to prevent duplication.
    const sponsoredIds = new Set(sponsored.map((p) => p.id))
    const orderedProviders = applyMeritOrder(data.providers, pins, sponsoredIds)

    const cityDisplay = data.city.name.replace(/\s+city$/i, '')

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(data.stateLocation ? [
          { '@type': 'ListItem', position: 2, name: data.treatment.name, item: `${siteUrl}/${resolved.treatmentSlug}` },
          { '@type': 'ListItem', position: 3, name: `${data.treatment.name} in ${data.stateLocation.name}`, item: `${siteUrl}/${resolved.treatmentSlug}/${data.stateLocation.slug}` },
        ] : []),
        { '@type': 'ListItem', position: data.stateLocation ? 4 : 2, name: data.city.name },
      ],
    }

    const itemListSchema = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.treatment.name} providers in ${cityDisplay}`,
      numberOfItems: data.providers.length,
      itemListElement: data.providers.slice(0, 10).map((p, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'Physician', name: p.fullName, url: `${siteUrl}/injectors/${p.slug}` },
      })),
    }

    const clinicListSchema = data.clinics.length > 0 ? {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.treatment.name} clinics in ${cityDisplay}`,
      numberOfItems: data.clinics.length,
      itemListElement: data.clinics.slice(0, 10).map((c, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'MedicalBusiness', name: c.clinicName, url: `${siteUrl}/clinics/${c.slug}` },
      })),
    } : null

    const faqSchema = data.faqs.length > 0 ? {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    } : null

    return (
      <CityDirectoryPage
        data={{ ...data, providers: orderedProviders }}
        sponsored={sponsored}
        banner={banner}
        schema={[breadcrumbSchema, itemListSchema, ...(clinicListSchema ? [clinicListSchema] : []), ...(faqSchema ? [faqSchema] : [])]}
      />
    )
  }

  // ── State hub (1.6) ────────────────────────────────────────────────────────
  if (resolved.type === 'state-hub') {
    const data = await getStateHub(resolved.stateSlug)
    if (!data) notFound()

    const [sponsored, banner] = await Promise.all([
      getPromotions('state', undefined, data.state.id),
      getActiveBanner('state', undefined, data.state.id),
    ])

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: data.state.name },
      ],
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    }] : [])]

    return <StateHubPage data={data} sponsored={sponsored} banner={banner} schema={schema} />
  }

  // ── City hub (1.7) ─────────────────────────────────────────────────────────
  if (resolved.type === 'city-hub') {
    const data = await getCityHub(resolved.citySlug)
    if (!data) notFound()

    const sponsored = await getPromotions('city', undefined, data.city.id)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(data.stateLocation ? [{ '@type': 'ListItem', position: 2, name: data.stateLocation.name, item: `${siteUrl}/${data.stateLocation.slug}` }] : []),
        { '@type': 'ListItem', position: data.stateLocation ? 3 : 2, name: data.city.name },
      ],
    }]

    return <CityHubPage data={data} sponsored={sponsored} schema={schema} />
  }

  // ── Treatment pillar (1.2) ─────────────────────────────────────────────────
  if (resolved.type === 'treatment-pillar') {
    const data = await getTreatmentPillar(resolved.treatmentSlug)
    if (!data) notFound()

    const banner = await getActiveBanner('treatment', data.treatment.id)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'MedicalWebPage',
      name: `${data.treatment.name} Injectors`,
      description: data.treatment.shortDescription || data.treatment.tagline,
      url: `${siteUrl}/${resolved.treatmentSlug}`,
      specialty: 'Dermatology',
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    }] : [])]

    return <TreatmentPillarPage data={data} banner={banner} schema={schema} />
  }

  // ── Treatment + state (1.3) ────────────────────────────────────────────────
  if (resolved.type === 'treatment-state') {
    const data = await getTreatmentState(resolved.treatmentSlug, resolved.stateSlug)
    if (!data) notFound()

    const banner = await getActiveBanner('treatment+state', data.treatment.id, data.state.id)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: data.treatment.name, item: `${siteUrl}/${resolved.treatmentSlug}` },
        { '@type': 'ListItem', position: 3, name: data.state.name },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.treatment.name} providers in ${data.state.name}`,
      itemListElement: data.cities.map((c, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'City', name: c.name, url: `${siteUrl}/${resolved.treatmentSlug}/${c.slug}` },
      })),
    }]

    return <TreatmentStatePage data={data} banner={banner} schema={schema} />
  }

  // ── Neighborhood (1.4) ─────────────────────────────────────────────────────
  if (resolved.type === 'neighborhood') {
    const data = await getNeighborhoodDirectory(resolved.treatmentSlug, resolved.citySlug, resolved.neighborhoodSlug)
    if (!data) notFound()

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: data.treatment.name, item: `${siteUrl}/${resolved.treatmentSlug}` },
        { '@type': 'ListItem', position: 3, name: data.city.name, item: `${siteUrl}/${resolved.treatmentSlug}/${resolved.citySlug}` },
        { '@type': 'ListItem', position: 4, name: data.neighborhood.name },
      ],
    }]

    return <NeighborhoodPage data={data} schema={schema} />
  }

  notFound()
}
