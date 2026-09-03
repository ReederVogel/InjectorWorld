/**
 * Seed the `qa` collection from the existing `faqs` rows.
 *
 * COPY, never move. The `faqs` table is the scope engine behind the FAQ blocks
 * and FAQPage schema on service, brand, guide, location and clinic pages
 * (lib/location-queries.ts, lib/guide-queries.ts, lib/brand-queries.ts,
 * lib/clinic-queries.ts, lib/assistant/faq-match.ts). Nothing here reads,
 * updates or deletes it, so no existing page can lose content.
 *
 * Idempotent: rows are upserted on `qa_id`, which is derived from the source
 * faq's primary key (`qa-faq-<id>`). Re-running updates in place rather than
 * inserting duplicates.
 *
 * Raw SQL rather than payload.create, matching the bulk pattern in
 * lib/page-index/scan-pages.ts. Per-row create would fire the QA afterChange
 * revalidate hook 621 times, and `revalidatePath` outside a request context is
 * not meaningful anyway.
 *
 * Usage (never `--env-file=.env.local`, that is PRODUCTION):
 *   npx tsx --env-file=.env.staging scripts/seed-qa-from-faqs.ts           # dry run
 *   npx tsx --env-file=.env.staging scripts/seed-qa-from-faqs.ts --apply   # write
 */
import pg from 'pg'

const APPLY = process.argv.includes('--apply')
const BATCH_LABEL = `qa-from-faqs-${new Date().toISOString().slice(0, 10)}`

type SourceRow = {
  id: number
  question: string
  answer: string
  answer_detail: string | null
  scope: string
  review_status: string
  stable_id: string | null
  sort_rank: string | null
  service_name: string | null
  brand_name: string | null
  guide_title: string | null
  guide_service_name: string | null
  location_name: string | null
  location_kind: string | null
}

type QaRow = {
  qaId: string
  slug: string
  questionTitle: string
  answerText: string
  serviceTag: string | null
  cityTag: string | null
  sourceFaqId: number
  scope: string
  reviewStatus: string
}

/** Mirrors the slug shape used by app/api/questions/route.ts. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
    .replace(/-$/, '')
}

/**
 * Guide-scoped faqs carry no usable tag of their own. Every guide has
 * `related_service_id` NULL (all 100 of them), and a guide TITLE is useless as
 * a group header. But guide-scoped faqs exist precisely for topics with no
 * Service or Brand page behind them (see collections/FAQs.ts), and today all
 * 150 of them sit in just 8 guides, so an explicit map is both possible and
 * more honest than fuzzy title matching.
 *
 * Keyed on a distinctive substring of the guide title, matched case-insensitively.
 * "Dermal Filler" and "Lip Flip" are exact service names, so questions tagged
 * with them also surface on those service pages via RelatedQAs. The rest are
 * Q&A-only labels: no service page exists to cross-link to.
 *
 * Migraine questions get their own tag rather than plain "Botox" on purpose,
 * so 33 medical-use questions do not land on the cosmetic Botox service page.
 */
const GUIDE_TAG_MAP: ReadonlyArray<readonly [match: string, tag: string]> = [
  ['dermal filler side effects', 'Dermal Filler'],
  ['what are dermal fillers', 'Dermal Filler'],
  ['lip flip', 'Lip Flip'],
  ['botox for migraines', 'Botox for Migraines'],
  ['hyaluronidase', 'Hyaluronidase'],
  ['skinvive', 'SkinVive'],
  ['nasolabial folds', 'Nasolabial Folds'],
  ['jowls', 'Jowls'],
]

function tagFromGuideTitle(title: string | null): string | null {
  if (!title) return null
  const t = title.toLowerCase()
  for (const [match, tag] of GUIDE_TAG_MAP) if (t.includes(match)) return tag
  return null
}

/**
 * The tag drives two things: the grouping headers on /questions, and the
 * `serviceTag LIKE` lookup that RelatedQAs uses to pull a question onto a
 * service page. So it has to be a service or brand NAME, not a sentence.
 */
function resolveServiceTag(r: SourceRow): string | null {
  if (r.service_name) return r.service_name
  if (r.brand_name) return r.brand_name
  if (r.guide_service_name) return r.guide_service_name
  return tagFromGuideTitle(r.guide_title)
}

function resolveCityTag(r: SourceRow): string | null {
  if (!r.location_name) return null
  return r.location_kind === 'state' ? null : r.location_name
}

function buildAnswer(r: SourceRow): string {
  const short = (r.answer ?? '').trim()
  const detail = (r.answer_detail ?? '').trim()
  if (!detail) return short
  if (!short) return detail
  return `${short}\n\n${detail}`
}

async function main() {
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) throw new Error('DATABASE_URI is not set. Pass --env-file=.env.staging.')

  // Small pool on purpose: the live app's own pool is capped at 4 to stay under
  // the database's connection ceiling.
  const pool = new pg.Pool({ connectionString, max: 2, ssl: { rejectUnauthorized: false } })

  const { rows } = await pool.query<SourceRow>(`
    SELECT f.id, f.question, f.answer, f.answer_detail, f.scope, f.review_status,
           f.stable_id, f.sort_rank,
           s.name  AS service_name,
           b.name  AS brand_name,
           g.title AS guide_title,
           gs.name AS guide_service_name,
           l.name  AS location_name,
           l.kind  AS location_kind
      FROM faqs f
      LEFT JOIN services  s  ON s.id  = f.service_id
      LEFT JOIN brands    b  ON b.id  = f.brand_id
      LEFT JOIN guides    g  ON g.id  = f.guide_id
      LEFT JOIN services  gs ON gs.id = g.related_service_id
      LEFT JOIN locations l  ON l.id  = f.location_id
     ORDER BY f.sort_rank NULLS LAST, f.id
  `)

  // ── Build, with slug de-duplication ────────────────────────────────────────
  const seen = new Set<string>()
  const built: QaRow[] = []
  const problems: string[] = []

  for (const r of rows) {
    const questionTitle = (r.question ?? '').trim()
    const answerText = buildAnswer(r)

    if (!questionTitle) { problems.push(`faq ${r.id}: empty question, skipped`); continue }
    if (!answerText)    { problems.push(`faq ${r.id}: empty answer, skipped`);   continue }

    let base = slugify(r.stable_id || questionTitle)
    if (!base) base = `question-${r.id}`

    // stable_id is distinct across all 621 rows today, but slugify() can still
    // collapse two of them onto the same string. `slug` is UNIQUE in the qa
    // table, so a collision would abort the whole insert.
    let slug = base
    let n = 2
    while (seen.has(slug)) { slug = `${base}-${n}`; n++ }
    if (slug !== base) problems.push(`faq ${r.id}: slug collision on "${base}", used "${slug}"`)
    seen.add(slug)

    built.push({
      qaId: `qa-faq-${r.id}`,
      slug,
      questionTitle,
      answerText,
      serviceTag: resolveServiceTag(r),
      cityTag: resolveCityTag(r),
      sourceFaqId: r.id,
      scope: r.scope,
      reviewStatus: r.review_status,
    })
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const byScope = new Map<string, number>()
  const byTag = new Map<string, number>()
  let untagged = 0
  for (const b of built) {
    byScope.set(b.scope, (byScope.get(b.scope) ?? 0) + 1)
    if (b.serviceTag) byTag.set(b.serviceTag, (byTag.get(b.serviceTag) ?? 0) + 1)
    else untagged++
  }

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'}  batch=${BATCH_LABEL}`)
  console.log(`source faqs read : ${rows.length}`)
  console.log(`qa rows to write : ${built.length}`)
  console.log(`skipped          : ${rows.length - built.length}`)
  console.log(`\nby source scope:`)
  for (const [k, v] of [...byScope].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${v}`)
  console.log(`\ntagging:`)
  console.log(`  tagged         : ${built.length - untagged}`)
  console.log(`  untagged       : ${untagged}  (these group under "General" on /questions)`)
  console.log(`  distinct tags  : ${byTag.size}`)
  console.log(`\ntop tags:`)
  for (const [k, v] of [...byTag].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${k.padEnd(24)} ${v}`)

  if (problems.length) {
    console.log(`\nnotes (${problems.length}):`)
    for (const p of problems.slice(0, 20)) console.log(`  ${p}`)
    if (problems.length > 20) console.log(`  ... and ${problems.length - 20} more`)
  }

  console.log(`\nsample rows:`)
  for (const b of built.slice(0, 5)) {
    console.log(`  /questions/${b.slug}`)
    console.log(`     Q: ${b.questionTitle.slice(0, 70)}`)
    console.log(`     tag: ${b.serviceTag ?? '(none)'}${b.cityTag ? ` | city: ${b.cityTag}` : ''}  answer: ${b.answerText.length} chars`)
  }

  const existing = await pool.query(`SELECT count(*)::int AS n FROM qa`)
  console.log(`\nqa table currently holds ${existing.rows[0].n} rows.`)

  if (!APPLY) {
    console.log(`\nNothing was written. Re-run with --apply to insert.\n`)
    await pool.end()
    return
  }

  // ── Write, batched multi-row upsert on qa_id ───────────────────────────────
  const CHUNK = 100
  let written = 0
  for (let i = 0; i < built.length; i += CHUNK) {
    const chunk = built.slice(i, i + CHUNK)
    const values: unknown[] = []
    const tuples = chunk.map((b, j) => {
      const o = j * 8
      values.push(b.qaId, b.slug, b.questionTitle, b.answerText, b.serviceTag, b.cityTag, 'answered', BATCH_LABEL)
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}::enum_qa_status, $${o + 8}, 'injectors_world'::enum_qa_source_platform, now(), now(), now())`
    })

    await pool.query(
      `INSERT INTO qa (qa_id, slug, question_title, answer_text, service_tag, city_tag, status, import_batch, source_platform, date, created_at, updated_at)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (qa_id) DO UPDATE SET
         slug           = EXCLUDED.slug,
         question_title = EXCLUDED.question_title,
         answer_text    = EXCLUDED.answer_text,
         service_tag    = EXCLUDED.service_tag,
         city_tag       = EXCLUDED.city_tag,
         status         = EXCLUDED.status,
         import_batch   = EXCLUDED.import_batch,
         updated_at     = now()`,
      values,
    )
    written += chunk.length
    console.log(`  wrote ${written}/${built.length}`)
  }

  const after = await pool.query(`SELECT count(*)::int AS n FROM qa`)
  console.log(`\nDone. qa table now holds ${after.rows[0].n} rows.`)
  console.log(`Next: npx tsx --env-file=.env.staging scripts/scan-pages.ts, then batch them in at /admin/indexing.\n`)

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
