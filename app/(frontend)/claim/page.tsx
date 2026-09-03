import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ClinicSearch } from '@/components/claim/ClinicSearch'

export const metadata: Metadata = {
  title: { absolute: 'Claim your clinic | injector.world' },
  description:
    'Search the injector.world directory for your clinic and claim your profile to manage your listing, team, and bookings.',
  robots: 'noindex',
}

/**
 * Entry point for the claim funnel.
 *
 * Until this page existed, /claim/clinic/[slug] was only reachable from a
 * clinic's own public profile or an emailed admin invite — so an owner who
 * arrived via "List your clinic" had no way to discover that their clinic
 * was already listed, and filed a duplicate listing application instead.
 */
export default function ClaimLandingPage() {
  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-xl">
          <p className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            For clinics
          </p>
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Claim your clinic</h1>
          <p className="text-body text-ink-secondary mb-8">
            Find your clinic below to claim its profile. Once verified, you can edit your details, manage
            your team, and receive booking requests.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <ClinicSearch autoFocus />
          </div>

          <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-4 text-body-sm text-ink-secondary space-y-1.5">
            <p className="font-medium text-ink-primary">What happens next?</p>
            <p>Our team checks your license against the state board and verifies your identity.</p>
            <p>This usually takes 2 to 3 business days. We will email you a secure link to set up your account.</p>
          </div>

          <p className="mt-6 text-body-sm text-ink-secondary text-center">
            Cannot find your clinic?{' '}
            <Link href="/register" className="text-brand-accent hover:underline">
              Apply to get listed
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}
