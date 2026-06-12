/**
 * notify-go-live.ts
 *
 * Sends the "your city is live" email to all confirmed city-waitlist subscribers
 * for a given state code. Run this AFTER setting a market live.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/notify-go-live.ts TX
 *   npx tsx --env-file=.env.local scripts/notify-go-live.ts TX --dry-run
 *
 * Only sends to confirmed + city-waitlist + not-yet-notified subscribers for
 * the given stateCode. Sets notified=true after each successful send.
 * RESEND_API_KEY must be set for real emails (console log otherwise).
 */

import { getPayload } from 'payload'
import { default as config } from '../payload.config'
import { sendGoLiveEmail } from '../lib/newsletter-email'

async function run() {
  const args = process.argv.slice(2)
  const stateCode = args.find((a) => !a.startsWith('--'))?.toUpperCase()
  const dryRun = args.includes('--dry-run')

  if (!stateCode || stateCode.length !== 2) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/notify-go-live.ts <STATE_CODE> [--dry-run]')
    console.error('Example: npx tsx --env-file=.env.local scripts/notify-go-live.ts TX')
    process.exit(1)
  }

  const payload = await getPayload({ config })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // Find all confirmed city-waitlist subscribers in this state that have not been notified yet
  const result = await payload.find({
    collection: 'subscribers',
    where: {
      and: [
        { status: { equals: 'confirmed' } },
        { interestType: { equals: 'city-waitlist' } },
        { stateCode: { equals: stateCode } },
        { notified: { equals: false } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  })

  console.log(`[notify-go-live] ${stateCode}: found ${result.totalDocs} unnotified confirmed waitlist subscribers`)

  if (result.totalDocs === 0) {
    console.log('[notify-go-live] Nothing to send. Done.')
    process.exit(0)
  }

  if (dryRun) {
    console.log('[notify-go-live] DRY RUN: would send to:')
    for (const sub of result.docs as any[]) {
      console.log(`  ${sub.email} (city: ${sub.cityTag || 'unknown'})`)
    }
    process.exit(0)
  }

  let sent = 0
  let failed = 0

  for (const sub of result.docs as any[]) {
    const cityLabel = sub.cityTag || stateCode
    const citySlug = cityLabel.toLowerCase().replace(/\s+/g, '-')
    const cityUrl = `${siteUrl}/botox/${citySlug}-${stateCode.toLowerCase()}`
    const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${sub.confirmToken}`

    try {
      await sendGoLiveEmail({
        to: sub.email,
        name: sub.name,
        cityLabel,
        cityUrl,
        unsubscribeUrl,
      })

      await payload.update({
        collection: 'subscribers',
        id: sub.id,
        overrideAccess: true,
        data: { notified: true } as any,
      })

      sent++
      console.log(`[notify-go-live] Sent to ${sub.email} (${cityLabel})`)
    } catch (err) {
      failed++
      console.error(`[notify-go-live] Failed to send to ${sub.email}:`, (err as Error)?.message)
    }
  }

  console.log(`\n[notify-go-live] Done. Sent: ${sent}, Failed: ${failed}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[notify-go-live] Fatal error:', err)
  process.exit(1)
})
