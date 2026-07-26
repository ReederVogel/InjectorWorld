/**
 * Seed run: convert the editorial-authored body.internalLinks[] from the
 * original handoff JSON (label + path, target already known) into
 * InternalLinkSuggestions rows -- one OpenRouter/Kimi K3 call per source
 * document (not per link) asking it to pick an exact, already-existing
 * anchor phrase from that document's own paragraphs for each of its links.
 * Never invents anchor text; if the model can't find a natural spot, or
 * the returned text isn't a verbatim match, the link is skipped and logged.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-internal-links.ts [--dry-run] [--limit=N]
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '../payload.config'
import { callOpenRouter, extractJson } from '../lib/internal-links/openrouter'
import { listParagraphTexts } from '../lib/internal-links/insert-link'

const GUIDES_DIR = 'C:/Users/risha/AppData/Local/Temp/iw-guides-check/json'
const NEWS_DIR = 'C:/Users/risha/AppData/Local/Temp/iw-news-check/json'
const SITE_URL = 'https://www.injector.world'

type EditorialLink = { label: string; path: string }
type ResolvedLink = {
  label: string
  targetType: string
  targetSlug: string
  targetUrl: string
  targetTitle: string
  targetExcerpt?: string
}

function parseTarget(linkPath: string): { type: 'guide' | 'news' | 'brand' | 'service'; slug: string } | null {
  const m = linkPath.match(/^\/(guides|news|brands|services)\/([a-z0-9-]+)/)
  if (!m) return null
  const map = { guides: 'guide', news: 'news', brands: 'brand', services: 'service' } as const
  return { type: map[m[1] as keyof typeof map], slug: m[2] }
}

async function resolveTarget(
  payload: any,
  type: string,
  slug: string,
): Promise<{ title: string; excerpt?: string } | null> {
  const collectionMap: Record<string, string> = { guide: 'guides', news: 'news', brand: 'brands', service: 'services' }
  const collection = collectionMap[type]
  const titleField = collection === 'brands' || collection === 'services' ? 'name' : 'title'
  const res = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  const doc = res.docs[0]
  if (!doc) return null
  const excerpt = doc.excerpt || doc.shortDescription || doc.tagline || doc.lede || undefined
  return { title: doc[titleField], excerpt }
}

async function main() {
  const payload = await getPayload({ config })
  const dryRun = process.argv.includes('--dry-run')
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity

  let created = 0
  let skipped = 0
  let processed = 0

  async function processDoc(collectionSlug: 'guides' | 'news', slug: string, editorialLinks: EditorialLink[]) {
    if (editorialLinks.length === 0) return

    const res = await payload.find({ collection: collectionSlug, where: { slug: { equals: slug } }, limit: 1, depth: 0 })
    const doc = res.docs[0]
    if (!doc) {
      console.log(`  [skip] ${collectionSlug}/${slug}: source doc not found`)
      skipped += editorialLinks.length
      return
    }

    const paragraphs = listParagraphTexts(doc.body)
    if (paragraphs.length === 0) {
      console.log(`  [skip] ${collectionSlug}/${slug}: no paragraphs`)
      skipped += editorialLinks.length
      return
    }

    const resolvedLinks: ResolvedLink[] = []
    for (const link of editorialLinks) {
      const parsed = parseTarget(link.path)
      if (!parsed) {
        console.log(`  [skip-link] ${link.path}: unrecognized route pattern`)
        skipped++
        continue
      }
      const target = await resolveTarget(payload, parsed.type, parsed.slug)
      if (!target) {
        console.log(`  [skip-link] ${link.path}: target not found in ${parsed.type}s`)
        skipped++
        continue
      }
      resolvedLinks.push({
        label: link.label,
        targetType: parsed.type,
        targetSlug: parsed.slug,
        targetUrl: `${SITE_URL}${link.path}`,
        targetTitle: target.title,
        targetExcerpt: target.excerpt,
      })
    }
    if (resolvedLinks.length === 0) return

    const messages = [
      {
        role: 'system' as const,
        content:
          'You place inline hyperlinks into existing article text. You are given numbered paragraphs from an article and a list of links to place. For each link, pick a SHORT EXACT substring (3-8 words) that appears VERBATIM in one of the given paragraphs, and would make sense as clickable anchor text pointing to that link\'s target. Never invent text that is not already in the paragraphs -- copy it exactly, including punctuation and case. If no paragraph has suitable text for a link, set anchorText to null for that one. Reply with strict JSON only, no prose, no markdown fences: {"placements": [{"label": "...", "anchorText": "exact substring or null", "reasoning": "one short sentence"}]}',
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          articleTitle: doc.title,
          paragraphs: paragraphs.map((p, i) => `[${i}] ${p}`),
          linksToPlace: resolvedLinks.map((l) => ({ label: l.label, targetTitle: l.targetTitle, targetType: l.targetType })),
        }),
      },
    ]

    let placements: { label: string; anchorText: string | null; reasoning: string }[]
    try {
      const raw = await callOpenRouter(messages, { jsonMode: true, temperature: 0.1 })
      const parsed = extractJson<{ placements: typeof placements }>(raw)
      placements = parsed.placements ?? []
    } catch (err: any) {
      console.log(`  [error] ${collectionSlug}/${slug}: OpenRouter call failed: ${err?.message}`)
      skipped += resolvedLinks.length
      return
    }

    for (const link of resolvedLinks) {
      const placement = placements.find((p) => p.label === link.label)
      if (!placement || !placement.anchorText) {
        console.log(`  [no-anchor] ${collectionSlug}/${slug}: no placement for "${link.label}"`)
        skipped++
        continue
      }
      const existsVerbatim = paragraphs.some((p) => p.includes(placement.anchorText as string))
      if (!existsVerbatim) {
        console.log(`  [invalid-anchor] ${collectionSlug}/${slug}: "${placement.anchorText}" not found verbatim, skipping`)
        skipped++
        continue
      }

      if (!dryRun) {
        await payload.create({
          collection: 'internal-link-suggestions',
          data: {
            source: { relationTo: collectionSlug, value: doc.id },
            anchorText: placement.anchorText,
            targetType: link.targetType,
            targetSlug: link.targetSlug,
            targetUrl: link.targetUrl,
            targetTitle: link.targetTitle,
            targetExcerpt: link.targetExcerpt,
            reasoning: placement.reasoning,
            origin: 'editorial-seed',
            status: 'pending',
          } as any,
          overrideAccess: true,
        })
      }
      created++
      console.log(`  [ok] ${collectionSlug}/${slug}: "${placement.anchorText}" -> ${link.targetUrl}`)
    }
  }

  const guideFiles = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.json'))
  for (const file of guideFiles) {
    if (processed >= limit) break
    const raw = JSON.parse(fs.readFileSync(path.join(GUIDES_DIR, file), 'utf8'))
    const item = raw.items?.[0]
    if (!item?.slug) continue
    console.log(`\n=== guides/${item.slug} ===`)
    await processDoc('guides', item.slug, item.body?.internalLinks ?? [])
    processed++
  }

  const newsFiles = fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith('.json'))
  for (const file of newsFiles) {
    if (processed >= limit) break
    const raw = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, file), 'utf8'))
    const item = raw.item
    if (!item?.slug) continue
    console.log(`\n=== news/${item.slug} ===`)
    await processDoc('news', item.slug, item.body?.internalLinks ?? [])
    processed++
  }

  console.log(`\n===== Done: ${created} suggestions created, ${skipped} skipped (dryRun=${dryRun}) =====`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
