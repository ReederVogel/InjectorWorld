import { HeaderClient } from './HeaderClient'

export type SessionUser = {
  id: number
  name?: string | null
  email: string
  role?: string | null
}

export async function Header() {
  return <HeaderClient user={null} />
}

