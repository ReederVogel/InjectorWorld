'use client'

import { useRef, useState } from 'react'
import { PhotoCropper } from './PhotoCropper'
import { SignedOutNotice } from './SignedOutNotice'
import { MAX_PICK_BYTES, PHOTO_ACCEPT } from '@/lib/photo-crop'
import { MAX_BEFORE_AFTER, weeksLabel, type CaseStatus, type OwnerCase } from '@/lib/before-after'

const STATUS: Record<CaseStatus, { label: string; className: string }> = {
  pending: { label: 'Pending review', className: 'bg-[#FEF3C7] text-[#92400E]' },
  approved: { label: 'Live on your page', className: 'bg-brand-accent-soft text-brand-accent' },
  rejected: { label: 'Not approved', className: 'bg-[#FEE2E2] text-[#991B1B]' },
}

const inputClass =
  'mt-1 w-full rounded-control border border-border bg-surface-canvas px-3 py-2 text-body text-ink-primary focus:border-ink-secondary focus:outline-none sm:text-body-sm'

type Which = 'before' | 'after'

/**
 * Owner's before and after cases: the list with each one's review status, and
 * (on Pro and Elite with billing active) a form to add a pair. Photos are cropped
 * square in the browser; nothing goes live until staff approve it.
 */
export function BeforeAfterManager({
  clinicId,
  initial,
  treatments,
  allowed,
}: {
  clinicId: number
  initial: OwnerCase[]
  treatments: string[]
  allowed: boolean
}) {
  const [cases, setCases] = useState<OwnerCase[]>(initial)
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<Record<Which, { blob: Blob; url: string } | null>>({ before: null, after: null })
  const [cropping, setCropping] = useState<{ which: Which; file: File } | null>(null)
  const [serviceTag, setServiceTag] = useState('')
  const [weeks, setWeeks] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const inputs = { before: useRef<HTMLInputElement>(null), after: useRef<HTMLInputElement>(null) }

  const atCap = cases.length >= MAX_BEFORE_AFTER
  const ready = Boolean(photo.before && photo.after && serviceTag.trim() && weeks !== '' && consent)

  function onPick(which: Which, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_PICK_BYTES) return setError('That photo is over 50 MB.')
    setError('')
    setCropping({ which, file })
  }

  function keep(which: Which, blob: Blob) {
    if (photo[which]) URL.revokeObjectURL(photo[which]!.url)
    const url = URL.createObjectURL(blob)
    setPhoto((p) => ({ ...p, [which]: { blob, url } }))
    setCropping(null)
    return Promise.resolve()
  }

  function reset() {
    for (const p of Object.values(photo)) if (p) URL.revokeObjectURL(p.url)
    setPhoto({ before: null, after: null })
    setServiceTag('')
    setWeeks('')
    setNote('')
    setConsent(false)
    setOpen(false)
  }

  async function submit() {
    if (!ready) return
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('before', photo.before!.blob, 'before.jpg')
      fd.append('after', photo.after!.blob, 'after.jpg')
      fd.append('serviceTag', serviceTag.trim())
      fd.append('weeksPost', weeks)
      if (note.trim()) fd.append('patientNote', note.trim())
      fd.append('consent', 'true')
      const res = await fetch(`/api/dashboard/before-after?clinic=${clinicId}`, { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) return setSignedOut(true)
      if (!res.ok) return setError(data.error || 'Upload failed. Please try again.')
      setCases((prev) => [data.case, ...prev])
      reset()
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(c: OwnerCase) {
    if (!window.confirm('Remove this before and after from your profile?')) return
    setError('')
    const res = await fetch(`/api/dashboard/before-after?clinic=${clinicId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
      credentials: 'include',
    }).catch(() => null)
    if (res?.status === 401) return setSignedOut(true)
    if (!res?.ok) return setError('Could not remove it. Please retry.')
    setCases((prev) => prev.filter((x) => x.id !== c.id))
  }

  return (
    <div>
      {cases.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {cases.map((c) => (
            <div key={c.id} className="rounded-control border border-border bg-surface p-3">
              <div className="grid grid-cols-2 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.beforeUrl} alt={`Before ${c.serviceTag}`} className="aspect-square w-full rounded-control object-cover" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.afterUrl} alt={`After ${c.serviceTag}`} className="aspect-square w-full rounded-control object-cover" />
              </div>
              <div className="mt-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-ink-primary">{c.serviceTag}</p>
                  <p className="text-caption text-ink-tertiary">{weeksLabel(c.weeksPost)}</p>
                </div>
                <span className={`shrink-0 rounded-control px-2 py-0.5 text-[11px] font-semibold ${STATUS[c.status].className}`}>
                  {STATUS[c.status].label}
                </span>
              </div>
              <button type="button" onClick={() => remove(c)} className="mt-2 text-caption text-ink-secondary underline hover:text-ink-primary">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!allowed ? (
        <p className="text-body-sm text-ink-secondary">
          Show real results from your patients, side by side. Before and after photos are part of the{' '}
          <a href="/pricing" className="font-medium text-brand-accent hover:underline">Pro and Elite plans</a>.
          {cases.length > 0 && ' The cases above stay saved but are hidden from your page until your plan is active.'}
        </p>
      ) : atCap ? (
        <p className="text-body-sm text-ink-secondary">You have {MAX_BEFORE_AFTER} cases, the most a profile can keep. Remove one to add another.</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-control border border-brand-primary px-4 py-2 text-body-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-surface-canvas"
        >
          Add a before and after
        </button>
      ) : (
        <div className="space-y-4 rounded-control border border-border bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            {(['before', 'after'] as const).map((which) => (
              <div key={which}>
                <button
                  type="button"
                  onClick={() => inputs[which].current?.click()}
                  disabled={busy}
                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-control border-2 border-dashed border-border text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:opacity-50"
                >
                  {photo[which] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo[which]!.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-control bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {which === 'before' ? 'Before' : 'After'}
                      </span>
                    </>
                  ) : (
                    <span className="text-caption font-medium">{which === 'before' ? 'Add before photo' : 'Add after photo'}</span>
                  )}
                </button>
                <input ref={inputs[which]} type="file" accept={PHOTO_ACCEPT} onChange={(e) => onPick(which, e)} className="hidden" />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-caption font-medium text-ink-secondary">
              Treatment
              <input list="before-after-treatments" value={serviceTag} onChange={(e) => setServiceTag(e.target.value)} maxLength={80} placeholder="For example: Lip Filler" className={inputClass} />
              <datalist id="before-after-treatments">
                {treatments.map((t) => <option key={t} value={t} />)}
              </datalist>
            </label>
            <label className="block text-caption font-medium text-ink-secondary">
              Weeks between the photos
              <input type="number" inputMode="numeric" min={0} max={520} value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder="For example: 2" className={inputClass} />
            </label>
          </div>
          <label className="block text-caption font-medium text-ink-secondary">
            Note (optional, shown under the photos)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="For example: 1 syringe, upper and lower lip" className={inputClass} />
          </label>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B1B34]" />
            <span className="text-body-sm text-ink-primary">
              I have this patient&apos;s written consent to show these photos publicly, and the photos are not edited, filtered or retouched.
            </span>
          </label>
          <p className="text-caption text-ink-tertiary">
            Our team checks every pair before it goes live. Your page notes that results vary from patient to patient.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={reset} disabled={busy} className="rounded-control border border-border px-4 py-2 text-body-sm font-medium text-ink-secondary transition hover:text-ink-primary disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={!ready || busy} className="rounded-control bg-brand-primary px-4 py-2 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 disabled:opacity-50">
              {busy ? 'Sending...' : 'Send for review'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-caption text-[#B91C1C]">{error}</p>}
      {signedOut && <div className="mt-3"><SignedOutNotice /></div>}
      {cropping && (
        <PhotoCropper
          key={`${cropping.which}-${cropping.file.name}-${cropping.file.lastModified}`}
          file={cropping.file}
          title={cropping.which === 'before' ? 'Crop the before photo' : 'Crop the after photo'}
          aspect={1}
          smallBelow={800}
          onCancel={() => setCropping(null)}
          onDone={(blob) => keep(cropping.which, blob)}
        />
      )}
    </div>
  )
}
