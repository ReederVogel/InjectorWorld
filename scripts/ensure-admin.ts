/**
 * One-off dev helper: make sure a local admin user exists with known creds so
 * the Payload admin can be opened locally. Local DB only. Safe to delete.
 *
 * Run: npx tsx --env-file=.env.local scripts/ensure-admin.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const EMAIL = 'admin@injectors.world' // the founder's intended admin (plural)
const PASSWORD = 'changme123'
const STRAY = 'admin@injector.world' // duplicate singular created by mistake; remove it

async function run() {
  const payload = await getPayload({ config })

  // 1. Reset the founder's admin password to known creds.
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    limit: 1,
  })
  if (existing.totalDocs > 0) {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { password: PASSWORD },
    })
    console.log(`Updated password for existing user: ${EMAIL}`)
  } else {
    await payload.create({
      collection: 'users',
      data: { email: EMAIL, password: PASSWORD, name: 'Site Admin', role: 'admin' },
    })
    console.log(`Created admin user: ${EMAIL}`)
  }

  // 2. Remove the stray duplicate created on the first run.
  const stray = await payload.find({
    collection: 'users',
    where: { email: { equals: STRAY } },
    limit: 1,
  })
  if (stray.totalDocs > 0) {
    await payload.delete({ collection: 'users', id: stray.docs[0].id })
    console.log(`Deleted stray duplicate: ${STRAY}`)
  }

  // Show the full user list so we know what is in the local DB.
  const all = await payload.find({ collection: 'users', limit: 50, depth: 0 })
  console.log(`\nUsers in local DB (${all.totalDocs}):`)
  for (const u of all.docs) {
    console.log(`  - ${(u as any).email}  role=${(u as any).role}`)
  }
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
