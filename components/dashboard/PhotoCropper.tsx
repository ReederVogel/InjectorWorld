'use client'

import { useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { CROP_ASPECT, cropToBlob, openPhoto, workCanvas, type Area } from '@/lib/photo-crop'

/** Below this many source pixels across the crop, the stored photo is enlarged (16:9 is stored 1600 wide). */
const SMALL_WIDTH = 1200

const iconBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:opacity-40'

/**
 * Crop window for one owner photo, like a profile-picture crop: drag to frame,
 * zoom, turn in 90 degree steps. The frame is the clinic page's 16:9 unless
 * `aspect` says otherwise (before/after photos are square, stored 1080 wide).
 * `onDone` uploads; the window stays open, showing "Uploading...", until it settles.
 */
export function PhotoCropper({
  file,
  label,
  title = 'Crop your photo',
  aspect = CROP_ASPECT,
  smallBelow = SMALL_WIDTH,
  onCancel,
  onDone,
}: {
  file: File
  label?: string
  title?: string
  aspect?: number
  smallBelow?: number
  onCancel: () => void
  onDone: (blob: Blob) => Promise<void>
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [status, setStatus] = useState('Opening photo...')
  const [error, setError] = useState('')
  const [turns, setTurns] = useState(0)
  const [src, setSrc] = useState('')
  const sourceRef = useRef<HTMLCanvasElement | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    openPhoto(file, () => live && setStatus('Converting iPhone photo...'))
      .then((i) => live && setImg(i))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [file])

  // A fresh upright copy for each turn; the cropper reads it as a blob URL.
  useEffect(() => {
    if (!img) return
    const canvas = workCanvas(img, turns)
    sourceRef.current = canvas
    let live = true
    let url = ''
    canvas.toBlob(
      (b) => {
        if (!live) return
        if (!b) return setError('Could not open this photo. Try another one.')
        url = URL.createObjectURL(b)
        setSrc(url)
      },
      'image/jpeg',
      0.95,
    )
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [img, turns])

  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onCancel()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = before
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel, saving])

  async function confirmCrop() {
    if (!sourceRef.current || !area) return
    setSaving(true)
    setError('')
    try {
      await onDone(await cropToBlob(sourceRef.current, area, aspect))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const ready = Boolean(src)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title">
      <div className="w-full max-w-2xl rounded-control bg-surface-canvas p-4 shadow-lg sm:p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="photo-crop-title" className="text-h4 font-semibold text-ink-primary">{title}</h3>
          {label && <span className="text-caption text-ink-tertiary">{label}</span>}
        </div>

        {/* Always-dark stage: the photo is the only colour in it. */}
        <div className="relative h-64 w-full overflow-hidden rounded-control bg-[#0B1B34] sm:h-96">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-body-sm text-white">
              {error || status}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex flex-1 items-center gap-3 text-caption font-medium text-ink-secondary">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={!ready || saving}
              className="flex-1 accent-[#0B1B34]"
            />
          </label>
          <button type="button" onClick={() => setTurns((t) => t + 3)} disabled={!ready || saving} aria-label="Turn left" className={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 3 3 9 9 9" /></svg>
          </button>
          <button type="button" onClick={() => setTurns((t) => t + 1)} disabled={!ready || saving} aria-label="Turn right" className={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" /></svg>
          </button>
        </div>

        {ready && area && area.width < smallBelow && (
          <p className="mt-2 text-caption text-ink-tertiary">This photo is small, so it may look soft on your page.</p>
        )}
        {error && src && <p className="mt-2 text-caption text-[#B91C1C]">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            autoFocus
            className="rounded-control border border-border px-4 py-2 text-body-sm font-medium text-ink-secondary transition hover:text-ink-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmCrop}
            disabled={!ready || !area || saving}
            className="rounded-control bg-brand-primary px-4 py-2 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Uploading...' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
