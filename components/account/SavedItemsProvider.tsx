'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useSession } from './SessionContext'

/**
 * Single source of truth for saved providers + clinics across the app.
 *
 * Anonymous visitors: saves live in localStorage (keys iw_saved_providers /
 * iw_saved_clinics). Logged-in users: saves persist to Users.savedProviders /
 * savedClinics via /api/account/save. On login, any anonymous localStorage
 * saves are merged into the account once, then cleared.
 *
 * Session data (auth + saved IDs) comes from SessionContext which fetches
 * /api/account/me once. This provider does NOT make its own auth request.
 */

type SavedType = 'provider' | 'clinic'

type SavedContextValue = {
  ready: boolean
  loggedIn: boolean
  savedProviders: Set<string>
  savedClinics: Set<string>
  isSaved: (type: SavedType, id: string) => boolean
  toggle: (type: SavedType, id: string) => void
}

const SavedContext = createContext<SavedContextValue | null>(null)

const LS_PROVIDERS = 'iw_saved_providers'
const LS_CLINICS = 'iw_saved_clinics'

function readLS(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

function writeLS(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    /* storage unavailable; ignore */
  }
}

export function SavedItemsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: sessionLoading } = useSession()
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set())
  const [savedClinics, setSavedClinics] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (sessionLoading) return

    const lsP = new Set(readLS(LS_PROVIDERS))
    const lsC = new Set(readLS(LS_CLINICS))

    if (!user) {
      setLoggedIn(false)
      setSavedProviders(lsP)
      setSavedClinics(lsC)
      setReady(true)
      return
    }

    setLoggedIn(true)
    const accP = new Set<string>(user.savedProviders)
    const accC = new Set<string>(user.savedClinics)
    const mergeP = [...lsP].filter((id) => !accP.has(id))
    const mergeC = [...lsC].filter((id) => !accC.has(id))

    if (!mergeP.length && !mergeC.length) {
      setSavedProviders(accP)
      setSavedClinics(accC)
      setReady(true)
      return
    }

    let active = true
    fetch('/api/account/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'merge', providers: mergeP, clinics: mergeC }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!active) return
        if (j?.success) {
          setSavedProviders(new Set<string>(j.savedProviders))
          setSavedClinics(new Set<string>(j.savedClinics))
        } else {
          setSavedProviders(accP)
          setSavedClinics(accC)
        }
      })
      .catch(() => {
        if (active) {
          setSavedProviders(accP)
          setSavedClinics(accC)
        }
      })
      .finally(() => {
        if (active) {
          try {
            localStorage.removeItem(LS_PROVIDERS)
            localStorage.removeItem(LS_CLINICS)
          } catch {
            /* ignore */
          }
          setReady(true)
        }
      })

    return () => {
      active = false
    }
  }, [user, sessionLoading])

  const toggle = useCallback(
    (type: SavedType, id: string) => {
      const sid = String(id)
      const setState = type === 'provider' ? setSavedProviders : setSavedClinics
      const lsKey = type === 'provider' ? LS_PROVIDERS : LS_CLINICS
      setState((prev) => {
        const next = new Set(prev)
        if (next.has(sid)) next.delete(sid)
        else next.add(sid)
        if (loggedIn) {
          fetch('/api/account/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'toggle', type, id: sid }),
          }).catch(() => {})
        } else {
          writeLS(lsKey, next)
        }
        return next
      })
    },
    [loggedIn],
  )

  const isSaved = useCallback(
    (type: SavedType, id: string) =>
      type === 'provider' ? savedProviders.has(String(id)) : savedClinics.has(String(id)),
    [savedProviders, savedClinics],
  )

  return (
    <SavedContext.Provider
      value={{ ready, loggedIn, savedProviders, savedClinics, isSaved, toggle }}
    >
      {children}
    </SavedContext.Provider>
  )
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext)
  if (!ctx) {
    return {
      ready: false,
      loggedIn: false,
      savedProviders: new Set(),
      savedClinics: new Set(),
      isSaved: () => false,
      toggle: () => {},
    }
  }
  return ctx
}
