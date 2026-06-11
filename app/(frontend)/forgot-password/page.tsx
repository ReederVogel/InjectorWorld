import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

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
            Enter the email on your account and we will send you a link to choose a new password.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <ForgotPasswordForm />
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
