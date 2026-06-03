import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata: Metadata = {
  title: { absolute: 'Terms of Use | injector.world' },
  description: 'Terms of use for injector.world.',
  alternates: { canonical: 'https://injector.world/terms' },
}

export default function TermsPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">Terms of use</h1>
          <p className="text-body text-ink-tertiary">Last updated: June 3, 2026</p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-8">
          <div>
            <h2>Acceptance</h2>
            <p>By using injector.world, you agree to these terms. If you do not agree, do not use the site.</p>
          </div>
          <div>
            <h2>Not medical advice</h2>
            <p>Content on injector.world is editorial in nature and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making any treatment decision. Consult your physician about any questions you may have regarding a medical condition.</p>
          </div>
          <div>
            <h2>Provider information</h2>
            <p>We verify provider licenses and credentials as described in our verification policy, but we do not guarantee the accuracy, completeness, or currency of provider information. Listing on injector.world does not constitute an endorsement of any provider or their services.</p>
          </div>
          <div>
            <h2>User accounts</h2>
            <p>You are responsible for maintaining the security of your account. You may not create accounts on behalf of others without authorization.</p>
          </div>
          <div>
            <h2>Reviews</h2>
            <p>By submitting a review, you grant injector.world a non-exclusive license to publish and display it. You must not submit false, defamatory, or misleading reviews.</p>
          </div>
          <div>
            <h2>Limitation of liability</h2>
            <p>injector.world is not liable for any outcomes resulting from your use of the directory or any provider you find through the platform. Use the directory as one input in your decision, not as the only one.</p>
          </div>
          <div>
            <h2>Changes to terms</h2>
            <p>We may update these terms. Material changes will be communicated via email or a notice on the site.</p>
          </div>
          <div className="flex gap-4 pt-4 border-t border-border">
            <Link href="/privacy" className="text-body-sm text-brand-accent hover:underline">Privacy policy</Link>
            <Link href="/hipaa" className="text-body-sm text-brand-accent hover:underline">HIPAA notice</Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
