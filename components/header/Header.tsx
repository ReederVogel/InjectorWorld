import { CardNavClient } from './CardNavClient'

export type SessionUser = {
  id: number
  name?: string | null
  email: string
  role?: string | null
}

export async function Header() {
  return <CardNavClient user={null} />
}
