import { CardNavClient } from './CardNavClient'
import { getNavLeadNews } from '@/lib/news-queries'
import { navLeadFallback } from '@/lib/site-nav'

export type SessionUser = {
  id: number
  name?: string | null
  email: string
  role?: string | null
}

export async function Header() {
  const lead = (await getNavLeadNews()) ?? navLeadFallback
  return <CardNavClient user={null} lead={lead} />
}
