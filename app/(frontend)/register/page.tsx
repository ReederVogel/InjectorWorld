import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: { absolute: 'Create an account | injector.world' },
  description: 'Create a free injector.world account as a patient, provider, or clinic owner.',
  robots: 'noindex',
}

export default function RegisterPage() {
  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Create your account</h1>
          <p className="text-body text-ink-secondary mb-8">
            Join injector.world as a patient, provider, or clinic.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <RegisterForm />
          </div>

          <p className="mt-6 text-body-sm text-ink-secondary text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}
