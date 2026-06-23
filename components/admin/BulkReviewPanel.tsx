'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type EntityType = 'clinics' | 'providers' | 'reviews'
type Action = 'publish' | 'draft' | 'review'

type DocRecord = Record<string, unknown> & {
  id: number
  missingFields: string[]
}

type Counts = {
  totalDocs: number
  publishedCount: number
  reviewCount: number
  draftCount: number
  missingAnyCount: number
}

type EditingCell = { id: number; field: string } | null

type ColDef = {
  header: string
  field: string
  editable: boolean
  editType?: 'text' | 'number' | 'select' | 'checkbox' | 'treatments' | 'languages'
  options?: { value: string; label: string }[]
  render?: (doc: DocRecord) => string
}

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'review', label: 'Review' },
  { value: 'draft', label: 'Draft' },
]
const REVIEW_MOD_OPTIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]
const CLINIC_TYPE_OPTIONS = [
  { value: 'medspa', label: 'Med Spa' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'plastic-surgery', label: 'Plastic Surgery' },
  { value: 'dental-aesthetics', label: 'Dental Aesthetics' },
  { value: 'other', label: 'Other' },
]

function renderTreatments(doc: DocRecord): string {
  const val = doc.treatmentsOffered
  if (!val || (Array.isArray(val) && val.length === 0)) return ''
  if (Array.isArray(val)) return `${val.length} treatment${val.length === 1 ? '' : 's'}`
  return String(val)
}
function renderLanguages(doc: DocRecord): string {
  const val = doc.languages
  if (!val || (Array.isArray(val) && val.length === 0)) return ''
  if (Array.isArray(val)) return val.join('; ')
  return String(val)
}

const CLINIC_COLS: ColDef[] = [
  { header: 'Clinic Name', field: 'clinicName', editable: false },
  { header: 'City', field: 'city', editable: false },
  { header: 'State', field: 'state', editable: false },
  { header: 'Type', field: 'clinicType', editable: true, editType: 'select', options: CLINIC_TYPE_OPTIONS },
  { header: 'Phone', field: 'phone', editable: true, editType: 'text' },
  { header: 'Email', field: 'email', editable: true, editType: 'text' },
  { header: 'Treatments', field: 'treatmentsOffered', editable: true, editType: 'treatments', render: renderTreatments },
  { header: 'Languages', field: 'languages', editable: true, editType: 'languages', render: renderLanguages },
  { header: 'Instagram', field: 'instagramUrl', editable: true, editType: 'text' },
  { header: 'Facebook', field: 'facebookUrl', editable: true, editType: 'text' },
  { header: 'Starting Price', field: 'startingPrice', editable: true, editType: 'number' },
]
const PROVIDER_COLS: ColDef[] = [
  { header: 'Name', field: 'fullName', editable: false },
  { header: 'Credentials', field: 'credentials', editable: false },
  {
    header: 'Clinic', field: 'clinic', editable: false,
    render: (doc) => {
      const c = doc.clinic
      if (c && typeof c === 'object') return String((c as Record<string, unknown>).clinicName ?? (c as Record<string, unknown>).id ?? '')
      return String(c ?? '')
    },
  },
  { header: 'Bio', field: 'bio', editable: true, editType: 'text' },
  { header: 'Experience', field: 'yearsExperience', editable: true, editType: 'number' },
  { header: 'Treatments', field: 'treatmentsOffered', editable: true, editType: 'treatments', render: renderTreatments },
  { header: 'Pricing Botox', field: 'pricingBotoxPerUnit', editable: true, editType: 'number' },
  { header: 'NPI', field: 'npiNumber', editable: true, editType: 'text' },
  { header: 'Instagram', field: 'instagramUrl', editable: true, editType: 'text' },
]
const REVIEW_COLS: ColDef[] = [
  {
    header: 'Clinic', field: 'clinic', editable: false,
    render: (doc) => {
      const c = doc.clinic
      if (c && typeof c === 'object') return String((c as Record<string, unknown>).clinicName ?? (c as Record<string, unknown>).id ?? '')
      return String(c ?? '')
    },
  },
  {
    header: 'Provider', field: 'provider', editable: false,
    render: (doc) => {
      const p = doc.provider
      if (p && typeof p === 'object') return String((p as Record<string, unknown>).fullName ?? (p as Record<string, unknown>).id ?? '')
      return String(p ?? '')
    },
  },
  { header: 'Reviewer Name', field: 'reviewerFirstName', editable: true, editType: 'text' },
  { header: 'City', field: 'reviewerCity', editable: true, editType: 'text' },
  { header: 'Rating', field: 'rating', editable: false },
  { header: 'Review Title', field: 'reviewTitle', editable: true, editType: 'text' },
  { header: 'Treatment Tag', field: 'treatmentTag', editable: true, editType: 'text' },
  { header: 'Source URL', field: 'sourceUrl', editable: true, editType: 'text' },
  { header: 'Response', field: 'responseFromProvider', editable: true, editType: 'text' },
]

function getCols(type: EntityType): ColDef[] {
  if (type === 'clinics') return CLINIC_COLS
  if (type === 'providers') return PROVIDER_COLS
  return REVIEW_COLS
}
function getStatusField(type: EntityType): string {
  return type === 'reviews' ? 'moderationStatus' : 'status'
}
function getStatusOptions(type: EntityType) {
  return type === 'reviews' ? REVIEW_MOD_OPTIONS : STATUS_OPTIONS
}

const TOTAL_FIELDS: Record<EntityType, number> = { clinics: 16, providers: 13, reviews: 7 }

const CLINIC_MISSING_OPTIONS = [
  'clinicType', 'description', 'phone', 'email', 'bookingUrl', 'amenities', 'logoUrl',
  'yearEstablished', 'googlePlaceId', 'treatmentsOffered', 'languages',
  'instagramUrl', 'facebookUrl', 'offersVirtualConsult', 'startingPrice', 'hoursJson',
]
const PROVIDER_MISSING_OPTIONS = [
  'bio', 'tagline', 'yearsExperience', 'profilePhotoUrl', 'languages', 'gender',
  'treatmentsOffered', 'pricingBotoxPerUnit', 'pricingFillerPerSyringe',
  'npiNumber', 'instagramUrl', 'tiktokUrl', 'offersVirtualConsult',
]
const REVIEW_MISSING_OPTIONS = [
  'reviewerFirstName', 'reviewerAgeRange', 'reviewerCity',
  'reviewTitle', 'treatmentTag', 'sourceUrl', 'responseFromProvider',
]
function getMissingOptions(type: EntityType): string[] {
  if (type === 'clinics') return CLINIC_MISSING_OPTIONS
  if (type === 'providers') return PROVIDER_MISSING_OPTIONS
  return REVIEW_MISSING_OPTIONS
}

function getRecordName(doc: DocRecord, type: EntityType): string {
  if (type === 'clinics') return String(doc.clinicName ?? doc.id)
  if (type === 'providers') return String(doc.fullName ?? doc.id)
  return `Review #${doc.id}`
}

function statusBadgeStyle(val: string): React.CSSProperties {
  if (val === 'published' || val === 'approved')
    return { background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }
  if (val === 'review' || val === 'pending')
    return { background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }
  return { background: '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }
}

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

function btn(busy: boolean, bg = '#0B1B34', disabled = false): React.CSSProperties {
  const off = busy || disabled
  return {
    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: off ? 'default' : 'pointer',
    background: bg, color: '#fff', fontSize: 12, fontWeight: 600, opacity: off ? 0.5 : 1,
    whiteSpace: 'nowrap',
  }
}
function selectStyle(): React.CSSProperties {
  return {
    fontSize: 12, padding: '4px 6px', borderRadius: 6,
    border: '1px solid var(--theme-elevation-150, #e2e8f0)',
    background: 'var(--theme-elevation-50, #fff)',
    color: 'var(--theme-text, inherit)',
    cursor: 'pointer',
  }
}
function inputStyle(error?: boolean): React.CSSProperties {
  return {
    width: '100%', fontSize: 12, padding: '4px 6px',
    border: `1px solid ${error ? '#B91C1C' : 'var(--theme-elevation-300, #94A3B8)'}`,
    borderRadius: 4, background: 'var(--theme-elevation-50, #fff)',
    color: 'var(--theme-text, inherit)',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }
}

export function BulkReviewPanel() {
  const [type, setType] = useState<EntityType>('clinics')
  const [statusFilter, setStatusFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [missingFilter, setMissingFilter] = useState('')
  const [records, setRecords] = useState<DocRecord[]>([])
  const [counts, setCounts] = useState<Counts>({ totalDocs: 0, publishedCount: 0, reviewCount: 0, draftCount: 0, missingAnyCount: 0 })
  const [offset, setOffset] = useState(0)
  const LIMIT = 100
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const batchInputRef = useRef<HTMLInputElement>(null)

  // Feature 2: column visibility
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [colsMenuOpen, setColsMenuOpen] = useState(false)

  // Feature 5: expand drawer
  const [expandedDoc, setExpandedDoc] = useState<DocRecord | null>(null)
  const [drawerEdits, setDrawerEdits] = useState<Record<string, string>>({})
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [drawerMsg, setDrawerMsg] = useState('')

  // Feature 6: bulk field edit
  const [bulkFieldOpen, setBulkFieldOpen] = useState(false)
  const [bulkFieldName, setBulkFieldName] = useState('')
  const [bulkFieldValue, setBulkFieldValue] = useState('')
  const [bulkFieldProgress, setBulkFieldProgress] = useState('')

  // Feature 7: review mode
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIdx, setReviewIdx] = useState(0)

  // Load hidden cols from localStorage when type changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`brp_hidden_cols_${type}`)
      setHiddenCols(stored ? new Set(JSON.parse(stored) as string[]) : new Set())
    } catch {
      setHiddenCols(new Set())
    }
  }, [type])

  function toggleCol(field: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      next.has(field) ? next.delete(field) : next.add(field)
      try { localStorage.setItem(`brp_hidden_cols_${type}`, JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  // Feature 7: keyboard shortcuts in review mode
  useEffect(() => {
    if (!reviewMode) return
    async function doStatusChange(id: number, newStatus: string) {
      const field = getStatusField(type)
      const res = await fetch('/api/admin/bulk-review/update', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: type, id, field, value: newStatus }),
      })
      if (res.ok) setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: newStatus } : r))
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { setReviewIdx((i) => Math.max(0, i - 1)); return }
      if (e.key === 'ArrowRight') { setReviewIdx((i) => Math.min(records.length - 1, i + 1)); return }
      if (e.key === 'Escape') { setReviewMode(false); return }
      const doc = records[reviewIdx]
      if (!doc) return
      if (e.key === 'p' || e.key === 'P') doStatusChange(doc.id, type === 'reviews' ? 'approved' : 'published')
      if (e.key === 'r' || e.key === 'R') doStatusChange(doc.id, type === 'reviews' ? 'rejected' : 'draft')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reviewMode, reviewIdx, records, type])

  const load = useCallback(async (t: EntityType, st: string, batch: string, missing: string, off: number) => {
    setIsLoading(true)
    setActionMessage('')
    try {
      const params = new URLSearchParams({ type: t, status: st, offset: String(off), limit: String(LIMIT) })
      if (batch) params.set('batch', batch)
      if (missing) params.set('missing', missing)
      const res = await fetch(`/api/admin/bulk-review/list?${params}`, { credentials: 'include' })
      if (!res.ok) { setActionMessage('Failed to load records.'); return }
      const json = await res.json()
      setRecords(json.docs ?? [])
      setCounts({
        totalDocs: json.totalDocs ?? 0,
        publishedCount: json.publishedCount ?? 0,
        reviewCount: json.reviewCount ?? 0,
        draftCount: json.draftCount ?? 0,
        missingAnyCount: json.missingAnyCount ?? 0,
      })
      setSelectedIds(new Set())
    } catch {
      setActionMessage('Network error loading records.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setOffset(0)
    setSelectedIds(new Set())
    load(type, statusFilter, batchFilter, missingFilter, 0)
  }, [type, statusFilter, missingFilter, load])

  function applyBatchFilter() {
    setOffset(0); setSelectedIds(new Set())
    load(type, statusFilter, batchFilter, missingFilter, 0)
  }
  function handlePage(dir: 'prev' | 'next') {
    const newOffset = dir === 'prev' ? Math.max(0, offset - LIMIT) : offset + LIMIT
    setOffset(newOffset); setSelectedIds(new Set())
    load(type, statusFilter, batchFilter, missingFilter, newOffset)
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    if (selectedIds.size === records.length && records.length > 0) setSelectedIds(new Set())
    else setSelectedIds(new Set(records.map((r) => r.id)))
  }

  async function bulkAction(action: Action) {
    if (selectedIds.size === 0) return
    setBulkBusy(true); setActionMessage('')
    try {
      const res = await fetch('/api/admin/bulk-review/bulk-publish', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: type, ids: Array.from(selectedIds), action }),
      })
      const json = await res.json()
      if (!res.ok) { setActionMessage(json.error || 'Bulk action failed.'); return }
      const statusField = getStatusField(type)
      const newStatusVal = action === 'publish' ? (type === 'reviews' ? 'approved' : 'published')
        : action === 'review' ? (type === 'reviews' ? 'pending' : 'review')
        : (type === 'reviews' ? 'rejected' : 'draft')
      setRecords((prev) => prev.map((r) => selectedIds.has(r.id) ? { ...r, [statusField]: newStatusVal } : r))
      setSelectedIds(new Set())
      setActionMessage(`${json.updated} record${json.updated === 1 ? '' : 's'} updated.`)
      load(type, statusFilter, batchFilter, missingFilter, offset)
    } catch { setActionMessage('Network error during bulk action.') }
    finally { setBulkBusy(false) }
  }

  function startEdit(id: number, field: string, currentValue: unknown) {
    setEditingCell({ id, field }); setEditError('')
    if (field === 'treatmentsOffered') setEditValue('')
    else if (field === 'languages') setEditValue(Array.isArray(currentValue) ? (currentValue as string[]).join('; ') : String(currentValue ?? ''))
    else if (typeof currentValue === 'boolean') setEditValue(currentValue ? 'true' : 'false')
    else setEditValue(String(currentValue ?? ''))
  }

  async function commitEdit(id: number, field: string, value: string) {
    setEditError('')
    let parsedValue: unknown = value
    const numFields = ['yearEstablished', 'startingPrice', 'yearsExperience', 'pricingBotoxPerUnit', 'pricingFillerPerSyringe', 'rating']
    if (numFields.includes(field)) parsedValue = value === '' ? null : parseFloat(value)
    if (['verified', 'featured', 'offersVirtualConsult', 'acceptsNewPatients', 'needsManualReview'].includes(field)) parsedValue = value === 'true'
    try {
      const res = await fetch('/api/admin/bulk-review/update', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: type, id, field, value: parsedValue }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error || 'Update failed.'); return }
      setRecords((prev) => prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: parsedValue }
        const newMissing = updated.missingFields.filter((f: string) => f !== field)
        const isEmpty = parsedValue === null || parsedValue === undefined ||
          (typeof parsedValue === 'string' && parsedValue.trim() === '') ||
          (Array.isArray(parsedValue) && parsedValue.length === 0)
        if (isEmpty && !newMissing.includes(field)) newMissing.push(field)
        return { ...updated, missingFields: newMissing }
      }))
      setEditingCell(null)
    } catch { setEditError('Network error.') }
  }

  async function commitStatusChange(id: number, newStatus: string) {
    const field = getStatusField(type)
    try {
      const res = await fetch('/api/admin/bulk-review/update', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: type, id, field, value: newStatus }),
      })
      if (!res.ok) { const json = await res.json(); setActionMessage(json.error || 'Status update failed.'); return }
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: newStatus } : r))
    } catch { setActionMessage('Network error updating status.') }
  }

  // Feature 5: drawer
  function openDrawer(doc: DocRecord) {
    const edits: Record<string, string> = {}
    getCols(type).filter((c) => c.editable).forEach((col) => {
      const val = doc[col.field]
      if (col.field === 'languages') edits[col.field] = Array.isArray(val) ? (val as string[]).join('; ') : String(val ?? '')
      else if (Array.isArray(val)) edits[col.field] = ''
      else edits[col.field] = String(val ?? '')
    })
    setDrawerEdits(edits); setDrawerMsg(''); setExpandedDoc(doc)
  }

  async function saveDrawer() {
    if (!expandedDoc) return
    const editableCols = getCols(type).filter((c) => c.editable)
    const changed = editableCols.filter((col) => String(expandedDoc[col.field] ?? '') !== (drawerEdits[col.field] ?? ''))
    if (changed.length === 0) { setDrawerMsg('No changes to save.'); return }
    setDrawerBusy(true); setDrawerMsg('')
    let saved = 0
    for (const col of changed) {
      try {
        const res = await fetch('/api/admin/bulk-review/update', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: type, id: expandedDoc.id, field: col.field, value: drawerEdits[col.field] ?? '' }),
        })
        if (res.ok) {
          saved++
          const v = drawerEdits[col.field] ?? ''
          setRecords((prev) => prev.map((r) => r.id === expandedDoc.id ? { ...r, [col.field]: v } : r))
        }
      } catch {}
    }
    setDrawerBusy(false)
    setDrawerMsg(`Saved ${saved} of ${changed.length} field${changed.length === 1 ? '' : 's'}.`)
  }

  // Feature 6: bulk field edit
  async function applyBulkField() {
    if (!bulkFieldName || selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    let done = 0
    setBulkFieldProgress(`Updating 0/${ids.length}…`)
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5)
      await Promise.all(batch.map(async (id) => {
        try {
          const res = await fetch('/api/admin/bulk-review/update', {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: type, id, field: bulkFieldName, value: bulkFieldValue }),
          })
          if (res.ok) {
            done++
            setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [bulkFieldName]: bulkFieldValue } : r))
          }
        } catch {}
      }))
      setBulkFieldProgress(`Updating ${Math.min(i + 5, ids.length)}/${ids.length}…`)
    }
    setBulkFieldProgress(`Done: ${done}/${ids.length} updated.`)
    setBulkFieldOpen(false)
  }

  function renderCellValue(doc: DocRecord, col: ColDef): string {
    if (col.render) return col.render(doc)
    const val = doc[col.field]
    if (val === null || val === undefined) return ''
    if (Array.isArray(val)) return val.join('; ')
    return String(val)
  }

  function renderEditInput(doc: DocRecord, col: ColDef) {
    const commit = () => commitEdit(doc.id, col.field, editValue)
    if (col.editType === 'select' && col.options) {
      return (
        <select autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commit} style={inputStyle(!!editError)}>
          <option value="">— select —</option>
          {col.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (col.editType === 'checkbox') {
      return <input type="checkbox" autoFocus checked={editValue === 'true'} onChange={(e) => setEditValue(e.target.checked ? 'true' : 'false')} onBlur={commit} />
    }
    return (
      <input
        autoFocus type={col.editType === 'number' ? 'number' : 'text'} value={editValue}
        placeholder={col.editType === 'treatments' ? 'botox, lip-filler' : col.editType === 'languages' ? 'en; es; fr' : ''}
        onChange={(e) => setEditValue(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditingCell(null); setEditError('') } }}
        style={inputStyle(!!editError)}
      />
    )
  }

  const cols = getCols(type)
  const visibleCols = cols.filter((c) => !hiddenCols.has(c.field))
  const statusOpts = getStatusOptions(type)
  const statusField = getStatusField(type)
  const allSelected = records.length > 0 && selectedIds.size === records.length
  const totalPages = Math.max(1, Math.ceil(counts.totalDocs / LIMIT))
  const currentPage = Math.floor(offset / LIMIT) + 1
  const pubLabel = type === 'reviews' ? 'approved' : 'published'
  const revLabel = type === 'reviews' ? 'pending' : 'in review'
  const dftLabel = type === 'reviews' ? 'rejected' : 'draft'
  const editableFields = cols.filter((c) => c.editable)

  // Feature 7: review mode
  if (reviewMode && records.length > 0) {
    const doc = records[Math.min(reviewIdx, records.length - 1)]
    const curStatus = String(doc[statusField] ?? '')
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Review Mode</h2>
          <span style={{ fontSize: 13, color: '#475569' }}>{reviewIdx + 1} of {records.length}</span>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setReviewMode(false)} style={btn(false, '#475569')}>Exit Review Mode</button>
        </div>
        <div style={{ ...box, padding: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{getRecordName(doc, type)}</div>
          <div style={{ marginBottom: 20 }}>
            <select value={curStatus} onChange={(e) => commitStatusChange(doc.id, e.target.value)} style={{ ...statusBadgeStyle(curStatus), border: 'none', cursor: 'pointer', appearance: 'auto' }}>
              {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {cols.map((col) => {
              const isMissing = doc.missingFields.includes(col.field)
              const displayVal = renderCellValue(doc, col)
              return (
                <div key={col.field} style={{ padding: '10px 12px', borderRadius: 6, background: isMissing ? '#FEF3C7' : 'var(--theme-elevation-100, #f8fafc)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>{col.header}</div>
                  <div style={{ fontSize: 13 }}>{displayVal || <span style={{ color: '#94A3B8' }}>—</span>}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
            <button type="button" disabled={reviewIdx === 0} onClick={() => setReviewIdx((i) => i - 1)} style={btn(reviewIdx === 0)}>← Prev</button>
            <button type="button" disabled={reviewIdx >= records.length - 1} onClick={() => setReviewIdx((i) => i + 1)} style={btn(reviewIdx >= records.length - 1)}>Next →</button>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>P = publish · R = reject/draft · Esc = exit</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Bulk Upload Review</h2>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => { setReviewIdx(0); setReviewMode(true) }} disabled={records.length === 0} style={btn(records.length === 0, '#475569')}>
          Review Mode
        </button>
      </div>

      {/* Header bar */}
      <div style={{ ...box, paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select value={type} onChange={(e) => { setType(e.target.value as EntityType); setMissingFilter(''); setStatusFilter('all') }} style={selectStyle()}>
            <option value="clinics">Entity: Clinics</option>
            <option value="providers">Entity: Providers</option>
            <option value="reviews">Entity: Reviews</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle()}>
            <option value="all">Status: All</option>
            {statusOpts.map((o) => <option key={o.value} value={o.value}>Status: {o.label}</option>)}
          </select>

          <input
            ref={batchInputRef} type="text" value={batchFilter} placeholder="Batch (Enter to filter)"
            onChange={(e) => setBatchFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyBatchFilter() }}
            onBlur={applyBatchFilter}
            style={{ ...inputStyle(), width: 200 }}
          />

          <select value={missingFilter} onChange={(e) => setMissingFilter(e.target.value)} style={selectStyle()}>
            <option value="">Missing: Any</option>
            {getMissingOptions(type).map((f) => <option key={f} value={f}>Missing: {f}</option>)}
          </select>

          {/* Feature 2: Columns toggle */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setColsMenuOpen((v) => !v)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-150, #e2e8f0)', background: 'var(--theme-elevation-100, #f1f5f9)', color: '#0B1B34', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Columns{hiddenCols.size > 0 ? ` (${hiddenCols.size} hidden)` : ''}
            </button>
            {colsMenuOpen && (
              <>
                <div onClick={() => setColsMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 48 }} />
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 49, background: '#fff', border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 8, padding: '8px 0', boxShadow: '0 4px 12px rgba(11,27,52,0.08)', minWidth: 180 }}>
                  {cols.map((col) => (
                    <label key={col.field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={!hiddenCols.has(col.field)} onChange={() => toggleCol(col.field)} />
                      {col.header}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button type="button" onClick={() => setUploadOpen((v) => !v)} style={btn(false)}>
            {uploadOpen ? 'Close Upload' : 'Upload CSV'}
          </button>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({ type })
              if (batchFilter) params.set('batch', batchFilter)
              window.location.href = `/api/admin/bulk-review/export-gaps?${params}`
            }}
            style={btn(false, '#3FA68A')}
          >
            Export Gaps CSV
          </button>
        </div>

        {/* Feature 3: Quick-filter chips */}
        {(type === 'clinics' || type === 'providers') && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 4 }}>
            {([
              { label: 'Review queue', isActive: statusFilter === 'review', action: () => { setStatusFilter('review'); setMissingFilter('') } },
              { label: 'Missing bio', isActive: missingFilter === 'bio', action: () => { setMissingFilter('bio'); setStatusFilter('all') } },
              { label: 'Missing treatments', isActive: missingFilter === 'treatmentsOffered', action: () => { setMissingFilter('treatmentsOffered'); setStatusFilter('all') } },
              { label: 'Missing Instagram', isActive: missingFilter === 'instagramUrl', action: () => { setMissingFilter('instagramUrl'); setStatusFilter('all') } },
            ] as { label: string; isActive: boolean; action: () => void }[]).map(({ label, isActive, action }) => (
              <button key={label} type="button" onClick={action} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: isActive ? '#3FA68A' : '#F1F5F9', color: isActive ? '#fff' : '#475569' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--theme-text-muted, #94A3B8)', marginTop: 6 }}>
          {isLoading ? 'Loading…' : `${counts.totalDocs} records · ${counts.publishedCount} ${pubLabel} · ${counts.reviewCount} ${revLabel} · ${counts.draftCount} ${dftLabel} · ${counts.missingAnyCount} with missing fields`}
        </div>
      </div>

      {uploadOpen && (
        <UploadPanel type={type} onSuccess={() => { setUploadOpen(false); load(type, statusFilter, batchFilter, missingFilter, offset) }} />
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px', marginBottom: 4, background: '#0B1B34', color: '#fff', borderRadius: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} selected</span>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('publish')} style={btn(bulkBusy, '#3FA68A')}>
            {type === 'reviews' ? 'Approve selected' : 'Publish selected'}
          </button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('review')} style={btn(bulkBusy, '#C2A14E')}>
            {type === 'reviews' ? 'Move to Pending' : 'Move to Review'}
          </button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('draft')} style={btn(bulkBusy, '#475569')}>
            {type === 'reviews' ? 'Reject selected' : 'Move to Draft'}
          </button>
          {/* Feature 6 trigger */}
          <button type="button" onClick={() => setBulkFieldOpen((v) => !v)} style={{ ...btn(false, '#334155'), border: '1px solid #475569' }}>
            Edit field on all selected
          </button>
          <button type="button" onClick={() => setSelectedIds(new Set())} style={{ ...btn(false, 'transparent'), color: '#94A3B8', border: '1px solid #475569' }}>
            Deselect all
          </button>
          {bulkBusy && <span style={{ fontSize: 12, opacity: 0.7 }}>Working…</span>}
          {bulkFieldProgress && <span style={{ fontSize: 12, color: '#3FA68A' }}>{bulkFieldProgress}</span>}
        </div>
      )}

      {/* Feature 6: bulk field edit form */}
      {bulkFieldOpen && selectedIds.size > 0 && (
        <div style={{ ...box, background: '#1E293B', color: '#fff', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#94A3B8' }}>Field</div>
              <select value={bulkFieldName} onChange={(e) => setBulkFieldName(e.target.value)} style={{ ...selectStyle(), background: '#334155', color: '#fff', borderColor: '#475569' }}>
                <option value="">Select field…</option>
                {editableFields.map((col) => <option key={col.field} value={col.field}>{col.header}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#94A3B8' }}>New value</div>
              <input type="text" value={bulkFieldValue} onChange={(e) => setBulkFieldValue(e.target.value)} placeholder="New value for all selected…" style={{ ...inputStyle(), background: '#334155', color: '#fff', borderColor: '#475569' }} />
            </div>
            <button type="button" disabled={!bulkFieldName} onClick={applyBulkField} style={btn(!bulkFieldName, '#3FA68A', !bulkFieldName)}>
              Apply to {selectedIds.size} record{selectedIds.size === 1 ? '' : 's'}
            </button>
            <button type="button" onClick={() => setBulkFieldOpen(false)} style={{ ...btn(false, 'transparent'), color: '#94A3B8', border: '1px solid #475569' }}>Cancel</button>
          </div>
        </div>
      )}

      {actionMessage && (
        <div style={{ fontSize: 13, color: actionMessage.includes('failed') || actionMessage.includes('error') ? '#B91C1C' : '#065F46', marginBottom: 8, padding: '8px 12px', background: actionMessage.includes('failed') || actionMessage.includes('error') ? '#FEF2F2' : '#D1FAE5', borderRadius: 6 }}>
          {actionMessage}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: 20 }}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: 20 }}>No records found.</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--theme-elevation-100, #f1f5f9)', position: 'sticky', top: 0, zIndex: 2 }}>
                {/* expand icon col */}
                <th style={{ ...thStyle, width: 28, padding: '8px 4px' }} />
                {/* Feature 1: sticky checkbox */}
                <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 3, background: 'var(--theme-elevation-100, #f1f5f9)', width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Select all" />
                </th>
                {/* Feature 1: sticky status */}
                <th style={{ ...thStyle, position: 'sticky', left: 36, zIndex: 3, background: 'var(--theme-elevation-100, #f1f5f9)' }}>Status</th>
                {visibleCols.map((c) => <th key={c.field} style={thStyle}>{c.header}</th>)}
                <th style={thStyle}>Missing</th>
              </tr>
            </thead>
            <tbody>
              {records.map((doc, rowIdx) => {
                const curStatus = String(doc[statusField] ?? '')
                const rowBg = selectedIds.has(doc.id)
                  ? 'rgba(63,166,138,0.08)'
                  : rowIdx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)'
                const total = TOTAL_FIELDS[type]
                const missing = doc.missingFields.length
                const fillPct = total > 0 ? Math.round((total - missing) / total * 100) : 100

                return (
                  <tr key={doc.id} style={{ background: rowBg }}>
                    {/* Feature 5: expand icon */}
                    <td style={{ ...tdStyle, padding: '6px 4px', cursor: 'pointer', color: '#94A3B8', fontSize: 16, textAlign: 'center' }} onClick={() => openDrawer(doc)} title="Expand record">›</td>

                    {/* Feature 1: sticky checkbox */}
                    <td style={{ ...tdStyle, position: 'sticky', left: 0, zIndex: 1, background: rowBg }} onClick={() => toggleRow(doc.id)}>
                      <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleRow(doc.id)} />
                    </td>

                    {/* Feature 1: sticky status */}
                    <td style={{ ...tdStyle, position: 'sticky', left: 36, zIndex: 1, background: rowBg }}>
                      <select value={curStatus} onChange={(e) => commitStatusChange(doc.id, e.target.value)} style={{ ...statusBadgeStyle(curStatus), border: 'none', cursor: 'pointer', appearance: 'auto' }}>
                        {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>

                    {/* Data columns */}
                    {visibleCols.map((col) => {
                      const isEditing = editingCell?.id === doc.id && editingCell?.field === col.field
                      const isMissing = doc.missingFields.includes(col.field)
                      const displayVal = renderCellValue(doc, col)
                      return (
                        <td
                          key={col.field}
                          style={{ ...tdStyle, background: isMissing ? '#FEF3C7' : 'transparent', cursor: col.editable && !isEditing ? 'pointer' : 'default', maxWidth: 160 }}
                          onClick={() => { if (col.editable && !isEditing) startEdit(doc.id, col.field, doc[col.field]) }}
                          title={col.editable && !isEditing ? 'Click to edit' : undefined}
                        >
                          {isEditing ? (
                            <div>
                              {renderEditInput(doc, col)}
                              {editError && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>{editError}</div>}
                            </div>
                          ) : displayVal ? (
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{displayVal}</span>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Feature 4: completeness bar */}
                    <td style={{ ...tdStyle, textAlign: 'center', minWidth: 80 }}>
                      {missing > 0 ? (
                        <div>
                          <span title={doc.missingFields.join(', ')} style={{ display: 'inline-block', background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 11, padding: '2px 7px', borderRadius: 999, cursor: 'help', marginBottom: 3 }}>
                            {missing}
                          </span>
                          <div style={{ width: '100%', height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }} title={doc.missingFields.join(', ')}>
                            <div style={{ height: '100%', width: `${fillPct}%`, background: '#3FA68A', borderRadius: 2 }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#3FA68A', fontWeight: 700 }}>✓</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && records.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, marginTop: 12, color: 'var(--theme-text-muted, #94A3B8)' }}>
          <button type="button" disabled={offset === 0} onClick={() => handlePage('prev')} style={btn(offset === 0)}>← Prev</button>
          <span>Showing {offset + 1}–{Math.min(offset + LIMIT, counts.totalDocs)} of {counts.totalDocs} · Page {currentPage} / {totalPages}</span>
          <button type="button" disabled={offset + LIMIT >= counts.totalDocs} onClick={() => handlePage('next')} style={btn(offset + LIMIT >= counts.totalDocs)}>Next →</button>
        </div>
      )}

      {/* Feature 5: expand drawer */}
      {expandedDoc && (
        <>
          <div onClick={() => setExpandedDoc(null)} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.25)' }} />
          <div style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 420, zIndex: 100, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
              <strong style={{ fontSize: 15 }}>{getRecordName(expandedDoc, type)}</strong>
              <button type="button" onClick={() => setExpandedDoc(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#475569', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {getCols(type).filter((c) => c.editable).map((col) => {
                const isMissing = expandedDoc.missingFields.includes(col.field)
                return (
                  <div key={col.field} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#475569' }}>
                      {col.header}{isMissing && <span style={{ color: '#C2A14E', marginLeft: 6, fontWeight: 400 }}>missing</span>}
                    </label>
                    {col.editType === 'select' && col.options ? (
                      <select value={drawerEdits[col.field] ?? ''} onChange={(e) => setDrawerEdits((prev) => ({ ...prev, [col.field]: e.target.value }))} style={{ ...inputStyle(), background: isMissing ? '#FFFBEB' : undefined }}>
                        <option value="">— select —</option>
                        {col.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={col.editType === 'number' ? 'number' : 'text'}
                        value={drawerEdits[col.field] ?? ''}
                        onChange={(e) => setDrawerEdits((prev) => ({ ...prev, [col.field]: e.target.value }))}
                        style={{ ...inputStyle(), background: isMissing ? '#FFFBEB' : undefined }}
                        placeholder={col.editType === 'treatments' ? 'botox, lip-filler' : col.editType === 'languages' ? 'en; es; fr' : ''}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
              {drawerMsg && <div style={{ fontSize: 12, marginBottom: 8, color: '#065F46' }}>{drawerMsg}</div>}
              <button type="button" disabled={drawerBusy} onClick={saveDrawer} style={btn(drawerBusy, '#3FA68A')}>
                {drawerBusy ? 'Saving…' : 'Save all changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UploadPanel({ type, onSuccess }: { type: EntityType; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false)

  async function doImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg('Select a CSV file first.'); setIsError(true); return }
    setBusy(true); setMsg(''); setIsError(false)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('record_type', type === 'clinics' ? 'clinic' : type === 'providers' ? 'provider' : 'review')
      fd.set('combined', file)
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Import failed.'); setIsError(true); return }
      const r = json.report
      const c = r?.clinics || {}; const p = r?.providers || {}; const rv = r?.reviews || {}
      const total = (c.created || 0) + (p.created || 0) + (rv.created || 0)
      const updated = (c.updated || 0) + (p.updated || 0) + (rv.updated || 0)
      const parts: string[] = []
      if (c.publishedCount) parts.push(`${c.publishedCount} published`)
      if (c.reviewCount) parts.push(`${c.reviewCount} review`)
      if (c.draftCount) parts.push(`${c.draftCount} draft`)
      const treatStr = r?.clinics?.treatmentsAutoCreated?.length ? ` · ${r.clinics.treatmentsAutoCreated.length} treatments auto-created: ${r.clinics.treatmentsAutoCreated.join(', ')}` : ''
      setMsg(`Imported ${total} new, ${updated} updated${parts.length ? ' — ' + parts.join(' · ') : ''}${treatStr}`)
      setIsError(false)
      if (!r?.dryRun) setTimeout(() => onSuccess(), 1500)
    } catch { setMsg('Network error during import.'); setIsError(true) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ ...box, borderLeft: '4px solid #3FA68A', marginBottom: 8 }}>
      <strong style={{ fontSize: 14 }}>Upload CSV</strong>
      <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
        Upload a CSV file for {type}. Uses the standard combined import format (record_type column).
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input ref={fileRef} type="file" accept=".csv" style={{ fontSize: 12 }} />
        <button type="button" disabled={busy} onClick={doImport} style={btn(busy, '#3FA68A')}>
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
      {msg && (
        <div style={{ fontSize: 12, marginTop: 10, color: isError ? '#B91C1C' : '#065F46', padding: '6px 10px', background: isError ? '#FEF2F2' : '#D1FAE5', borderRadius: 6 }}>
          {isError ? '' : '✓ '}{msg}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)',
  whiteSpace: 'nowrap',
  color: 'var(--theme-text-muted, #475569)',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)',
  verticalAlign: 'middle',
}
