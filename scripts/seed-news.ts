/**
 * Seeds 3 sample news articles.
 * Idempotent: skips existing slugs.
 * Run with: npx tsx --env-file=.env.local scripts/seed-news.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function seedNews() {
  console.log('\n===== seed-news =====\n')
  const payload = await getPayload({ config })

  // Need an author ID — grab the first author
  const authorsRes = await payload.find({ collection: 'authors', limit: 1, depth: 0 })
  const author = authorsRes.docs[0]
  if (!author) {
    console.error('No authors found. Run npm run seed first to create authors.')
    process.exit(1)
  }
  const authorId = author.id as number
  console.log(`Using author: ${(author as any).fullName} (id: ${authorId})`)

  const articles = [
    {
      title: 'FDA Accepts New Biostimulator Application for Long-Duration Collagen Restoration',
      slug: 'fda-accepts-biostimulator-collagen-restoration-2026',
      excerpt:
        'The FDA has accepted for review a new investigational new drug application for a next-generation biostimulator designed to restore collagen with effects lasting up to 36 months. Clinical data will be reviewed in Q3 2026.',
      category: 'regulation',
      status: 'published',
      publishedAt: '2026-06-10T09:00:00.000Z',
      featured: true,
    },
    {
      title: 'Allergan Reports 18% Growth in Botox Cosmetic Market Share in Q1 2026',
      slug: 'allergan-botox-cosmetic-market-growth-q1-2026',
      excerpt:
        'AbbVie, the parent company of Allergan Aesthetics, reported an 18% year-over-year increase in Botox Cosmetic revenue in Q1 2026, driven by growing demand among patients under 35 and expanded use for preventative treatments.',
      category: 'industry',
      status: 'published',
      publishedAt: '2026-06-08T10:00:00.000Z',
      featured: false,
    },
    {
      title: 'New Study Links Practitioner Credentials to Significantly Lower Complication Rates',
      slug: 'study-credentials-lower-complication-rates-2026',
      excerpt:
        'A multi-center study published in the Journal of Cosmetic Dermatology found that board-certified dermatologists and plastic surgeons reported complication rates 4.2 times lower than non-credentialed injectors performing the same procedures.',
      category: 'research',
      status: 'published',
      publishedAt: '2026-06-05T08:00:00.000Z',
      featured: false,
    },
  ]

  let created = 0
  let skipped = 0

  for (const article of articles) {
    const existing = await payload.find({
      collection: 'news',
      where: { slug: { equals: article.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.totalDocs > 0) {
      console.log(`  skip  ${article.slug}`)
      skipped++
      continue
    }

    await payload.create({
      collection: 'news',
      data: { ...article, author: authorId } as any,
    })
    console.log(`  created  ${article.slug}`)
    created++
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}`)
  process.exit(0)
}

seedNews().catch((err) => {
  console.error(err)
  process.exit(1)
})
