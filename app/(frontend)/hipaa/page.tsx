import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata: Metadata = {
  title: { absolute: 'HIPAA Notice | injector.world' },
  description: 'Notice of privacy practices under HIPAA for injector.world.',
  alternates: { canonical: 'https://injector.world/hipaa' },
}

export default function HipaaPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">HIPAA notice</h1>
          <p className="text-body text-ink-tertiary">Last updated: June 3, 2026</p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-8">
          <div>
            <h2>Who we are</h2>
            <p>injector.world operates as a directory and information platform. We are not a covered entity under HIPAA in our directory function. However, when we facilitate booking requests between patients and providers, we handle protected health information (PHI) subject to applicable privacy standards.</p>
          </div>
          <div>
            <h2>How we protect health information</h2>
            <p>Booking request data and any health-related information you submit is encrypted at rest and in transit. Access is limited to staff who need it to facilitate your request. We do not sell, share, or use your health information for advertising purposes.</p>
          </div>
          <div>
            <h2>Your rights</h2>
            <p>You have the right to access, correct, and request deletion of health information we hold about you. To exercise these rights, contact <a href="mailto:legal@injector.world">legal@injector.world</a>.</p>
          </div>
          <div>
            <h2>Contact</h2>
            <p>For HIPAA-related inquiries: <a href="mailto:legal@injector.world">legal@injector.world</a></p>
          </div>
          <div className="flex gap-4 pt-4 border-t border-border">
            <Link href="/privacy" className="text-body-sm text-brand-accent hover:underline">Privacy policy</Link>
            <Link href="/terms" className="text-body-sm text-brand-accent hover:underline">Terms of use</Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
