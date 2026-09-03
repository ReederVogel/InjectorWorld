/**
 * Where a signed-in user belongs, by role.
 *
 * Mirrors the role fan-out already performed by app/(frontend)/dashboard/page.tsx
 * so auth pages (/login, /signup, /register) can bounce a signed-in visitor
 * straight to the right place instead of re-offering them a sign-up form.
 */
export function dashboardPathForRole(role?: string | null): string {
  switch (role) {
    case 'admin':
    case 'editor':
      return '/admin'
    case 'clinic':
      return '/dashboard/clinic'
    case 'brand':
      return '/dashboard/brand'
    default:
      return '/dashboard'
  }
}

/**
 * Destination + label for the "List your clinic" header/footer CTA.
 *
 * The CTA used to be a static link to the listing page for everyone, which
 * funnelled signed-in visitors into a create-account form. Now that /register
 * bounces them back out, a signed-in patient following that link would just
 * ping-pong, so send them to the claim search instead, which works without a
 * second account. Owners already have a profile, so they get their dashboard.
 */
export function practiceCta(user?: { role?: string | null } | null): { href: string; label: string } {
  if (!user) return { href: '/list-your-clinic', label: 'List your clinic' }

  switch (user.role) {
    case 'admin':
    case 'editor':
      return { href: '/admin', label: 'Admin panel' }
    // No 'provider' case. That role was dropped from the Users enum along with
    // the Providers collection; the enum is admin | editor | user | clinic |
    // brand, so the branch was unreachable and only implied the role still existed.
    case 'clinic':
    case 'brand':
      return { href: dashboardPathForRole(user.role), label: 'My dashboard' }
    default:
      // Signed-in patient: they may still own a clinic, so point at the
      // claim search rather than the sign-up funnel they can no longer use.
      return { href: '/claim', label: 'List your clinic' }
  }
}

/**
 * Only allow same-origin relative paths as a post-login redirect target, so a
 * crafted `?redirect=https://evil.example` can't turn our login page into an
 * open redirect.
 */
export function safeInternalPath(target?: string | null): string | undefined {
  if (!target) return undefined
  // Must start with a single "/" — "//host" is protocol-relative and leaves the site.
  if (!target.startsWith('/') || target.startsWith('//')) return undefined
  return target
}
