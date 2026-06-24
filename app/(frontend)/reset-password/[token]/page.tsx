import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = {
  title: { absolute: 'Choose a new password | injector.world' },
  description: 'Set a new password for your injector.world account.',
  robots: 'noindex',
}

export default async function ResetPasswordTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <h1 className="font-serif text-h2 text-ink-primary mb-2">Choose a new password</h1>
          <p className="text-body text-ink-secondary mb-8">
            Pick a strong password you do not use anywhere else.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <ResetPasswordForm token={token} />
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
