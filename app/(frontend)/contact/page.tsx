import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata: Metadata = {
  title: { absolute: 'Contact | injector.world' },
  description: 'Contact the injector.world editorial and provider team.',
  alternates: { canonical: 'https://injector.world/contact' },
}

const contacts = [
  { label: 'Editorial', desc: 'Corrections, article feedback, or editorial inquiries.', email: 'editorial@injector.world' },
  { label: 'Provider listings', desc: 'Adding a new practice, updating your profile, or claiming an existing listing.', email: 'providers@injector.world' },
  { label: 'Patient support', desc: 'Questions about the directory, reviews, or your account.', email: 'hello@injector.world' },
  { label: 'Press', desc: 'Media inquiries and interview requests.', email: 'press@injector.world' },
  { label: 'Legal', desc: 'Privacy requests, HIPAA inquiries, or legal notices.', email: 'legal@injector.world' },
]

export default function ContactPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Contact
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            Use the right address and you will hear back faster.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl">
          <div className="space-y-4">
            {contacts.map((c) => (
              <div key={c.label} className="flex items-start justify-between gap-6 p-5 rounded-xl border border-border bg-surface">
                <div>
                  <div className="font-semibold text-body text-ink-primary mb-1">{c.label}</div>
                  <div className="text-body-sm text-ink-secondary">{c.desc}</div>
                </div>
                <a href={`mailto:${c.email}`} className="flex-shrink-0 text-body-sm text-brand-accent font-medium hover:underline mt-0.5">
                  {c.email}
                </a>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-border text-body-sm text-ink-tertiary">
            <p>We aim to respond within 2 business days. For urgent patient safety concerns, contact your state medical board directly.</p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
