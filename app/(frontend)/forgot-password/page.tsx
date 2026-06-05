import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata: Metadata = {
  title: { absolute: 'Forgot password | injector.world' },
  description: 'Reset your injector.world account password.',
  robots: 'noindex',
}

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Reset your password</h1>
          <p className="text-body text-ink-secondary mb-8">
            Email-based password reset is coming soon. For now, contact our team and we will help you regain access.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-accent-soft border border-brand-accent/20">
              <svg className="flex-shrink-0 text-brand-accent" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-body-sm text-ink-primary">
                Include your registered email address in your message so we can locate your account.
              </p>
            </div>

            <a
              href="mailto:support@injector.world"
              className="flex w-full items-center justify-center gap-2 bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Email support@injector.world
            </a>
          </div>

          <p className="mt-6 text-body-sm text-ink-secondary text-center">
            <Link href="/login" className="text-brand-accent hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}
