import path from 'path'
import { importReviewsFromCsv, DEFAULT_REVIEW_BATCH_SIZE } from '../lib/import/review-import'

const DEFAULT_CSV_PATH = path.resolve('data/samples/reviews.csv')

type ImportOptions = {
  csvPath: string
  batchSize: number
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2)
  const argValue = (name: string) => {
    const prefix = `--${name}=`
    const hit = args.find((arg) => arg.startsWith(prefix))
    return hit ? hit.slice(prefix.length) : undefined
  }

  const positionalCsv = args.find((arg) => !arg.startsWith('--'))
  const csvPath = path.resolve(
    argValue('csv') ||
      argValue('path') ||
      process.env.REVIEWS_CSV_PATH ||
      process.env.REVIEWS_CSV ||
      positionalCsv ||
      DEFAULT_CSV_PATH,
  )
  const batchSize = Number(argValue('batch-size') || process.env.REVIEWS_BATCH_SIZE || DEFAULT_REVIEW_BATCH_SIZE)

  return {
    csvPath,
    batchSize: Number.isInteger(batchSize) && batchSize > 0 ? batchSize : DEFAULT_REVIEW_BATCH_SIZE,
  }
}

function maskedDatabaseUri(): string {
  return String(process.env.DATABASE_URI ?? '').replace(/:\/\/[^@]+@/, '://***:***@')
}

async function main() {
  const opts = parseArgs()

  if (!process.env.DATABASE_URI) {
    throw new Error('DATABASE_URI is required.')
  }

  console.log('[reviews] Import starting')
  console.log(`[reviews] CSV: ${opts.csvPath}`)
  console.log(`[reviews] Batch size: ${opts.batchSize}`)
  console.log(`[reviews] Database: ${maskedDatabaseUri()}`)

  const result = await importReviewsFromCsv(opts.csvPath, {
    batchSize: opts.batchSize,
    mode: 'auto',
    recomputeAggregates: true,
    log: (message) => console.log(message),
  })

  console.log('[reviews] Import complete')
  console.log(`[reviews] Created: ${result.counts.created.toLocaleString()}`)
  console.log(`[reviews] Updated: ${result.counts.updated.toLocaleString()}`)
  console.log(`[reviews] Skipped unmatched clinic_id: ${result.counts.skippedUnmatched.toLocaleString()}`)
  console.log(`[reviews] Skipped invalid rows: ${result.counts.skippedInvalid.toLocaleString()}`)
  console.log(`[reviews] Failed rows: ${result.counts.failed.toLocaleString()}`)
  console.log(`[reviews] Clinic aggregate rows updated: ${result.aggregateUpdates.toLocaleString()}`)

  if (result.errors.length > 0) {
    console.log(`[reviews] First ${result.errors.length} errors/warnings:`)
    for (const error of result.errors) {
      console.log(
        `[reviews] line=${error.line} reviewId=${error.reviewId ?? ''} sourceReviewId=${error.sourceReviewId ?? ''} clinicId=${error.clinicId ?? ''} reason=${error.reason}`,
      )
    }
  }
}

main().catch((err) => {
  console.error('[reviews] Import failed:')
  console.error(err)
  process.exit(1)
})
