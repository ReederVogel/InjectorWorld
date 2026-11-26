'use client'

import { useRef, useState } from 'react'
import { MAX_PHOTOS as PAGE_MAX } from '@/components/clinics/ClinicCoverPhoto'
import { SignedOutNotice } from './SignedOutNotice'
import { PhotoCropper } from './PhotoCropper'
import { MAX_PICK_BYTES, PHOTO_ACCEPT } from '@/lib/photo-crop'

/** One photo in the public gallery. `mediaId` marks the owner's own uploads, the only ones the plan limit counts. */
export type ClinicPhoto = { url: string; mediaId?: number }

/** A 401 from the upload route: the login cookie is gone. */
class SignedOutError extends Error {}

async function call(clinicId: number, method: 'POST' | 'DELETE' | 'PATCH', body: FormData | object, fallback: string) {
  const isForm = body instanceof FormData
  const res = await fetch(`/api/dashboard/upload?clinic=${clinicId}`, {
    method,
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new SignedOutError()
  if (!res.ok) throw new Error(data.error || fallback)
  return data
}


const roundBtn =
  'flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:opacity-40'

export function ClinicPhotosUpload({ clinicId, initial, maxPhotos = Infinity }: { clinicId: number; initial: ClinicPhoto[]; maxPhotos?: number }) {
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

  // Picked files wait here and go through the crop window one at a time; uploads stay
  // sequential because each one rewrites the clinic's photo list.
  const [queue, setQueue] = useState<File[]>([])
  const [queueTotal, setQueueTotal] = useState(0)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (inputRef.current) inputRef.current.value = ''
    if (!files.length) return
    setError('')
    const room = limited ? Math.max(0, maxPhotos - uploaded) : files.length
    const openable = files.filter((f) => f.size <= MAX_PICK_BYTES)
    if (openable.length < files.length) setError('A photo over 50 MB was skipped.')
    else if (files.length > room) setError(`Your plan allows ${maxPhotos} uploaded photo${maxPhotos === 1 ? '' : 's'}. Upgrade to add more.`)
    const next = openable.slice(0, room)
    setQueue(next)
    setQueueTotal(next.length)
  }

  async function uploadCropped(blob: Blob) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'photo.jpg')
      fd.append('target', 'clinic')
      const { url, id } = await call(clinicId, 'POST', fd, 'Upload failed.')
      // The server puts a new upload first (the cover); mirror that here.
      setPhotos((prev) => [{ url, mediaId: id }, ...prev])
      setQueue((q) => q.slice(1))
    } catch (err) {
      fail(err)
      setQueue([])
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(photo: ClinicPhoto) {
    if (!window.confirm('Remove this photo from your public listing?')) return
    setError('')
    setBusy(true)
    try {
      // An upload goes by its Media id, an imported photo by its URL.
      await call(clinicId, 'DELETE', photo.mediaId ? { target: 'clinic', mediaId: photo.mediaId } : { target: 'clinic', url: photo.url }, 'Could not remove the photo.')
      setPhotos((prev) => prev.filter((p) => p.url !== photo.url))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  /** Moves one photo and saves the whole order right away; puts it back if the save fails. */
  async function move(from: number, to: number) {
    if (to < 0 || to >= photos.length || to === from) return
    const before = photos
    const next = [...photos]
    const [photo] = next.splice(from, 1)
    next.splice(to, 0, photo)
    setPhotos(next)
    setError('')
    setBusy(true)
    try {
      await call(clinicId, 'PATCH', { target: 'clinic', order: next.map((p) => p.url) }, 'Could not save the new order.')
    } catch (err) {
      setPhotos(before)
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4 mb-4">
        {photos.map((p, i) => (
          <div key={p.url} className="space-y-1.5">
            <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-surface group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Clinic photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded-control bg-brand-primary px-2 py-0.5 text-[11px] font-semibold text-surface-canvas">
                  Cover
                </span>
              )}
              {i >= PAGE_MAX && (
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
                  Not shown on your page
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(p)}
                disabled={busy}
                aria-label={`Remove photo ${i + 1}`}
                // Always visible on touch screens, which have no hover.
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="flex items-center justify-between gap-1">
              <button type="button" onClick={() => move(i, i - 1)} disabled={busy || i === 0} aria-label={`Move photo ${i + 1} earlier`} className={roundBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {i === 0 ? (
                <span className="text-caption text-ink-tertiary">Cover photo</span>
              ) : (
                <button type="button" onClick={() => move(i, 0)} disabled={busy} className="text-caption font-medium text-ink-secondary underline hover:text-ink-primary disabled:opacity-50">
                  Make cover
                </button>
              )}
              <button type="button" onClick={() => move(i, i + 1)} disabled={busy || i === photos.length - 1} aria-label={`Move photo ${i + 1} later`} className={roundBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="aspect-video rounded-lg border-2 border-dashed border-border text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span className="text-caption font-medium">{busy ? 'Saving...' : 'Add photo'}</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} multiple onChange={onPick} className="hidden" />
      <div className="flex items-start justify-between gap-4">
        <p className="text-caption text-ink-tertiary">
          The first photo is your cover, and your page shows the first {PAGE_MAX}. A new upload becomes the cover.
          Changes show on your page within a few minutes. Any photo works, iPhone photos included: you frame
          each one to the page&apos;s wide shape before it uploads.
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
      {queue[0] && (
        <PhotoCropper
          key={queueTotal - queue.length}
          file={queue[0]}
          label={queueTotal > 1 ? `Photo ${queueTotal - queue.length + 1} of ${queueTotal}` : undefined}
          onCancel={() => setQueue((q) => q.slice(1))}
          onDone={uploadCropped}
        />
      )}
    </div>
  )
}
