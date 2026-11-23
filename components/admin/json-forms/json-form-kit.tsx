'use client'

/**
 * Building blocks for the form editors that replace Payload's JSON code
 * editor on Guides and News (At a glance, FAQ, Sources).
 *
 * Why: Payload's JSON field loads the Monaco editor from cdn.jsdelivr.net,
 * which the site's Content-Security-Policy does not allow, so those fields
 * never finished loading in the admin. Typing JSON by hand was also the
 * hardest part of editing an article.
 *
 * The stored value does not change shape. Each editor reads and writes the
 * same JSON array the site already renders, keeps every key it does not know
 * about, and keeps key order, so nothing else in the codebase is affected.
 * "Edit as JSON" switches to a plain textarea (no Monaco) for anything the
 * form does not cover.
 */

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { fieldDomId, jsonLeafDomId } from '../find/find-dom'

export type JsonPath = (string | number)[]

export const leafId = jsonLeafDomId

/* ── Array helpers (never mutate: the value belongs to the form) ───────── */

export const replaceAt = <T,>(list: T[], i: number, value: T): T[] => list.map((x, j) => (j === i ? value : x))
export const removeAt = <T,>(list: T[], i: number): T[] => list.filter((_, j) => j !== i)
export const moveItem = <T,>(list: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const copy = list.slice()
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Keys of an item that the form does not show, so the editor can say they exist. */
export const otherKeys = (item: Record<string, unknown>, known: string[]) =>
  Object.keys(item).filter((k) => !known.includes(k))

/* ── Field state ───────────────────────────────────────────────────────── */

type FieldProps = {
  path?: string
  field: { name: string; label?: unknown; required?: boolean; admin?: { description?: unknown } }
  readOnly?: boolean
}

/**
 * The field's value as a list. `list` is null when the stored value is not
 * a list at all (then only "Edit as JSON" can change it). Missing or empty
 * values read as an empty list without writing anything back.
 */
function useJsonList(path: string) {
  const { value, setValue, showError, errorMessage, disabled } = useField<unknown>({ path })
  let parsed: unknown = value
  if (typeof parsed === 'string') {
    try {
      parsed = parsed.trim() ? JSON.parse(parsed) : []
    } catch {
      parsed = undefined
    }
  }
  const list = parsed == null ? [] : Array.isArray(parsed) ? (parsed as unknown[]) : null
  return { value, list, setValue: setValue as (v: unknown) => void, showError, errorMessage, disabled }
}

/* ── The list editor ───────────────────────────────────────────────────── */

export type ItemContext = {
  path: string
  index: number
  readOnly: boolean
  update: (next: unknown) => void
}

type JsonListFieldProps = FieldProps & {
  /** "fact", "question", "source": used in buttons and the empty state. */
  noun: string
  newItem: () => unknown
  renderItem: (item: unknown, ctx: ItemContext) => ReactNode
  /** Short text shown in the item's header, e.g. the question. */
  itemTitle?: (item: unknown) => string | undefined
  /** One-line layout (number, control, actions side by side) for short items. */
  compact?: (item: unknown) => boolean
}

export function JsonListField(props: JsonListFieldProps) {
  const path = props.path ?? props.field.name
  const { value, list, setValue, showError, errorMessage, disabled } = useJsonList(path)
  const readOnly = !!props.readOnly || disabled
  const [raw, setRaw] = useState(list === null)

  const setList = (next: unknown[]) => setValue(next)
  const description = typeof props.field.admin?.description === 'string' ? props.field.admin.description : undefined

  return (
    <div className="field-type json-field iw-jf" style={K.root}>
      <style>{KIT_CSS}</style>
      <div style={K.labelRow}>
        <FieldLabel label={props.field.label as any} path={path} required={props.field.required} />
        <span style={K.labelTools}>
          {list && !raw && (
            <span style={K.count}>
              {list.length} {list.length === 1 ? props.noun : `${props.noun}s`}
            </span>
          )}
          <button
            type="button"
            className="iw-jf-link"
            style={K.linkButton}
            onClick={() => setRaw((r) => !r)}
            disabled={raw && list === null}
            title={raw ? 'Back to the form' : 'Edit the stored JSON directly'}
          >
            {raw ? 'Back to form' : 'Edit as JSON'}
          </button>
        </span>
      </div>
      <FieldError path={path} showError={showError} message={errorMessage} />

      {raw ? (
        <RawJsonEditor id={fieldDomId(path)} value={value} readOnly={readOnly} onValid={setValue} />
      ) : list === null ? (
        <p style={K.note}>This value is not a list, so it can only be edited as JSON.</p>
      ) : (
        <div style={K.list}>
          {list.length === 0 && <p style={K.empty}>No {props.noun}s yet.</p>}
          {list.map((item, index) => (
            <ItemCard
              key={index}
              index={index}
              count={list.length}
              title={props.itemTitle?.(item)}
              compact={props.compact?.(item) ?? false}
              readOnly={readOnly}
              onMove={(dir) => setList(moveItem(list, index, dir))}
              onRemove={() => setList(removeAt(list, index))}
            >
              {props.renderItem(item, {
                path,
                index,
                readOnly,
                update: (next) => setList(replaceAt(list, index, next)),
              })}
            </ItemCard>
          ))}
          {!readOnly && (
            <button type="button" className="iw-jf-add" style={K.addButton} onClick={() => setList([...list, props.newItem()])}>
              + Add {props.noun}
            </button>
          )}
        </div>
      )}
      {description && <FieldDescription description={description} path={path} />}
    </div>
  )
}

function ItemCard({
  index,
  count,
  title,
  compact,
  readOnly,
  onMove,
  onRemove,
  children,
}: {
  index: number
  count: number
  title?: string
  compact: boolean
  readOnly: boolean
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  children: ReactNode
}) {
  const actions = !readOnly && (
    <span style={{ ...K.cardActions, ...(compact ? { paddingTop: 7 } : null) }}>
      <IconButton title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
        <path d="M4 10l4-4 4 4" />
      </IconButton>
      <IconButton title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
        <path d="M4 6l4 4 4-4" />
      </IconButton>
      <RemoveButton onRemove={onRemove} />
    </span>
  )
  if (compact) {
    return (
      <div style={{ ...K.card, ...K.compactCard }}>
        <span style={{ ...K.cardNumber, paddingTop: 10, minWidth: 22 }}>#{index + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {actions}
      </div>
    )
  }
  return (
    <div style={K.card}>
      <div style={K.cardHead}>
        <span style={K.cardNumber}>#{index + 1}</span>
        {title && <span style={K.cardTitle}>{title}</span>}
        {actions}
      </div>
      <div style={K.cardBody}>{children}</div>
    </div>
  )
}

/** Two clicks to remove: the first arms the button for three seconds. */
export function RemoveButton({ onRemove, label = 'Remove' }: { onRemove: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      className="iw-jf-link"
      style={{ ...K.linkButton, ...(armed ? K.removeArmed : null) }}
      title={armed ? 'Click again to remove' : label}
      onClick={() => {
        if (armed) {
          clearTimeout(timer.current)
          setArmed(false)
          onRemove()
          return
        }
        setArmed(true)
        timer.current = setTimeout(() => setArmed(false), 3000)
      }}
    >
      {armed ? 'Click again to remove' : label}
    </button>
  )
}

export function IconButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="iw-jf-icon"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{ ...K.iconButton, ...(disabled ? { opacity: 0.3, cursor: 'default' } : null) }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

/* ── Inputs ────────────────────────────────────────────────────────────── */

export function TextControl({
  id,
  label,
  value,
  onChange,
  multiline,
  placeholder,
  readOnly,
  mono,
  hint,
  warn,
  list,
}: {
  id: string
  label?: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
  readOnly?: boolean
  mono?: boolean
  hint?: ReactNode
  warn?: string
  list?: string
}) {
  const style = { ...K.input, ...(mono ? K.mono : null), ...(warn ? K.inputWarn : null) }
  return (
    <div style={K.control}>
      {label && (
        <label htmlFor={id} style={K.controlLabel}>
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          id={id}
          className="iw-jf-input"
          value={value}
          rows={2}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...style, ...K.textarea }}
        />
      ) : (
        <input
          id={id}
          className="iw-jf-input"
          type="text"
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          list={list}
          onChange={(e) => onChange(e.target.value)}
          style={style}
        />
      )}
      {warn && <span style={K.warn}>{warn}</span>}
      {hint && <span style={K.hint}>{hint}</span>}
    </div>
  )
}

/** Plain-textarea JSON editor. Writes to the field only while the text is valid JSON. */
function RawJsonEditor({
  id,
  value,
  readOnly,
  onValid,
}: {
  id: string
  value: unknown
  readOnly: boolean
  onValid: (v: unknown) => void
}) {
  const [text, setText] = useState(() =>
    value == null || value === '' ? '[]' : typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  )
  const [error, setError] = useState('')
  return (
    <div style={K.control}>
      <textarea
        id={id}
        className="iw-jf-input"
        value={text}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          try {
            const parsed = next.trim() ? JSON.parse(next) : null
            setError('')
            onValid(parsed)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid JSON')
          }
        }}
        style={{ ...K.input, ...K.mono, ...K.textarea, minHeight: 160 }}
      />
      {error ? (
        <span style={K.warn}>Not valid JSON yet, so it is not saved: {error}</span>
      ) : (
        <span style={K.hint}>Changes apply as you type while the JSON is valid. Save as usual.</span>
      )}
    </div>
  )
}

/* ── Styles ────────────────────────────────────────────────────────────── */

const KIT_CSS = `
.iw-jf .iw-jf-input:focus { border-color: var(--theme-elevation-400) !important; outline: none; }
.iw-jf .iw-jf-input[readonly] { opacity: 0.7; }
.iw-jf .iw-jf-icon:hover:not(:disabled) { background: var(--theme-elevation-150); }
.iw-jf .iw-jf-link:hover:not(:disabled) { color: var(--theme-elevation-1000); text-decoration: underline; }
.iw-jf .iw-jf-add:hover { border-color: var(--theme-elevation-400); color: var(--theme-elevation-1000); }
`

export const K: Record<string, CSSProperties> = {
  root: { marginBottom: 'var(--spacing-field, 24px)' },
  labelRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  labelTools: { display: 'inline-flex', alignItems: 'baseline', gap: 12, flexShrink: 0 },
  count: { fontSize: 12, color: 'var(--theme-elevation-500)' },
  linkButton: {
    padding: 0,
    border: 0,
    background: 'transparent',
    color: 'var(--theme-elevation-650)',
    fontFamily: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
  },
  removeArmed: { color: 'var(--theme-error-500, #B91C1C)', fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  empty: { margin: 0, fontSize: 13, color: 'var(--theme-elevation-500)' },
  note: { margin: 0, fontSize: 13, color: 'var(--theme-elevation-600)' },
  card: {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-m, 6px)',
    background: 'var(--theme-elevation-50)',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px 6px 12px',
    borderBottom: '1px solid var(--theme-elevation-100)',
    minHeight: 34,
  },
  cardNumber: { fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-500)', fontVariantNumeric: 'tabular-nums' },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: 'var(--theme-elevation-700)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardActions: { display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 10, padding: 12 },
  compactCard: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px 6px 12px' },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    padding: 0,
    border: 0,
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'transparent',
    color: 'var(--theme-elevation-700)',
    cursor: 'pointer',
  },
  addButton: {
    padding: '9px 12px',
    border: '1px dashed var(--theme-elevation-250)',
    borderRadius: 'var(--style-radius-m, 6px)',
    background: 'transparent',
    color: 'var(--theme-elevation-700)',
    fontFamily: 'inherit',
    fontSize: 13,
    textAlign: 'left',
    cursor: 'pointer',
  },
  control: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  controlLabel: { fontSize: 12, color: 'var(--theme-elevation-600)' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'var(--theme-input-bg, var(--theme-elevation-0))',
    color: 'var(--theme-elevation-800)',
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: '20px',
  },
  textarea: { resize: 'vertical', minHeight: 38, fieldSizing: 'content' } as CSSProperties,
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 },
  inputWarn: { borderColor: 'var(--theme-warning-500, #C2A14E)' },
  warn: { fontSize: 12, color: 'var(--theme-warning-700, #8a6d1f)' },
  hint: { fontSize: 12, color: 'var(--theme-elevation-500)' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  tag: {
    alignSelf: 'flex-start',
    padding: '1px 6px',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'var(--theme-elevation-150)',
    color: 'var(--theme-elevation-700)',
    fontSize: 11,
    fontWeight: 600,
  },
  pre: {
    margin: 0,
    padding: 10,
    maxHeight: 220,
    overflow: 'auto',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'var(--theme-elevation-100)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
}
