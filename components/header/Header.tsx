import { headers } from 'next/headers'
import { getPayloadInstance } from '@/lib/payload-server'
import { HeaderClient } from './HeaderClient'

export type SessionUser = {
  id: number
  name?: string | null
  email: string
  role?: string | null
}

export async function Header() {
  let user: SessionUser | null = null

  try {
    const headersList = await headers()
    const payload = await getPayloadInstance()
    const { user: authUser } = await payload.auth({ headers: headersList })
    if (authUser) {
      user = {
        id: authUser.id,
        name: (authUser as any).name ?? null,
        email: authUser.email,
        role: (authUser as any).role ?? null,
      }
    }
  } catch {
    // Not authenticated — that's fine
  }

  return <HeaderClient user={user} />
}
