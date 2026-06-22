import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { SetupAccountForm } from './SetupAccountForm'

export const metadata: Metadata = {
  title: { absolute: 'Set your password | injector.world' },
  robots: 'noindex',
}

export default async function SetupAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] bg-surface-canvas section-pad">
          <div className="max-canvas max-w-md">
            <div className="rounded-2xl border border-border bg-surface p-6 md:p-8 text-center">
              <h1 className="font-serif text-h2 text-ink-primary mb-3">Invalid link</h1>
              <p className="text-body text-ink-secondary">
                This setup link is missing a token. Please check the email you received and try again,
                or contact support if the problem persists.
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Set your password</h1>
          <p className="text-body text-ink-secondary mb-8">
            Your profile claim was approved. Choose a password to activate your provider account.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <SetupAccountForm token={token} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
