import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect as nextRedirect } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { SignupForm } from '@/components/auth/SignupForm'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { dashboardPathForRole, safeInternalPath } from '@/lib/auth-redirect'

export const metadata: Metadata = {
  title: { absolute: 'Create your account | injector.world' },
  description: 'Create a free injector.world account to save providers, track consult requests, and see the full directory.',
  robots: 'noindex',
}

// Reads the session cookie, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const safeRedirect = safeInternalPath(redirect)

  // Already signed in: honour where they were headed, else their dashboard.
  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)
  if (user) {
    nextRedirect(safeRedirect ?? dashboardPathForRole((user as { role?: string | null }).role))
  }

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Create your account</h1>
          <p className="text-body text-ink-secondary mb-8">
            Save clinics, track your consult requests, and unlock the full directory. Free, no card needed.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <SignupForm redirect={safeRedirect} />
          </div>

          <p className="mt-6 text-body-sm text-ink-secondary text-center">
            Already have an account?{' '}
            <Link
              href={safeRedirect ? `/login?redirect=${encodeURIComponent(safeRedirect)}` : '/login'}
              className="text-brand-accent hover:underline"
            >
              Sign in
            </Link>
          </p>

          <p className="mt-3 text-caption text-ink-tertiary text-center">
            Are you a provider or clinic?{' '}
            <Link href="/list-your-clinic" className="text-brand-accent hover:underline">
              List your clinic
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}
