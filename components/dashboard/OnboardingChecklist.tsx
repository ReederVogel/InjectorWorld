'use client'

type Step = { label: string; done: boolean; hint: string }

export function OnboardingChecklist({
  hasPhoto,
  hasBio,
  hasTreatments,
  hasPrice,
  hasClinic,
}: {
  hasPhoto: boolean
  hasBio: boolean
  hasTreatments: boolean
  hasPrice: boolean
  hasClinic: boolean
}) {
  const steps: Step[] = [
    { label: 'Add a profile photo', done: hasPhoto, hint: 'A real headshot increases profile views significantly.' },
    { label: 'Write your bio', done: hasBio, hint: 'At least 2 sentences. Tell patients why they should choose you.' },
    { label: 'List treatments offered', done: hasTreatments, hint: 'Required for treatment-specific search results.' },
    { label: 'Set your starting price', done: hasPrice, hint: 'Even an estimate builds patient trust and improves ranking.' },
    { label: 'Connect your clinic', done: hasClinic, hint: 'Links your profile to a clinic page so patients can find your location.' },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length

  // Collapse once all steps are complete
  if (doneCount === total) return null

  const pct = Math.round((doneCount / total) * 100)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-body font-semibold text-ink-primary">Complete your profile</h2>
        <span className="text-body-sm text-ink-secondary">{doneCount} of {total} done</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-border rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-brand-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-3">
            {step.done ? (
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                className="text-brand-accent flex-shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <polyline points="7 12 10.5 15.5 17 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            ) : (
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                className="text-ink-tertiary flex-shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
            <span>
              <span className={`text-body-sm ${step.done ? 'line-through text-ink-tertiary' : 'text-ink-primary font-medium'}`}>
                {step.label}
              </span>
              {!step.done && (
                <span className="block text-caption text-ink-tertiary mt-0.5">{step.hint}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
