import type { Metadata } from 'next'
import { redirect as nextRedirect } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LoginTabs } from '@/components/auth/LoginTabs'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { dashboardPathForRole, safeInternalPath } from '@/lib/auth-redirect'

export const metadata: Metadata = {
  title: { absolute: 'Sign in | injector.world' },
  description: 'Sign in to your injector.world account.',
  robots: 'noindex',
}

// Reads the session cookie, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string; tab?: string }>
}) {
  // Both ?redirect= and ?next= are used across the app (dashboard pages send ?next=)
  const { redirect, next, tab } = await searchParams
  const target = redirect || next
  const safeRedirect = safeInternalPath(target)

  // Already signed in: honour where they were headed, else their dashboard.
  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)
  if (user) {
    nextRedirect(safeRedirect ?? dashboardPathForRole((user as { role?: string | null }).role))
  }

  // Someone bounced off a clinic/provider dashboard is a practice user —
  // open the right tab for them. ?tab=practice also works for direct links.
  const practiceBound =
    tab === 'practice' ||
    (safeRedirect !== undefined &&
      (safeRedirect.startsWith('/dashboard/clinic') || safeRedirect.startsWith('/dashboard/provider')))

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <LoginTabs redirect={safeRedirect} initialTab={practiceBound ? 'practice' : 'patient'} />
        </div>
      </main>

      <Footer />
    </>
  )
}
