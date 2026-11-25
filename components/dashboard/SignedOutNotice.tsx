/** Shown when a dashboard request comes back 401: the login cookie is gone, so offer sign-in, not an error. */
export function SignedOutNotice({ keptEdits = false }: { keptEdits?: boolean }) {
  return (
    <p role="alert" className="px-4 py-3 rounded-xl text-body-sm font-medium bg-[#B91C1C]/5 text-[#B91C1C] border border-[#B91C1C]/20">
      You have been signed out.{' '}
      <a href="/login?next=/dashboard/clinic" className="underline font-semibold">
        Sign in again
      </a>
      {keptEdits ? '. Your unsaved changes will be waiting here.' : ' to continue.'}
    </p>
  )
}
