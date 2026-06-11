import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: { absolute: 'Sign in | injector.world' },
  description: 'Sign in to your injector.world provider account.',
  robots: 'noindex',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const safeRedirect = redirect && redirect.startsWith('/') ? redirect : undefined

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Sign in</h1>
          <p className="text-body text-ink-secondary mb-8">
            Access your saved providers, consult requests, and account settings.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <LoginForm redirect={safeRedirect} />
          </div>

          <p className="mt-6 text-body-sm text-ink-secondary text-center">
            New here?{' '}
            <Link
              href={safeRedirect ? `/signup?redirect=${encodeURIComponent(safeRedirect)}` : '/signup'}
              className="text-brand-accent hover:underline"
            >
              Create an account
            </Link>
          </p>

          <p className="mt-3 text-caption text-ink-tertiary text-center">
            Claiming a profile?{' '}
            <Link href="/list-your-practice" className="text-brand-accent hover:underline">
              Learn how listing works
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}
