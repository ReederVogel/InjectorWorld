import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

/**
 * Cached Payload instance per Node process. Safe to call from server components.
 * In dev with HMR, the cache resets on file change.
 */
let cached: Payload | null = null

export async function getPayloadInstance(): Promise<Payload> {
  if (cached) return cached
  cached = await getPayload({ config })
  return cached
}
