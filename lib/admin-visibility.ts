/**
 * Hides a collection/global from the admin nav and routes for everyone
 * except the admin role. Editors reach /admin too, but these entries are
 * developer/system-monitoring surfaces with no editor-facing task attached.
 *
 * Typed loosely (matches Payload's own ClientUser / PayloadRequest['user']
 * shapes, which both carry index signatures) so this one helper drops into
 * both collection and global `admin.hidden` callbacks without a cast.
 */
export function adminOnly({ user }: { user: { role?: string | null; [key: string]: unknown } | null }): boolean {
  return user?.role !== 'admin'
}
