import type { Payload } from 'payload'

/**
 * Page-index scan. Walks published-clinic data and:
 *  1. Upserts one `page-index` row per service/location/brand page that has data.
 *     Empty pages get no row (so they stay noindex). `indexMode` defaults to
 *     `auto`, which the collection's beforeChange hook resolves to indexable
 *     once a page clears `MIN_CLINICS_TO_INDEX` -- no manual per-page review.
 *  2. Flips each location's `isLive` to match whether it has >=1 published
 *     clinic. There is no manual "launch this market" step anymore -- a
 *     market goes live (shows the real directory instead of Coming Soon)
 *     purely because data exists for it.
 *
 * Shared by `scripts/scan-pages.ts` (CLI) and `/api/admin/scan-pages` (button).
 */

export type PageScanResult = {
  total: number
  created: number
  updated: number
  lostData: number
  baseline: boolean
  newPages: { path: string; dataCount: number }[]
  marketsFlippedLive: number
  marketsFlippedComingSoon: number
}

type DesiredPage = {
  pageKey: string
  path: string
  pageType:
    | 'service-pillar' | 'service-state' | 'service-city'
    | 'state-hub' | 'city-hub'
    | 'brand-pillar' | 'brand-state' | 'brand-city-directory'
  serviceSlug?: string
  brandSlug?: string
  stateSlug?: string
  citySlug?: string
  dataCount: number
}

export async function scanPages(payload: Payload): Promise<PageScanResult> {
  const pool = (payload.db as any).pool

  // -- Reference data ---------------------------------------------------------
  const [treatments, brands, locations] = await Promise.all([
    payload.find({ collection: 'services', limit: 1000, depth: 0 }),
    payload.find({ collection: 'brands', limit: 1000, depth: 0 }),
    payload.find({ collection: 'locations', limit: 10000, depth: 0 }),
  ])

  const serviceSlugById = new Map<string, string>()
  for (const t of treatments.docs as any[]) serviceSlugById.set(String(t.id), t.slug)
  const brandSlugById = new Map<string, string>()
  for (const b of brands.docs as any[]) brandSlugById.set(String(b.id), b.slug)

  // state code -> { id, slug }; metro "lowername|CODE" -> { id, slug, stateSlug }
  const stateByCode = new Map<string, { id: string; slug: string }>()
  for (const l of locations.docs as any[]) {
    if (l.kind === 'state' && l.state) stateByCode.set(String(l.state).toUpperCase(), { id: String(l.id), slug: l.slug })
  }
  const metroByKey = new Map<string, { id: string; slug: string; stateSlug: string }>()
  for (const l of locations.docs as any[]) {
    if ((l.kind === 'metro' || l.kind === 'city') && l.name && l.state) {
      const code = String(l.state).toUpperCase()
      const st = stateByCode.get(code)
      metroByKey.set(`${String(l.name).toLowerCase()}|${code}`, {
        id: String(l.id), slug: l.slug, stateSlug: st?.slug ?? '',
      })
    }
  }

  // -- Clinic data aggregations (raw SQL for speed) ----------------------------
  const [relAgg, brandRelAgg, cityAgg, stateAgg] = await Promise.all([
    // Per service × city: counts clinics offering that service in that city.
    pool.query(
      `SELECT cr.services_id AS tid, lower(c.city) AS city, upper(c.state) AS code, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.services_id IS NOT NULL
        WHERE c.status = 'published' AND c.city IS NOT NULL AND c.city !~ '\\d'
        GROUP BY cr.services_id, lower(c.city), upper(c.state)`,
    ),
    // Per brand × city: counts clinics carrying that brand in that city.
    pool.query(
      `SELECT cr.brands_id AS tid, lower(c.city) AS city, upper(c.state) AS code, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id IS NOT NULL
        WHERE c.status = 'published' AND c.city IS NOT NULL AND c.city !~ '\\d'
        GROUP BY cr.brands_id, lower(c.city), upper(c.state)`,
    ),
    // Per city / per state: distinct published clinics (treatment-agnostic hubs).
    pool.query(
      `SELECT lower(city) AS city, upper(state) AS code, count(*)::int AS n
         FROM clinics WHERE status='published' AND city IS NOT NULL AND city !~ '\\d'
        GROUP BY lower(city), upper(state)`,
    ),
    pool.query(
      `SELECT upper(state) AS code, count(*)::int AS n
         FROM clinics WHERE status='published' AND state IS NOT NULL GROUP BY upper(state)`,
    ),
  ])

  // -- Build the desired page set (every service/brand/location combo with data) -
  const desired = new Map<string, DesiredPage>()
  const add = (p: DesiredPage) => {
    const ex = desired.get(p.pageKey)
    if (ex) ex.dataCount += p.dataCount
    else desired.set(p.pageKey, p)
  }

  const serviceStateCount = new Map<string, number>() // tid|CODE -> n
  const servicePillarCount = new Map<string, number>() // tid -> n
  const brandStateCount = new Map<string, number>()
  const brandPillarCount = new Map<string, number>()

  for (const r of relAgg.rows) {
    const serviceSlug = serviceSlugById.get(String(r.tid))
    if (!serviceSlug) continue
    const code = String(r.code)
    const metro = metroByKey.get(`${r.city}|${code}`)
    const state = stateByCode.get(code)

    if (metro && metro.stateSlug) {
      add({
        pageKey: `service-city:${serviceSlug}:${metro.stateSlug}:${metro.slug}`,
        path: `/services/${serviceSlug}/${metro.stateSlug}/${metro.slug}`,
        pageType: 'service-city', serviceSlug, stateSlug: metro.stateSlug, citySlug: metro.slug,
        dataCount: r.n,
      })
    }
    if (state) {
      serviceStateCount.set(`${r.tid}|${code}`, (serviceStateCount.get(`${r.tid}|${code}`) ?? 0) + r.n)
      servicePillarCount.set(String(r.tid), (servicePillarCount.get(String(r.tid)) ?? 0) + r.n)
    }
  }
  for (const [key, n] of serviceStateCount) {
    const [tid, code] = key.split('|')
    const serviceSlug = serviceSlugById.get(tid)
    const state = stateByCode.get(code)
    if (!serviceSlug || !state) continue
    add({
      pageKey: `service-state:${serviceSlug}:${state.slug}:-`,
      path: `/services/${serviceSlug}/${state.slug}`,
      pageType: 'service-state', serviceSlug, stateSlug: state.slug, dataCount: n,
    })
  }
  for (const [tid, n] of servicePillarCount) {
    const serviceSlug = serviceSlugById.get(tid)
    if (!serviceSlug) continue
    add({
      pageKey: `service-pillar:${serviceSlug}:-:-`,
      path: `/services/${serviceSlug}`,
      pageType: 'service-pillar', serviceSlug, dataCount: n,
    })
  }

  for (const r of brandRelAgg.rows) {
    const brandSlug = brandSlugById.get(String(r.tid))
    if (!brandSlug) continue
    const code = String(r.code)
    const metro = metroByKey.get(`${r.city}|${code}`)
    const state = stateByCode.get(code)

    if (metro && metro.stateSlug) {
      add({
        pageKey: `brand-city-directory:${brandSlug}:${metro.stateSlug}:${metro.slug}`,
        path: `/brands/${brandSlug}/${metro.stateSlug}/${metro.slug}`,
        pageType: 'brand-city-directory', brandSlug, stateSlug: metro.stateSlug, citySlug: metro.slug,
        dataCount: r.n,
      })
    }
    if (state) {
      brandStateCount.set(`${r.tid}|${code}`, (brandStateCount.get(`${r.tid}|${code}`) ?? 0) + r.n)
      brandPillarCount.set(String(r.tid), (brandPillarCount.get(String(r.tid)) ?? 0) + r.n)
    }
  }
  for (const [key, n] of brandStateCount) {
    const [tid, code] = key.split('|')
    const brandSlug = brandSlugById.get(tid)
    const state = stateByCode.get(code)
    if (!brandSlug || !state) continue
    add({
      pageKey: `brand-state:${brandSlug}:${state.slug}:-`,
      path: `/brands/${brandSlug}/${state.slug}`,
      pageType: 'brand-state', brandSlug, stateSlug: state.slug, dataCount: n,
    })
  }
  for (const [tid, n] of brandPillarCount) {
    const brandSlug = brandSlugById.get(tid)
    if (!brandSlug) continue
    add({
      pageKey: `brand-pillar:${brandSlug}:-:-`,
      path: `/brands/${brandSlug}`,
      pageType: 'brand-pillar', brandSlug, dataCount: n,
    })
  }

  // city hubs / state hubs -- every location with >=1 clinic, live or not.
  for (const r of cityAgg.rows) {
    const metro = metroByKey.get(`${r.city}|${String(r.code)}`)
    if (metro && metro.stateSlug) {
      add({
        pageKey: `city-hub:-:${metro.stateSlug}:${metro.slug}`,
        path: `/${metro.stateSlug}/${metro.slug}`,
        pageType: 'city-hub', stateSlug: metro.stateSlug, citySlug: metro.slug, dataCount: r.n,
      })
    }
  }
  for (const r of stateAgg.rows) {
    const state = stateByCode.get(String(r.code))
    if (state) {
      add({
        pageKey: `state-hub:-:${state.slug}:-`,
        path: `/${state.slug}`,
        pageType: 'state-hub', stateSlug: state.slug, dataCount: r.n,
      })
    }
  }

  // -- Reconcile against existing rows -----------------------------------------
  const existing = new Map<string, any>()
  try {
    const existingRows = await pool.query(
      `SELECT id,
              page_key AS "pageKey",
              data_count AS "dataCount",
              first_seen_with_data AS "firstSeenWithData"
         FROM page_index`,
    )
    for (const row of existingRows.rows as any[]) existing.set(row.pageKey, row)
  } catch {
    const existingRes = await payload.find({ collection: 'page-index' as any, limit: 20000, depth: 0 })
    for (const row of existingRes.docs as any[]) existing.set(row.pageKey, row)
  }
  const baseline = existing.size === 0 // first ever scan → seed silently, no notifications

  const now = new Date().toISOString()
  let created = 0, updated = 0, lostData = 0
  const newPages: { path: string; dataCount: number }[] = []
  const alertsToCreate: { path: string; dataCount: number }[] = []

  for (const p of desired.values()) {
    const ex = existing.get(p.pageKey)
    if (!ex) {
      await payload.create({
        collection: 'page-index' as any,
        overrideAccess: true,
        data: {
          pageKey: p.pageKey, path: p.path, pageType: p.pageType,
          serviceSlug: p.serviceSlug, stateSlug: p.stateSlug, citySlug: p.citySlug,
          dataCount: p.dataCount, indexMode: 'auto',
          acknowledged: baseline, // baseline seed is pre-acknowledged
          firstSeenWithData: now, lastScannedAt: now,
        },
      })
      created++
      if (!baseline) { newPages.push({ path: p.path, dataCount: p.dataCount }); alertsToCreate.push({ path: p.path, dataCount: p.dataCount }) }
    } else {
      const regainedData = ex.dataCount === 0 && p.dataCount > 0 && ex.firstSeenWithData == null
      await payload.update({
        collection: 'page-index' as any, id: ex.id, overrideAccess: true,
        data: {
          dataCount: p.dataCount, lastScannedAt: now,
          path: p.path, // keep path fresh if a slug ever changes
          ...(ex.firstSeenWithData == null ? { firstSeenWithData: now } : {}),
          ...(regainedData && !baseline ? { acknowledged: false } : {}),
        },
      })
      updated++
      if (regainedData && !baseline) { newPages.push({ path: p.path, dataCount: p.dataCount }); alertsToCreate.push({ path: p.path, dataCount: p.dataCount }) }
    }
  }

  // Pages that lost all their data -> dataCount 0 (auto-noindex via the threshold).
  for (const [key, ex] of existing) {
    if (!desired.has(key) && ex.dataCount !== 0) {
      await payload.update({ collection: 'page-index' as any, id: ex.id, overrideAccess: true, data: { dataCount: 0, lastScannedAt: now } })
      lostData++
    }
  }

  // -- isLive: automatic, purely a function of "does this location have data" --
  const citiesWithData = new Set(cityAgg.rows.map((r: any) => `${r.city}|${r.code}`))
  const statesWithData = new Set(stateAgg.rows.map((r: any) => String(r.code)))
  let marketsFlippedLive = 0
  let marketsFlippedComingSoon = 0

  for (const l of locations.docs as any[]) {
    if (l.kind !== 'state' && l.kind !== 'metro' && l.kind !== 'city') continue
    const code = String(l.state ?? '').toUpperCase()
    const hasData =
      l.kind === 'state'
        ? statesWithData.has(code)
        : citiesWithData.has(`${String(l.name ?? '').toLowerCase()}|${code}`)
    if (l.isLive === hasData) continue
    await payload.update({ collection: 'locations', id: l.id, overrideAccess: true, data: { isLive: hasData } })
    if (hasData) marketsFlippedLive++
    else marketsFlippedComingSoon++
  }

  // -- DataAlerts: one per new page (post-baseline), or a single baseline summary -
  if (baseline) {
    await payload.create({
      collection: 'data-alerts', overrideAccess: true,
      data: {
        alertKey: 'page-index-baseline',
        type: 'new_indexable_page', severity: 'info', source: 'scan',
        message: `Page index baseline established: ${created} data-backed pages. Indexing is automatic once a page clears the minimum clinic count.`,
        collectionSlug: 'page-index', status: 'acknowledged',
      },
    }).catch(() => {})
  } else {
    for (const a of alertsToCreate) {
      await payload.create({
        collection: 'data-alerts', overrideAccess: true,
        data: {
          alertKey: `new-page-${a.path}`,
          type: 'new_indexable_page', severity: 'info', source: 'scan',
          message: `New page now has data: ${a.path} (${a.dataCount} clinics). Indexing is automatic, no action needed.`,
          collectionSlug: 'page-index', documentId: a.path, status: 'open',
        },
      }).catch(() => {})
    }
  }

  return {
    total: desired.size, created, updated, lostData, baseline,
    newPages: newPages.slice(0, 50), marketsFlippedLive, marketsFlippedComingSoon,
  }
}
