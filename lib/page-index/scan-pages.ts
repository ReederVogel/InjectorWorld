import type { Payload } from 'payload'

/**
 * Page-index scan. Walks published-clinic data and upserts one `page-index` row
 * per service/location page that has data, IN A LIVE MARKET. Empty pages get no
 * row (so they stay noindex). New pages (after the first baseline scan) are left
 * `acknowledged=false` and get a DataAlert, so the dashboard can notify the admin.
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
}

type DesiredPage = {
  pageKey: string
  path: string
  pageType: 'service-pillar' | 'service-state' | 'service-city' | 'state-hub' | 'city-hub'
  serviceSlug?: string
  stateSlug?: string
  citySlug?: string
  dataCount: number
}

const kebab = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export async function scanPages(payload: Payload): Promise<PageScanResult> {
  const pool = (payload.db as any).pool

  // â”€â”€ Reference data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [treatments, locations] = await Promise.all([
    payload.find({ collection: 'services', limit: 1000, depth: 0 }),
    payload.find({ collection: 'locations', limit: 10000, depth: 0 }),
  ])

  const serviceSlugById = new Map<string, string>()
  for (const t of treatments.docs as any[]) serviceSlugById.set(String(t.id), t.slug)

  // state code -> { slug, live }; metro "lowername|CODE" -> { slug, stateSlug, live }
  const stateByCode = new Map<string, { slug: string; live: boolean }>()
  for (const l of locations.docs as any[]) {
    if (l.kind === 'state' && l.state) stateByCode.set(String(l.state).toUpperCase(), { slug: l.slug, live: l.isLive === true })
  }
  const metroByKey = new Map<string, { slug: string; stateSlug: string; live: boolean }>()
  for (const l of locations.docs as any[]) {
    if ((l.kind === 'metro' || l.kind === 'city') && l.name && l.state) {
      const code = String(l.state).toUpperCase()
      const st = stateByCode.get(code)
      metroByKey.set(`${String(l.name).toLowerCase()}|${code}`, {
        slug: l.slug,
        stateSlug: st?.slug ?? '',
        live: l.isLive === true,
      })
    }
  }

  // â”€â”€ Clinic data aggregations (raw SQL for speed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Per service Ã— city: counts clinics offering that service in that city.
  const relAgg = await pool.query(
    `SELECT cr.treatments_id AS tid, lower(c.city) AS city, upper(c.state) AS code, count(*)::int AS n
       FROM clinics c
       JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.treatments_id IS NOT NULL
      WHERE c.status = 'published' AND c.city IS NOT NULL AND c.city !~ '\\d'
      GROUP BY cr.treatments_id, lower(c.city), upper(c.state)`,
  )
  // Per city / per state: distinct published clinics (treatment-agnostic hubs).
  const cityAgg = await pool.query(
    `SELECT lower(city) AS city, upper(state) AS code, count(*)::int AS n
       FROM clinics WHERE status='published' AND city IS NOT NULL AND city !~ '\\d'
      GROUP BY lower(city), upper(state)`,
  )
  const stateAgg = await pool.query(
    `SELECT upper(state) AS code, count(*)::int AS n
       FROM clinics WHERE status='published' AND state IS NOT NULL GROUP BY upper(state)`,
  )

  // â”€â”€ Build the desired page set (live markets only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const desired = new Map<string, DesiredPage>()
  const add = (p: DesiredPage) => {
    const ex = desired.get(p.pageKey)
    if (ex) ex.dataCount += p.dataCount
    else desired.set(p.pageKey, p)
  }

  // service Ã— state and service pillar accumulators
  const serviceStateCount = new Map<string, number>() // tid|CODE -> n
  const servicePillarCount = new Map<string, number>() // tid -> n

  for (const r of relAgg.rows) {
    const serviceSlug = serviceSlugById.get(String(r.tid))
    if (!serviceSlug) continue
    const code = String(r.code)
    const metro = metroByKey.get(`${r.city}|${code}`)
    const state = stateByCode.get(code)

    // service Ã— city (only live metros)
    if (metro && metro.live && metro.stateSlug) {
      add({
        pageKey: `service-city:${serviceSlug}:${metro.stateSlug}:${metro.slug}`,
        path: `/services/${serviceSlug}/${metro.stateSlug}/${metro.slug}`,
        pageType: 'service-city', serviceSlug, stateSlug: metro.stateSlug, citySlug: metro.slug,
        dataCount: r.n,
      })
    }
    // accumulate state/pillar only from live states
    if (state?.live) {
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

  // city hubs (live metros)
  for (const r of cityAgg.rows) {
    const metro = metroByKey.get(`${r.city}|${String(r.code)}`)
    if (metro && metro.live && metro.stateSlug) {
      add({
        pageKey: `city-hub:-:${metro.stateSlug}:${metro.slug}`,
        path: `/${metro.stateSlug}/${metro.slug}`,
        pageType: 'city-hub', stateSlug: metro.stateSlug, citySlug: metro.slug, dataCount: r.n,
      })
    }
  }
  // state hubs (live states)
  for (const r of stateAgg.rows) {
    const state = stateByCode.get(String(r.code))
    if (state?.live) {
      add({
        pageKey: `state-hub:-:${state.slug}:-`,
        path: `/${state.slug}`,
        pageType: 'state-hub', stateSlug: state.slug, dataCount: r.n,
      })
    }
  }

  // â”€â”€ Reconcile against existing rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const existingRes = await payload.find({ collection: 'page-index' as any, limit: 100000, depth: 0 })
  const existing = new Map<string, any>()
  for (const row of existingRes.docs as any[]) existing.set(row.pageKey, row)
  const baseline = existing.size === 0 // first ever scan â†’ seed silently, no notifications

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

  // Pages that lost all their data â†’ set dataCount 0 (hook flips hasData/indexed off under 'auto').
  for (const [key, ex] of existing) {
    if (!desired.has(key) && ex.dataCount !== 0) {
      await payload.update({ collection: 'page-index' as any, id: ex.id, overrideAccess: true, data: { dataCount: 0, lastScannedAt: now } })
      lostData++
    }
  }

  // â”€â”€ DataAlerts: one per new page (post-baseline), or a single baseline summary â”€
  if (baseline) {
    await payload.create({
      collection: 'data-alerts', overrideAccess: true,
      data: {
        alertKey: 'page-index-baseline',
        type: 'new_indexable_page', severity: 'info', source: 'scan',
        message: `Page index baseline established: ${created} indexable pages.`,
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
          message: `New page now has data and was auto-indexed: ${a.path} (${a.dataCount} clinics). Review to keep or no-index.`,
          collectionSlug: 'page-index', documentId: a.path, status: 'open',
        },
      }).catch(() => {})
    }
  }

  return { total: desired.size, created, updated, lostData, baseline, newPages: newPages.slice(0, 50) }
}

