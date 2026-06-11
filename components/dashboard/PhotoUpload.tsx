'use client'

import { useRef, useState } from 'react'

/* Shared upload helpers ---------------------------------------------------- */

async function postFile(file: File, target: 'provider' | 'clinic') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('target', target)
  const res = await fetch('/api/dashboard/upload', { method: 'POST', body: fd, credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed.')
  return data as { url: string; id?: number }
}

async function deletePhoto(target: 'provider' | 'clinic', mediaId?: number) {
  const res = await fetch('/api/dashboard/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, mediaId }),
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not remove the photo.')
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'

/* Provider headshot (single) ---------------------------------------------- */

export function ProviderHeadshotUpload({ initialUrl }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const { url: newUrl } = await postFile(file, 'provider')
      setUrl(newUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onRemove() {
    setError('')
    setBusy(true)
    try {
      await deletePhoto('provider')
      setUrl('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="block text-body-sm font-medium text-ink-primary mb-1.5">Profile photo</label>
      <p className="text-caption text-ink-tertiary mb-3">
        Upload a clear, professional headshot. JPG, PNG, or WebP, up to 8 MB.
      </p>

      <div className="flex items-center gap-5">
        <div className="h-24 w-24 flex-shrink-0 rounded-full overflow-hidden border border-border bg-surface">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Your headshot" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-ink-tertiary">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" id="headshot-input" />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="bg-brand-primary text-surface-canvas rounded-pill px-5 py-2.5 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50 w-fit"
          >
            {busy ? 'Uploading...' : url ? 'Replace photo' : 'Upload photo'}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={onRemove}
              className="text-body-sm text-ink-secondary hover:text-[#B91C1C] transition w-fit"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-caption text-[#B91C1C] mt-2">{error}</p>}
    </div>
  )
}

/* Clinic gallery (many) ---------------------------------------------------- */

export type ClinicPhoto = { id: number; url: string }

export function ClinicPhotosUpload({ initial, maxPhotos = Infinity }: { initial: ClinicPhoto[]; maxPhotos?: number }) {
  const [photos, setPhotos] = useState<ClinicPhoto[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const atLimit = isFinite(maxPhotos) && photos.length >= maxPhotos

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError('')
    setBusy(true)
    try {
      for (const file of files) {
        if (isFinite(maxPhotos) && photos.length >= maxPhotos) {
          setError(`Your plan allows up to ${maxPhotos} clinic photos. Upgrade to add more.`)
          break
        }
        const { url, id } = await postFile(file, 'clinic')
        if (id) setPhotos((prev) => [...prev, { id, url }])
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onRemove(id: number) {
    setError('')
    setBusy(true)
    try {
      await deletePhoto('clinic', id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border bg-surface group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="Clinic photo" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              disabled={busy}
              aria-label="Remove photo"
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="aspect-[4/3] rounded-lg border-2 border-dashed border-border text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span className="text-caption font-medium">{busy ? 'Uploading...' : 'Add photo'}</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={onPick} className="hidden" />
      <div className="flex items-center justify-between">
        <p className="text-caption text-ink-tertiary">JPG, PNG, or WebP, up to 8 MB each. The first photo is used as the cover.</p>
        {isFinite(maxPhotos) && (
          <p className="text-caption text-ink-tertiary ml-4 flex-shrink-0">
            {photos.length}/{maxPhotos} photos
            {atLimit && (
              <a href="/pricing" className="ml-1.5 text-brand-accent hover:underline">Upgrade for more</a>
            )}
          </p>
        )}
      </div>
      {error && <p className="text-caption text-[#B91C1C] mt-2">{error}</p>}
    </div>
  )
}
