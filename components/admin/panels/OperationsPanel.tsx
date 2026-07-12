'use client'

import { useEffect, useState } from 'react'
import { StatsBar } from './StatsBar'
import { NeedsYouNow, type QueueKind, type QueueRecord, type QueueRow } from './NeedsYouNow'
import { ALERTS_OPEN, LEADS_NEW, CLAIMS_NEW, QUESTIONS_NEW } from './constants'

/**
 * Stateful host for the "Needs you now" queue, optionally preceded by the
 * StatsBar. Shared by CommandCenter (showStats) and OpsView (queue only) so
 * the alert/claims/questions/bookings fetch logic lives in exactly one place.
 */
export function OperationsPanel({ showStats = false }: { showStats?: boolean }) {
  const [alertCritical, setAlertCritical] = useState<number>(0)
  const [alertWarning, setAlertWarning] = useState<number>(0)
  const [alertInfo, setAlertInfo] = useState<number>(0)
  const [newBookings, setNewBookings] = useState<number | null>(null)
  const [oldestBooking, setOldestBooking] = useState<string | null>(null)
  const [pendingClaims, setPendingClaims] = useState<number>(0)
  const [newQuestions, setNewQuestions] = useState<number>(0)
  const [totalProviders, setTotalProviders] = useState<number | null>(null)
  const [totalClinics, setTotalClinics] = useState<number | null>(null)
  const [activePromotions, setActivePromotions] = useState<number | null>(null)
  const [liveMarkets, setLiveMarkets] = useState<number | null>(null)

  // Top few pending records per queue, so "Needs you now" can render inline
  // quick-actions directly instead of only linking out to the filtered list.
  const [claimDocs, setClaimDocs] = useState<QueueRecord[]>([])
  const [questionDocs, setQuestionDocs] = useState<QueueRecord[]>([])
  const [bookingDocs, setBookingDocs] = useState<QueueRecord[]>([])
  const [alertDocs, setAlertDocs] = useState<QueueRecord[]>([])

  async function loadAlertCounts() {
    try {
      const [errRes, warnRes, infoRes, openRes] = await Promise.all([
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=error&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=warning&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=info&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[status][equals]=open&limit=5&sort=createdAt&depth=0', { credentials: 'include' }),
      ])
      const [errJson, warnJson, infoJson, openJson] = await Promise.all([
        errRes.json(), warnRes.json(), infoRes.json(), openRes.json(),
      ])
      setAlertCritical(errJson.totalDocs ?? 0)
      setAlertWarning(warnJson.totalDocs ?? 0)
      setAlertInfo(infoJson.totalDocs ?? 0)
      setAlertDocs(
        (openJson.docs ?? []).map((d: any) => ({ id: d.id, title: d.message || `${d.type} alert`, status: d.status })),
      )
    } catch { /* non-fatal */ }
  }

  async function loadPendingClaims() {
    try {
      const res = await fetch('/api/claims?where[status][equals]=new&limit=5&sort=createdAt&depth=0', { credentials: 'include' })
      const json = await res.json()
      setPendingClaims(json.totalDocs ?? 0)
      setClaimDocs(
        (json.docs ?? []).map((d: any) => ({ id: d.id, title: d.claimantName || d.claimantEmail, status: d.status })),
      )
    } catch { /* non-fatal */ }
  }

  async function loadQuestions() {
    try {
      const res = await fetch('/api/qa?where[status][equals]=new&limit=5&sort=createdAt&depth=0', { credentials: 'include' })
      const json = await res.json()
      setNewQuestions(json.totalDocs ?? 0)
      setQuestionDocs(
        (json.docs ?? []).map((d: any) => ({ id: d.id, title: d.questionTitle, status: d.status })),
      )
    } catch { /* non-fatal */ }
  }

  async function loadBookings() {
    try {
      const res = await fetch(
        '/api/bookings?where[status][equals]=new&limit=5&sort=createdAt&depth=0',
        { credentials: 'include' },
      )
      const json = await res.json()
      setNewBookings(json.totalDocs ?? 0)
      setOldestBooking(json.docs?.[0]?.createdAt ?? null)
      setBookingDocs(
        (json.docs ?? []).map((d: any) => ({ id: d.id, title: d.patientName || 'Lead', status: d.status })),
      )
    } catch {
      setNewBookings(null)
    }
  }

  // Each count is fetched and settled independently so one slow collection
  // (e.g. clinics, ~13k rows) can never block the other three cards.
  async function loadCount(
    url: string,
    setter: (n: number) => void,
  ) {
    try {
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      setter(json.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  function loadStats() {
    loadCount('/api/providers?limit=1&depth=0', setTotalProviders)
    loadCount('/api/clinics?limit=1&depth=0', setTotalClinics)
    loadCount('/api/promotions?where[status][equals]=active&limit=1&depth=0', setActivePromotions)
    loadCount(
      '/api/locations?where[and][0][kind][equals]=state&where[and][1][isLive][equals]=true&limit=1&depth=0',
      setLiveMarkets,
    )
  }

  useEffect(() => {
    loadAlertCounts()
    loadBookings()
    loadPendingClaims()
    loadQuestions()
    if (showStats) loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStats])

  const oldestDays =
    newBookings && oldestBooking
      ? Math.floor((Date.now() - new Date(oldestBooking).getTime()) / 86400000)
      : 0
  const staleLeads = (newBookings ?? 0) > 0 && oldestDays >= 2
  const totalAlerts = alertCritical + alertWarning + alertInfo

  function onRecordDone(kind: QueueKind, id: QueueRecord['id']) {
    if (kind === 'claim') {
      setClaimDocs((prev) => prev.filter((r) => r.id !== id))
      setPendingClaims((c) => Math.max(0, c - 1))
    } else if (kind === 'booking') {
      setBookingDocs((prev) => prev.filter((r) => r.id !== id))
      setNewBookings((c) => (c == null ? c : Math.max(0, c - 1)))
    } else if (kind === 'question') {
      setQuestionDocs((prev) => prev.filter((r) => r.id !== id))
      setNewQuestions((c) => Math.max(0, c - 1))
    } else {
      // Severity bucket of the acted-on alert is unknown here; the count
      // badges self-correct on next load. The record itself disappears now.
      setAlertDocs((prev) => prev.filter((r) => r.id !== id))
    }
  }

  const queueRows: QueueRow[] = [
    {
      key: 'leads',
      label: `${newBookings ?? 0} new lead${(newBookings ?? 0) === 1 ? '' : 's'}`,
      detail: (newBookings ?? 0) > 0
        ? (oldestBooking ? `oldest waiting ${oldestDays} day${oldestDays === 1 ? '' : 's'}` : '')
        : 'all bookings actioned',
      href: LEADS_NEW,
      dotColor: staleLeads ? '#B91C1C' : (newBookings ?? 0) > 0 ? '#C2A14E' : '#3FA68A',
      kind: 'booking',
      records: bookingDocs,
    },
    {
      key: 'claims',
      label: `${pendingClaims} profile claim${pendingClaims === 1 ? '' : 's'} to review`,
      detail: pendingClaims > 0 ? 'awaiting approval or rejection' : 'nothing pending',
      href: CLAIMS_NEW,
      dotColor: pendingClaims > 0 ? '#C2A14E' : '#3FA68A',
      kind: 'claim',
      records: claimDocs,
    },
    {
      key: 'questions',
      label: `${newQuestions} reader question${newQuestions === 1 ? '' : 's'} unanswered`,
      detail: newQuestions > 0 ? 'pending moderation and an answer' : 'all caught up',
      href: QUESTIONS_NEW,
      dotColor: newQuestions > 0 ? '#C2A14E' : '#3FA68A',
      kind: 'question',
      records: questionDocs,
    },
    {
      key: 'alerts',
      label: `${totalAlerts} open data alert${totalAlerts === 1 ? '' : 's'}`,
      detail: totalAlerts === 0
        ? 'no integrity issues open'
        : [
            alertCritical > 0 ? `${alertCritical} critical` : '',
            alertWarning > 0 ? `${alertWarning} warning` : '',
            alertInfo > 0 ? `${alertInfo} info` : '',
          ].filter(Boolean).join(', '),
      href: ALERTS_OPEN,
      dotColor: alertCritical > 0 ? '#B91C1C' : alertWarning > 0 ? '#C2A14E' : '#3FA68A',
      kind: 'alert',
      records: alertDocs,
    },
  ]

  return (
    <>
      {showStats && (
        <StatsBar
          totalProviders={totalProviders}
          totalClinics={totalClinics}
          alertCritical={alertCritical}
          alertWarning={alertWarning}
          alertInfo={alertInfo}
          activePromotions={activePromotions}
          unactionedLeads={newBookings}
          liveMarkets={liveMarkets}
        />
      )}
      <NeedsYouNow rows={queueRows} onRecordDone={onRecordDone} />
    </>
  )
}
