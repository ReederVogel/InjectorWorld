import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveRoute, getAllRoutePaths } from '@/lib/route-resolver'
import {
  getCityDirectory, getTreatmentPillar, getTreatmentState,
  getStateHub, getCityHub, getServicesIndex,
} from '@/lib/location-queries'
import {
  getBrandsIndex, getBrandPillar, getBrandState, getBrandCityDirectory,
} from '@/lib/brand-queries'
import {
  getActiveBanner,
  getSponsoredProviders,
  getSponsoredClinics,
  getFeaturedProviderPins,
} from '@/lib/promotions'
import { sortByMerit, byMeritDesc } from '@/lib/merit'
import { isMarketLive } from '@/lib/markets'
import { getPageRobots } from '@/lib/page-index/queries'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PromoBanner } from '@/components/shared/PromoBanner'
import { ComingSoonMarket } from '@/components/shared/ComingSoonMarket'
import { CityDirectoryPage } from '@/components/pages/CityDirectoryPage'
import { TreatmentPillarPage } from '@/components/pages/TreatmentPillarPage'
import { TreatmentStatePage } from '@/components/pages/TreatmentStatePage'
import { StateHubPage } from '@/components/pages/StateHubPage'
import { CityHubPage } from '@/components/pages/CityHubPage'
import { ServicesIndexPage } from '@/components/pages/ServicesIndexPage'
import { BrandsIndexPage } from '@/components/pages/BrandsIndexPage'
import { BrandPillarPage } from '@/components/pages/BrandPillarPage'
import { BrandStatePage } from '@/components/pages/BrandStatePage'
import { BrandCityDirectoryPage } from '@/components/pages/BrandCityDirectoryPage'

export const revalidate = 60

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  if (resolved.type === 'services-index') {
    const title = 'All aesthetic services'
    const desc = 'Browse every aesthetic treatment we cover, from neurotoxins to fillers and skin therapies. Find verified, license-checked injectors near you.'
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/services` },
      openGraph: { title, description: desc, url: `${siteUrl}/services` },
    }
  }

  if (resolved.type === 'brands-index') {
    const title = 'Aesthetic product brands'
    const desc = 'Browse aesthetic product brands: Botox, Juvederm, Dysport, Sculptra, and more. Find verified clinics that carry each brand.'
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/brands` },
      openGraph: { title, description: desc, url: `${siteUrl}/brands` },
    }
  }

  if (resolved.type === 'brand-pillar') {
    const data = await getBrandPillar(resolved.brandSlug)
    if (!data) return {}
    const title = `${data.brand.name} Clinics`
    const desc = `Find verified clinics carrying ${data.brand.name} across the US. ${data.brand.tagline ?? ''}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc.trim(),
      alternates: { canonical: `${siteUrl}/brands/${resolved.brandSlug}` },
      ...(await getPageRobots(`/brands/${resolved.brandSlug}`)),
    }
  }

  if (resolved.type === 'brand-state') {
    const data = await getBrandState(resolved.brandSlug, resolved.stateSlug)
    if (!data) return {}
    const title = `${data.brand.name} in ${data.state.name}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: `Find verified clinics carrying ${data.brand.name} in ${data.state.name}. Browse by city.`,
      alternates: { canonical: `${siteUrl}/brands/${resolved.brandSlug}/${resolved.stateSlug}` },
      ...(await getPageRobots(`/brands/${resolved.brandSlug}/${resolved.stateSlug}`)),
    }
  }

  if (resolved.type === 'brand-city-directory') {
    const data = await getBrandCityDirectory(resolved.brandSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) return {}
    const city = data.city.name.replace(/\s+city$/i, '')
    const title = `${data.brand.name} in ${city}, ${data.city.stateCode}`
    const desc = `Find ${data.totalClinics > 0 ? data.totalClinics + ' ' : ''}verified clinics carrying ${data.brand.name} in ${city}. License-checked, patient-reviewed.`
    const canonical = `${siteUrl}/brands/${resolved.brandSlug}/${resolved.stateSlug}/${resolved.citySlug}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical },
      openGraph: { title, description: desc, url: canonical },
      ...(await getPageRobots(canonical)),
    }
  }

  if (resolved.type === 'service-city-directory') {
    const data = await getCityDirectory(resolved.treatmentSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) return {}
    const city = data.city.name.replace(/\s+city$/i, '')
    const title = `${data.treatment.name} in ${city}, ${data.city.stateCode}`
    const desc = `Find ${data.providers.length > 0 ? data.providers.length + ' ' : ''}verified ${data.treatment.name} providers in ${city}. License-checked, patient-reviewed.`
    const canonical = `${siteUrl}/services/${resolved.treatmentSlug}/${resolved.stateSlug}/${resolved.citySlug}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical },
      openGraph: { title, description: desc, url: canonical },
      ...(await getPageRobots(`/services/${resolved.treatmentSlug}/${resolved.stateSlug}/${resolved.citySlug}`)),
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
      ...(await getPageRobots(`/${resolved.stateSlug}`)),
    }
  }

  if (resolved.type === 'city-hub') {
    const data = await getCityHub(resolved.stateSlug, resolved.citySlug)
    if (!data) return {}
    const cityDisplay = data.city.name.replace(/\s+city$/i, '')
    const title = `Aesthetic Injectors in ${cityDisplay}, ${data.city.stateCode}`
    const desc = `Browse ${data.services.length} services and verified aesthetic providers in ${cityDisplay}. Choose a service to see license-checked injectors near you.`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/${resolved.stateSlug}/${resolved.citySlug}` },
      ...(await getPageRobots(`/${resolved.stateSlug}/${resolved.citySlug}`)),
    }
  }

  if (resolved.type === 'service-pillar') {
    const data = await getTreatmentPillar(resolved.treatmentSlug)
    if (!data) return {}
    const title = `${data.treatment.name} Injectors`
    const desc = `Find verified ${data.treatment.name} providers across the US. ${data.treatment.tagline ?? ''}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc.trim(),
      alternates: { canonical: `${siteUrl}/services/${resolved.treatmentSlug}` },
      ...(await getPageRobots(`/services/${resolved.treatmentSlug}`)),
    }
  }

  if (resolved.type === 'service-state') {
    const data = await getTreatmentState(resolved.treatmentSlug, resolved.stateSlug)
    if (!data) return {}
    const title = `${data.treatment.name} in ${data.state.name}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: `Find verified ${data.treatment.name} providers in ${data.state.name}. Browse by city.`,
      alternates: { canonical: `${siteUrl}/services/${resolved.treatmentSlug}/${resolved.stateSlug}` },
      ...(await getPageRobots(`/services/${resolved.treatmentSlug}/${resolved.stateSlug}`)),
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // ── Brands index (/brands) ─────────────────────────────────────────────────
  if (resolved.type === 'brands-index') {
    const brands = await getBrandsIndex()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Aesthetic product brands',
      numberOfItems: brands.length,
      itemListElement: brands.map((b, i) => ({
        '@type': 'ListItem', position: i + 1, name: b.name, url: `${siteUrl}/brands/${b.slug}`,
      })),
    }]
    return <BrandsIndexPage brands={brands} schema={schema} />
  }

  // ── Brand pillar (/brands/[brand]) ─────────────────────────────────────────
  if (resolved.type === 'brand-pillar') {
    const data = await getBrandPillar(resolved.brandSlug)
    if (!data) notFound()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
        { '@type': 'ListItem', position: 3, name: data.brand.name },
      ],
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    }] : [])]
    return <BrandPillarPage data={data} schema={schema} />
  }

  // ── Brand × state (/brands/[brand]/[state]) ────────────────────────────────
  if (resolved.type === 'brand-state') {
    const data = await getBrandState(resolved.brandSlug, resolved.stateSlug)
    if (!data) notFound()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
        { '@type': 'ListItem', position: 3, name: data.brand.name, item: `${siteUrl}/brands/${resolved.brandSlug}` },
        { '@type': 'ListItem', position: 4, name: data.state.name },
      ],
    }]
    return <BrandStatePage data={data} schema={schema} />
  }

  // ── Brand × city (/brands/[brand]/[state]/[city]) ──────────────────────────
  if (resolved.type === 'brand-city-directory') {
    const data = await getBrandCityDirectory(resolved.brandSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) notFound()
    const cityDisplay = data.city.name.replace(/\s+city$/i, '')
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
        { '@type': 'ListItem', position: 3, name: data.brand.name, item: `${siteUrl}/brands/${resolved.brandSlug}` },
        ...(data.stateLocation ? [{ '@type': 'ListItem', position: 4, name: data.stateLocation.name, item: `${siteUrl}/brands/${resolved.brandSlug}/${resolved.stateSlug}` }] : []),
        { '@type': 'ListItem', position: data.stateLocation ? 5 : 4, name: cityDisplay },
      ],
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    }] : [])]
    return <BrandCityDirectoryPage data={data} schema={schema} />
  }

  // ── Services index (/services) ──────────────────────────────────────────────
  if (resolved.type === 'services-index') {
    const services = await getServicesIndex()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Services', item: `${siteUrl}/services` },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Aesthetic services',
      numberOfItems: services.length,
      itemListElement: services.map((s, i) => ({
        '@type': 'ListItem', position: i + 1, name: s.name, url: `${siteUrl}/services/${s.slug}`,
      })),
    }]
    return <ServicesIndexPage services={services} schema={schema} />
  }

  // ── Service × city directory (money page) ───────────────────────────────────
  if (resolved.type === 'service-city-directory') {
    const data = await getCityDirectory(resolved.treatmentSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) notFound()

    const [sponsored, banner, pins] = await Promise.all([
      getSponsoredProviders('treatment+city', data.treatment.id, undefined, data.city.id),
      getActiveBanner('treatment+city', data.treatment.id, undefined, data.city.id),
      getFeaturedProviderPins('treatment+city', data.treatment.id, undefined, data.city.id),
    ])

    // Featured pins first (by rank), then remaining sorted by merit score.
    const sponsoredIds = new Set(sponsored.map((p) => p.id))
    const organic = data.providers.filter((p) => !sponsoredIds.has(p.id))
    const pinned = organic.filter((p) => pins.has(p.id)).sort((a, b) => (pins.get(a.id) ?? 99) - (pins.get(b.id) ?? 99))
    const tail = organic.filter((p) => !pins.has(p.id)).sort(byMeritDesc)
    const orderedProviders = [...pinned, ...tail]

    const cityDisplay = data.city.name.replace(/\s+city$/i, '')

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(data.stateLocation ? [
          { '@type': 'ListItem', position: 2, name: data.treatment.name, item: `${siteUrl}/services/${resolved.treatmentSlug}` },
          { '@type': 'ListItem', position: 3, name: `${data.treatment.name} in ${data.stateLocation.name}`, item: `${siteUrl}/services/${resolved.treatmentSlug}/${data.stateLocation.slug}` },
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
        item: { '@type': 'Physician', name: p.fullName, url: `${siteUrl}/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}` },
      })),
    }

    const clinicListSchema = data.clinics.length > 0 ? {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.treatment.name} clinics in ${cityDisplay}`,
      numberOfItems: data.clinics.length,
      itemListElement: data.clinics.slice(0, 10).map((c, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'MedicalBusiness', name: c.clinicName, url: `${siteUrl}/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}` },
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

    if (!isMarketLive(data.state)) {
      return (
        <>
          <Header />
          <ComingSoonMarket
            overline="Coming soon"
            title={`Verified injectors in ${data.state.name}`}
            placeName={data.state.name}
            stateCode={data.state.stateCode}
            links={[
              { href: '/clinics', label: 'Browse all verified clinics' },
              { href: '/guides', label: 'Treatment guides' },
            ]}
          />
          <Footer />
        </>
      )
    }

    const [sponsored, banner, pins] = await Promise.all([
      getSponsoredProviders('state', undefined, data.state.id),
      getActiveBanner('state', undefined, data.state.id),
      getFeaturedProviderPins('state', undefined, data.state.id),
    ])

    const sponsoredIds = new Set(sponsored.map((p) => p.id))
    const organic = data.providers.filter((p) => !sponsoredIds.has(p.id))
    const pinned = organic.filter((p) => pins.has(p.id)).sort((a, b) => (pins.get(a.id) ?? 99) - (pins.get(b.id) ?? 99))
    const tail = organic.filter((p) => !pins.has(p.id)).sort(byMeritDesc)
    const orderedProviders = [...pinned, ...tail]

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: data.state.name },
      ],
    }, ...(orderedProviders.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `Verified injectors in ${data.state.name}`,
      numberOfItems: orderedProviders.length,
      itemListElement: orderedProviders.slice(0, 10).map((p, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'Physician', name: p.fullName, url: `${siteUrl}/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}` },
      })),
    }] : []), ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    }] : [])]

    return (
      <>
        <Header />
        <PromoBanner banner={banner} />
        <StateHubPage data={{ ...data, providers: orderedProviders }} sponsored={sponsored} schema={schema} />
        <Footer />
      </>
    )
  }

  // ── City hub (1.7) ─────────────────────────────────────────────────────────
  if (resolved.type === 'city-hub') {
    const data = await getCityHub(resolved.stateSlug, resolved.citySlug)
    if (!data) notFound()

    if (!isMarketLive(data.city)) {
      const cityDisplay = data.city.name.replace(/\s+city$/i, '')
      return (
        <>
          <Header />
          <ComingSoonMarket
            overline="Coming soon"
            title={`Aesthetic injectors in ${cityDisplay}, ${data.city.stateCode}`}
            placeName={cityDisplay}
            cityTag={cityDisplay}
            stateCode={data.city.stateCode}
            links={[
              ...(data.stateLocation ? [{ href: `/${data.stateLocation.slug}`, label: `All of ${data.stateLocation.name}` }] : []),
              { href: '/clinics', label: 'Browse all verified clinics' },
              { href: '/guides', label: 'Treatment guides' },
            ]}
          />
          <Footer />
        </>
      )
    }

    const sponsored = await getSponsoredProviders('city', undefined, undefined, data.city.id)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(data.stateLocation ? [{ '@type': 'ListItem', position: 2, name: data.stateLocation.name, item: `${siteUrl}/${data.stateLocation.slug}` }] : []),
        { '@type': 'ListItem', position: data.stateLocation ? 3 : 2, name: data.city.name },
      ],
    }]

    return (
      <>
        <Header />
        <CityHubPage data={data} sponsored={sponsored} schema={schema} />
        <Footer />
      </>
    )
  }

  // ── Service pillar ───────────────────────────────────────────────────────────
  if (resolved.type === 'service-pillar') {
    const data = await getTreatmentPillar(resolved.treatmentSlug)
    if (!data) notFound()

    const banner = await getActiveBanner('treatment', data.treatment.id, undefined, undefined)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'MedicalWebPage',
      name: `${data.treatment.name} Injectors`,
      description: data.treatment.shortDescription || data.treatment.tagline,
      url: `${siteUrl}/services/${resolved.treatmentSlug}`,
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

  // ── Service × state ───────────────────────────────────────────────────────────
  if (resolved.type === 'service-state') {
    const data = await getTreatmentState(resolved.treatmentSlug, resolved.stateSlug)
    if (!data) notFound()

    const banner = await getActiveBanner('treatment+state', data.treatment.id, data.state.id, undefined)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: data.treatment.name, item: `${siteUrl}/services/${resolved.treatmentSlug}` },
        { '@type': 'ListItem', position: 3, name: data.state.name },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.treatment.name} providers in ${data.state.name}`,
      itemListElement: data.cities.map((c, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'City', name: c.name, url: `${siteUrl}/services/${resolved.treatmentSlug}/${resolved.stateSlug}/${c.slug}` },
      })),
    }]

    return <TreatmentStatePage data={data} banner={banner} schema={schema} />
  }

  notFound()
}
