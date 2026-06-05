'use client'

import { useState } from 'react'
import Link from 'next/link'

type Step = 1 | 2 | 3
type Concern = 'lines' | 'volume' | 'jaw' | 'skin'
type Area = 'forehead' | 'lips' | 'cheeks' | 'jawline' | 'undereye' | 'full'
type Goal = 'subtle' | 'noticeable' | 'gradual' | 'lasting'

type Answers = {
  concern?: Concern
  area?: Area
  goal?: Goal
}

type Recommendation = {
  title: string
  slug: string
  why: string
  cta: string
}

function getRecommendation(answers: Answers): Recommendation[] {
  const { concern, area, goal } = answers

  // Lines / wrinkles
  if (concern === 'lines') {
    if (area === 'forehead') {
      const slug = goal === 'lasting' ? 'daxxify' : 'botox'
      return [
        {
          title: goal === 'lasting' ? 'Daxxify' : 'Botox',
          slug,
          why: 'Neurotoxins like Botox and Daxxify are the standard of care for forehead lines and crow\'s feet. They temporarily relax the muscles that cause the lines.',
          cta: `Find a ${goal === 'lasting' ? 'Daxxify' : 'Botox'} provider`,
        },
      ]
    }
    if (area === 'undereye') {
      return [
        {
          title: 'Tear Trough Filler',
          slug: 'tear-trough',
          why: 'Under-eye hollowing creates a shadow that looks like dark circles. Tear trough filler places a small amount of hyaluronic acid beneath the eye to soften this shadow.',
          cta: 'Find a tear trough provider',
        },
        {
          title: 'Botox (light crow\'s feet)',
          slug: 'botox',
          why: 'If the lines are at the outer corner of the eye rather than underneath, a conservative amount of Botox can help.',
          cta: 'Find a Botox provider',
        },
      ]
    }
    if (area === 'jawline') {
      return [
        {
          title: 'Masseter Botox',
          slug: 'masseter-botox',
          why: 'If you clench or grind your teeth, masseter Botox relaxes the jaw muscle to both slim the face and relieve tension.',
          cta: 'Find a masseter Botox provider',
        },
      ]
    }
    return [
      {
        title: 'Botox',
        slug: 'botox',
        why: 'Botox is the most effective treatment for dynamic lines caused by muscle movement. It\'s temporary, reversible, and the most studied aesthetic treatment available.',
        cta: 'Find a Botox provider',
      },
    ]
  }

  // Volume / structure
  if (concern === 'volume') {
    if (area === 'lips') {
      return [
        {
          title: 'Lip Filler',
          slug: 'lip-filler',
          why: 'Hyaluronic acid lip filler adds hydration, definition, or volume depending on your goal. It\'s reversible and lasts 6 to 9 months.',
          cta: 'Find a lip filler provider',
        },
      ]
    }
    if (area === 'cheeks') {
      if (goal === 'gradual' || goal === 'lasting') {
        return [
          {
            title: 'Sculptra',
            slug: 'sculptra',
            why: 'Sculptra builds your own collagen over months. The result looks natural, develops gradually, and lasts 2 to 3 years.',
            cta: 'Find a Sculptra provider',
          },
          {
            title: 'Cheek Filler',
            slug: 'cheek-filler',
            why: 'HA filler placed deep on the cheekbone gives immediate volume and a lift effect. Results last 12 to 18 months.',
            cta: 'Find a cheek filler provider',
          },
        ]
      }
      return [
        {
          title: 'Cheek Filler',
          slug: 'cheek-filler',
          why: 'Hyaluronic acid filler placed on the cheekbone restores volume and creates a subtle lift effect. Immediate results, lasts 12 to 18 months.',
          cta: 'Find a cheek filler provider',
        },
      ]
    }
    if (area === 'jawline') {
      return [
        {
          title: 'Jawline Filler',
          slug: 'jawline-filler',
          why: 'Filler along the mandible adds definition and projection to the jawline. It sharpens the angle and improves the side profile.',
          cta: 'Find a jawline filler provider',
        },
      ]
    }
    return [
      {
        title: 'Cheek Filler',
        slug: 'cheek-filler',
        why: 'Mid-face volume loss is one of the earliest signs of aging. Cheek filler restores the contour and lifts the lower face.',
        cta: 'Find a cheek filler provider',
      },
    ]
  }

  // Jaw / TMJ
  if (concern === 'jaw') {
    return [
      {
        title: 'Masseter Botox',
        slug: 'masseter-botox',
        why: 'Masseter Botox relaxes the jaw muscle, reducing both its width and the force of clenching. It is a well-supported treatment for TMJ and bruxism.',
        cta: 'Find a masseter Botox provider',
      },
    ]
  }

  // Skin / texture
  if (concern === 'skin') {
    return [
      {
        title: 'Microneedling',
        slug: 'microneedling',
        why: 'Microneedling triggers your skin\'s repair response through controlled micro-injury. It improves texture, tone, and fine lines over a series of sessions.',
        cta: 'Find a microneedling provider',
      },
      {
        title: 'PRP Therapy',
        slug: 'prp',
        why: 'PRP uses your own platelet-rich plasma to stimulate collagen and improve skin quality. Often combined with microneedling.',
        cta: 'Find a PRP provider',
      },
    ]
  }

  return [
    {
      title: 'Botox',
      slug: 'botox',
      why: 'Botox is the most studied and widely performed aesthetic injectable. It\'s a good starting point for most concerns.',
      cta: 'Find a Botox provider',
    },
  ]
}

const CONCERNS: Array<{ value: Concern; label: string; desc: string }> = [
  { value: 'lines', label: 'Lines and wrinkles', desc: 'Forehead, crow\'s feet, 11s, or other expression lines' },
  { value: 'volume', label: 'Volume and structure', desc: 'Lips, cheeks, jawline, chin, or under-eye hollowing' },
  { value: 'jaw', label: 'Jaw and TMJ', desc: 'Jaw clenching, teeth grinding, or wanting a slimmer jaw' },
  { value: 'skin', label: 'Skin texture', desc: 'Uneven tone, pores, scars, or overall skin quality' },
]

const AREAS: Record<Concern, Array<{ value: Area; label: string }>> = {
  lines: [
    { value: 'forehead', label: 'Forehead and brow' },
    { value: 'undereye', label: 'Under eye or crow\'s feet' },
    { value: 'jawline', label: 'Jaw and lower face' },
    { value: 'full', label: 'Multiple areas' },
  ],
  volume: [
    { value: 'lips', label: 'Lips' },
    { value: 'cheeks', label: 'Cheeks and mid-face' },
    { value: 'jawline', label: 'Jawline or chin' },
    { value: 'full', label: 'Multiple areas' },
  ],
  jaw: [
    { value: 'jawline', label: 'Jaw clenching or TMJ pain' },
    { value: 'full', label: 'Jaw slimming and TMJ' },
    { value: 'full', label: 'Just slimming appearance' },
    { value: 'full', label: 'Both' },
  ],
  skin: [
    { value: 'full', label: 'Face overall' },
    { value: 'cheeks', label: 'Cheeks and nose area' },
    { value: 'forehead', label: 'Forehead and hairline' },
    { value: 'full', label: 'Neck and chest' },
  ],
}

const GOALS: Array<{ value: Goal; label: string; desc: string }> = [
  { value: 'subtle', label: 'Subtle and natural', desc: 'I want people to think I look rested, not "done"' },
  { value: 'noticeable', label: 'Visible change', desc: 'I want a clear improvement that I can see' },
  { value: 'gradual', label: 'Gradual and long-term', desc: 'I prefer something that builds slowly over months' },
  { value: 'lasting', label: 'Longest duration', desc: 'I want to minimize how often I need to go back' },
]

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all ${
            i < step ? 'bg-brand-accent' : i === step - 1 ? 'bg-brand-accent w-6' : 'bg-border'
          }`}
          style={{ width: i === step - 1 ? 24 : 12 }}
        />
      ))}
      <span className="ml-2 text-caption text-ink-tertiary">{step} of {total}</span>
    </div>
  )
}

export function QuizClient() {
  const [step, setStep] = useState<Step>(1)
  const [answers, setAnswers] = useState<Answers>({})

  function handleConcern(concern: Concern) {
    setAnswers({ concern })
    setStep(2)
  }

  function handleArea(area: Area) {
    setAnswers((a) => ({ ...a, area }))
    setStep(3)
  }

  function handleGoal(goal: Goal) {
    setAnswers((a) => ({ ...a, goal }))
    setStep(4 as any)
  }

  const recs = step === (4 as any) ? getRecommendation(answers) : []

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <a href="/" className="hover:text-ink-primary transition">Home</a>
            <span>/</span>
            <span className="text-ink-primary">Find my treatment</span>
          </nav>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-12 md:py-16">

        {/* Step 1 — concern */}
        {step === 1 && (
          <div>
            <StepIndicator step={1} total={3} />
            <h1 className="font-serif text-h2-m md:text-h2 font-medium leading-tight text-ink-primary mb-2">
              What is your main concern?
            </h1>
            <p className="text-body text-ink-secondary mb-8">Select the one that fits best. You can always refine later.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONCERNS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleConcern(c.value)}
                  className="text-left p-5 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all group"
                >
                  <div className="font-semibold text-body text-ink-primary group-hover:text-brand-accent transition mb-1">{c.label}</div>
                  <div className="text-body-sm text-ink-secondary">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — area */}
        {step === 2 && answers.concern && (
          <div>
            <StepIndicator step={2} total={3} />
            <h2 className="font-serif text-h2-m md:text-h2 font-medium leading-tight text-ink-primary mb-2">
              Which area are you focused on?
            </h2>
            <p className="text-body text-ink-secondary mb-8">Choose the most relevant area.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AREAS[answers.concern].map((a) => (
                <button
                  key={a.value + a.label}
                  type="button"
                  onClick={() => handleArea(a.value)}
                  className="text-left p-5 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all group"
                >
                  <div className="font-semibold text-body text-ink-primary group-hover:text-brand-accent transition">{a.label}</div>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep(1)} className="mt-4 text-body-sm text-ink-tertiary hover:text-ink-primary transition">
              Back
            </button>
          </div>
        )}

        {/* Step 3 — goal */}
        {step === 3 && (
          <div>
            <StepIndicator step={3} total={3} />
            <h2 className="font-serif text-h2-m md:text-h2 font-medium leading-tight text-ink-primary mb-2">
              What matters most to you?
            </h2>
            <p className="text-body text-ink-secondary mb-8">This helps narrow the right approach.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => handleGoal(g.value)}
                  className="text-left p-5 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all group"
                >
                  <div className="font-semibold text-body text-ink-primary group-hover:text-brand-accent transition mb-1">{g.label}</div>
                  <div className="text-body-sm text-ink-secondary">{g.desc}</div>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep(2)} className="mt-4 text-body-sm text-ink-tertiary hover:text-ink-primary transition">
              Back
            </button>
          </div>
        )}

        {/* Result */}
        {(step as any) === 4 && recs.length > 0 && (
          <div>
            <div className="mb-8">
              <div className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3">Based on your answers</div>
              <h2 className="font-serif text-h2-m md:text-h2 font-medium leading-tight text-ink-primary mb-2">
                {recs.length === 1 ? 'This treatment may be right for you' : 'These treatments may be right for you'}
              </h2>
              <p className="text-body text-ink-secondary">
                This is an educational guide, not medical advice. A licensed provider will assess your anatomy and goals in person.
              </p>
            </div>

            <div className="space-y-5">
              {recs.map((r, i) => (
                <div key={r.slug + i} className="rounded-2xl border border-border bg-surface p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="font-serif text-h3 text-ink-primary">{r.title}</h3>
                    {i === 0 && recs.length > 1 && (
                      <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-accent uppercase tracking-wider">
                        Best match
                      </span>
                    )}
                  </div>
                  <p className="text-body-sm text-ink-secondary leading-relaxed mb-5">{r.why}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link
                      href={`/${r.slug}`}
                      className="flex items-center justify-center gap-2 bg-brand-primary text-surface-canvas rounded-pill px-5 py-2.5 text-body-sm font-semibold hover:opacity-90 transition"
                    >
                      {r.cta}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </Link>
                    <Link
                      href={`/guides/${r.slug}`}
                      className="flex items-center justify-center gap-2 border border-border rounded-pill px-5 py-2.5 text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                    >
                      Read the guide
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-5 rounded-xl border border-border-subtle bg-surface text-body-sm text-ink-tertiary leading-relaxed">
              This quiz uses general principles based on clinical guidelines. It does not consider your anatomy, medical history, medications, or contraindications. Always consult a licensed provider before any injectable treatment.
            </div>

            <button
              type="button"
              onClick={() => { setStep(1); setAnswers({}) }}
              className="mt-6 text-body-sm text-brand-accent font-medium hover:underline"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
