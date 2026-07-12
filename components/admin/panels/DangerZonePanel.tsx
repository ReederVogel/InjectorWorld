'use client'

import { BranchSuggestions } from '../BranchSuggestions'
import { DataToolsPanel } from './DataToolsPanel'

/**
 * Hosts the merge-suggestion and data-tools panels. onAfterChange re-hits the
 * same DataAlerts endpoints the old dashboard used to refresh its badge
 * counts; those badges now live on the Operations page, which re-fetches on
 * its own mount, so this just keeps the network contract identical.
 */
export function DangerZonePanel() {
  async function loadAlertCounts() {
    try {
      await Promise.all([
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=error&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=warning&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=info&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[status][equals]=open&limit=5&sort=createdAt&depth=0', { credentials: 'include' }),
      ])
    } catch { /* non-fatal */ }
  }

  return (
    <>
      <BranchSuggestions onAfterChange={loadAlertCounts} />
      <DataToolsPanel onAfterChange={loadAlertCounts} />
    </>
  )
}
