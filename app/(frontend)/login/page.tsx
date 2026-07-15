import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LoginTabs } from '@/components/auth/LoginTabs'

export const metadata: Metadata = {
  title: { absolute: 'Sign in | injector.world' },
  description: 'Sign in to your injector.world account.',
  robots: 'noindex',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string; tab?: string }>
}) {
  // Both ?redirect= and ?next= are used across the app (dashboard pages send ?next=)
  const { redirect, next, tab } = await searchParams
  const target = redirect || next
  const safeRedirect = target && target.startsWith('/') ? target : undefined

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
