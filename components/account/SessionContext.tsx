'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type SessionUser = {
  id: number
  name: string | null
  email: string
  role: string | null
  savedProviders: string[]
  savedClinics: string[]
}

type SessionData = {
  user: SessionUser | null
  loading: boolean
}

const SessionContext = createContext<SessionData>({ user: null, loading: true })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/account/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        if (data?.user) {
          const u = data.user
          setUser({
            id: u.id,
            name: u.name ?? null,
            email: u.email,
            role: u.role ?? null,
            savedProviders: Array.isArray(u.savedProviders) ? u.savedProviders.map(String) : [],
            savedClinics: Array.isArray(u.savedClinics) ? u.savedClinics.map(String) : [],
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return <SessionContext.Provider value={{ user, loading }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionData {
  return useContext(SessionContext)
}
