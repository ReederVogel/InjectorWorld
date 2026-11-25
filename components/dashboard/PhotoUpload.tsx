'use client'

import { useRef, useState } from 'react'
import { SignedOutNotice } from './SignedOutNotice'

/** One photo in the public gallery. `mediaId` marks the owner's own uploads, the only ones the plan limit counts. */
export type ClinicPhoto = { url: string; mediaId?: number }

/** A 401 from the upload route: the login cookie is gone. */
class SignedOutError extends Error {}

async function postFile(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('target', 'clinic')
  const res = await fetch('/api/dashboard/upload', { method: 'POST', body: fd, credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new SignedOutError()
  if (!res.ok) throw new Error(data.error || 'Upload failed.')
  return data as { url: string; id: number }
}

async function deletePhoto(photo: ClinicPhoto) {
  const res = await fetch('/api/dashboard/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    // An upload goes by its Media id, an imported photo by its URL.
    body: JSON.stringify(photo.mediaId ? { target: 'clinic', mediaId: photo.mediaId } : { target: 'clinic', url: photo.url }),
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new SignedOutError()
  if (!res.ok) throw new Error(data.error || 'Could not remove the photo.')
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'

export function ClinicPhotosUpload({ initial, maxPhotos = Infinity }: { initial: ClinicPhoto[]; maxPhotos?: number }) {
  const [photos, setPhotos] = useState<ClinicPhoto[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploaded = photos.filter((p) => p.mediaId).length
  const limited = isFinite(maxPhotos)
  const atLimit = limited && uploaded >= maxPhotos

  function fail(err: unknown) {
    if (err instanceof SignedOutError) setSignedOut(true)
    else setError((err as Error).message)
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError('')
    setBusy(true)
    let count = uploaded // local count: state does not update inside this loop
    try {
      for (const file of files) {
        if (limited && count >= maxPhotos) {
          setError(`Your plan allows ${maxPhotos} uploaded photo${maxPhotos === 1 ? '' : 's'}. Upgrade to add more.`)
          break
        }
        const { url, id } = await postFile(file)
        count++
        setPhotos((prev) => [...prev, { url, mediaId: id }])
      }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onRemove(photo: ClinicPhoto) {
    if (!window.confirm('Remove this photo from your public listing?')) return
    setError('')
    setBusy(true)
    try {
      await deletePhoto(photo)
      setPhotos((prev) => prev.filter((p) => p.url !== photo.url))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {photos.map((p) => (
          <div key={p.url} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border bg-surface group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="Clinic photo" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(p)}
              disabled={busy}
              aria-label="Remove photo"
              // Always visible on touch screens, which have no hover.
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition disabled:opacity-50"
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
      <div className="flex items-start justify-between gap-4">
        <p className="text-caption text-ink-tertiary">
          JPG, PNG, or WebP, up to 8 MB each. The first photo is your cover.
          {limited && ' Photos already on your listing do not count toward your plan.'}
        </p>
        {limited && (
          <p className="text-caption text-ink-tertiary flex-shrink-0">
            {uploaded}/{maxPhotos} uploads used
            {atLimit && (
              <a href="/pricing" className="ml-1.5 text-brand-accent hover:underline">Upgrade for more</a>
            )}
          </p>
        )}
      </div>
      {error && <p className="text-caption text-[#B91C1C] mt-2">{error}</p>}
      {signedOut && <div className="mt-3"><SignedOutNotice /></div>}
    </div>
  )
}
