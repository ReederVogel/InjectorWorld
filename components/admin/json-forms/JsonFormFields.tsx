'use client'

/**
 * Form editors for the Guides and News JSON fields: At a glance, FAQ, Sources.
 * See json-form-kit.tsx for why they replace Payload's JSON code editor.
 *
 * Shapes, as stored (checked on staging 2026-11-23, 100 guides + 125 news):
 *   atAGlance: string[], where a string starting "(table)" is a table in raw
 *              text, plus one {type:'table', title, columns[], rows[][]}
 *   faq:       {question, answer, detail?}[] (the site also reads offLabel and
 *              safetyFlag; no article uses them, and they are kept if present)
 *   sources:   {url, title, publisher, sourceType, publishedDate, claimsSupported[]}[]
 */

import type { ReactNode } from 'react'
import {
  IconButton,
  JsonListField,
  K,
  RemoveButton,
  TextControl,
  isPlainObject,
  leafId,
  otherKeys,
  removeAt,
  replaceAt,
  type ItemContext,
} from './json-form-kit'

type FieldProps = {
  path?: string
  field: { name: string; label?: unknown; required?: boolean; admin?: { description?: unknown } }
  readOnly?: boolean
}

const asText = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)

function Unsupported({ item, children }: { item: unknown; children?: ReactNode }) {
  return (
    <>
      <span style={K.hint}>{children ?? 'This item has a shape the form does not cover. Use "Edit as JSON" to change it.'}</span>
      <pre style={K.pre}>{JSON.stringify(item, null, 2)}</pre>
    </>
  )
}

function OtherKeysNote({ keys }: { keys: string[] }) {
  if (!keys.length) return null
  return (
    <span style={K.hint}>
      Also stored on this item: {keys.join(', ')}. Kept as is; change them with "Edit as JSON".
    </span>
  )
}

/* ── At a glance ───────────────────────────────────────────────────────── */

type GlanceTable = { type: 'table'; title?: string; columns: string[]; rows: string[][] }

const isGlanceTable = (v: unknown): v is GlanceTable =>
  isPlainObject(v) &&
  v.type === 'table' &&
  Array.isArray(v.columns) &&
  v.columns.every((c) => typeof c === 'string') &&
  Array.isArray(v.rows) &&
  v.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))

export function GlanceField(props: FieldProps) {
  return (
    <JsonListField
      {...props}
      noun="fact"
      newItem={() => ''}
      compact={(item) => typeof item === 'string'}
      itemTitle={(item) =>
        typeof item === 'string' && item.startsWith('(table)') ? 'Table' : isGlanceTable(item) ? 'Table' : undefined
      }
      renderItem={(item, ctx) => {
        if (typeof item === 'string') {
          const isTable = item.startsWith('(table)')
          return (
            <TextControl
              id={leafId(ctx.path, [ctx.index])}
              value={item}
              multiline
              mono={isTable}
              readOnly={ctx.readOnly}
              placeholder="One short fact"
              warn={item.trim() ? undefined : 'Empty: it would show as a blank bullet. Type a fact or remove it.'}
              hint={
                isTable
                  ? 'Table written as text: starts with "(table)", cells split by |, rows by || or ;;. Keep that format.'
                  : undefined
              }
              onChange={ctx.update}
            />
          )
        }
        if (isGlanceTable(item)) return <TableEditor table={item} ctx={ctx} />
        return <Unsupported item={item} />
      }}
    />
  )
}

function TableEditor({ table, ctx }: { table: GlanceTable; ctx: ItemContext }) {
  const { path, index, readOnly } = ctx
  const set = (patch: Partial<GlanceTable>) => ctx.update({ ...table, ...patch })
  const width = table.columns.length
  const setCell = (r: number, c: number, v: string) =>
    set({ rows: replaceAt(table.rows, r, replaceAt(padRow(table.rows[r], width), c, v)) })
  return (
    <>
      <TextControl
        id={leafId(path, [index, 'title'])}
        label="Table title"
        value={asText(table.title)}
        readOnly={readOnly}
        onChange={(v) => set({ title: v })}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 6, minWidth: '100%' }}>
          <thead>
            <tr>
              {table.columns.map((col, c) => (
                <th key={c} style={{ textAlign: 'left', fontWeight: 600, verticalAlign: 'bottom' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CellInput
                      id={leafId(path, [index, 'columns', c])}
                      value={col}
                      readOnly={readOnly}
                      bold
                      ariaLabel={`Column ${c + 1} heading`}
                      onChange={(v) => set({ columns: replaceAt(table.columns, c, v) })}
                    />
                    {!readOnly && width > 1 && (
                      <IconButton
                        title={`Remove column ${c + 1}`}
                        onClick={() =>
                          set({ columns: removeAt(table.columns, c), rows: table.rows.map((row) => removeAt(row, c)) })
                        }
                      >
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                      </IconButton>
                    )}
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {table.columns.map((_, c) => (
                  <td key={c}>
                    <CellInput
                      id={leafId(path, [index, 'rows', r, c])}
                      value={asText(row[c])}
                      readOnly={readOnly}
                      ariaLabel={`Row ${r + 1}, column ${c + 1}`}
                      onChange={(v) => setCell(r, c, v)}
                    />
                  </td>
                ))}
                <td>
                  {!readOnly && (
                    <IconButton title={`Remove row ${r + 1}`} onClick={() => set({ rows: removeAt(table.rows, r) })}>
                      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            type="button"
            className="iw-jf-link"
            style={K.linkButton}
            onClick={() => set({ rows: [...table.rows, Array.from({ length: width }, () => '')] })}
          >
            + Add row
          </button>
          <button
            type="button"
            className="iw-jf-link"
            style={K.linkButton}
            onClick={() => set({ columns: [...table.columns, ''], rows: table.rows.map((row) => [...padRow(row, width), '']) })}
          >
            + Add column
          </button>
        </div>
      )}
    </>
  )
}

const padRow = (row: string[], width: number) =>
  row.length >= width ? row : [...row, ...Array.from({ length: width - row.length }, () => '')]

function CellInput({
  id,
  value,
  readOnly,
  bold,
  ariaLabel,
  onChange,
}: {
  id: string
  value: string
  readOnly: boolean
  bold?: boolean
  ariaLabel: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      id={id}
      className="iw-jf-input"
      aria-label={ariaLabel}
      value={value}
      rows={1}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...K.input, ...K.textarea, minHeight: 38, minWidth: 150, resize: 'none', fontWeight: bold ? 600 : undefined }}
    />
  )
}

/* ── FAQ ───────────────────────────────────────────────────────────────── */

const FAQ_KEYS = ['question', 'answer', 'detail']

export function FaqField(props: FieldProps) {
  return (
    <JsonListField
      {...props}
      noun="question"
      newItem={() => ({ question: '', answer: '' })}
      itemTitle={(item) => (isPlainObject(item) && typeof item.question === 'string' ? short(item.question) : undefined)}
      renderItem={(item, ctx) => {
        if (!isPlainObject(item)) return <Unsupported item={item} />
        const set = (key: string, v: string) => ctx.update({ ...item, [key]: v })
        const hasDetail = 'detail' in item
        return (
          <>
            <TextControl
              id={leafId(ctx.path, [ctx.index, 'question'])}
              label="Question"
              value={asText(item.question)}
              readOnly={ctx.readOnly}
              warn={asText(item.question).trim() ? undefined : 'A question is needed.'}
              onChange={(v) => set('question', v)}
            />
            <TextControl
              id={leafId(ctx.path, [ctx.index, 'answer'])}
              label="Answer"
              value={asText(item.answer)}
              multiline
              readOnly={ctx.readOnly}
              warn={asText(item.answer).trim() ? undefined : 'An answer is needed.'}
              onChange={(v) => set('answer', v)}
            />
            {hasDetail ? (
              <>
                <TextControl
                  id={leafId(ctx.path, [ctx.index, 'detail'])}
                  label="More detail (shown under the answer)"
                  value={asText(item.detail)}
                  multiline
                  readOnly={ctx.readOnly}
                  onChange={(v) => set('detail', v)}
                />
                {!ctx.readOnly && (
                  <span>
                    <RemoveButton
                      label="Remove detail"
                      onRemove={() => {
                        const { detail: _drop, ...rest } = item
                        ctx.update(rest)
                      }}
                    />
                  </span>
                )}
              </>
            ) : (
              !ctx.readOnly && (
                <span>
                  <button type="button" className="iw-jf-link" style={K.linkButton} onClick={() => set('detail', '')}>
                    + Add more detail
                  </button>
                </span>
              )
            )}
            <OtherKeysNote keys={otherKeys(item, FAQ_KEYS)} />
          </>
        )
      }}
    />
  )
}

/* ── Sources ───────────────────────────────────────────────────────────── */

const SOURCE_KEYS = ['url', 'title', 'publisher', 'sourceType', 'publishedDate', 'claimsSupported']
const SOURCE_TYPES = ['primary', 'secondary', 'tertiary', 'manufacturer', 'news', 'regulatory', 'research']

export function SourcesField(props: FieldProps) {
  const path = props.path ?? props.field.name
  const typesListId = `iw-jf-${path.replace(/\./g, '-')}-types`
  return (
    <>
      <datalist id={typesListId}>
        {SOURCE_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <JsonListField
        {...props}
        noun="source"
        newItem={() => ({ url: '', title: '', publisher: '', sourceType: '', publishedDate: '', claimsSupported: [] })}
        itemTitle={(item) => (isPlainObject(item) && typeof item.title === 'string' ? short(item.title) : undefined)}
        renderItem={(item, ctx) => {
          if (!isPlainObject(item)) return <Unsupported item={item} />
          const set = (key: string, v: unknown) => ctx.update({ ...item, [key]: v })
          const url = asText(item.url)
          const claims = Array.isArray(item.claimsSupported) ? item.claimsSupported : []
          const claimsEditable = claims.every((c) => typeof c === 'string')
          return (
            <>
              <div style={K.grid2}>
                <TextControl
                  id={leafId(ctx.path, [ctx.index, 'title'])}
                  label="Title"
                  value={asText(item.title)}
                  readOnly={ctx.readOnly}
                  warn={asText(item.title).trim() ? undefined : 'A title is needed.'}
                  onChange={(v) => set('title', v)}
                />
                <TextControl
                  id={leafId(ctx.path, [ctx.index, 'url'])}
                  label="Link"
                  value={url}
                  readOnly={ctx.readOnly}
                  placeholder="https://"
                  warn={url && !/^https?:\/\//i.test(url) ? 'Links should start with https://' : undefined}
                  hint={
                    /^https?:\/\//i.test(url) ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                        Open link in a new tab
                      </a>
                    ) : undefined
                  }
                  onChange={(v) => set('url', v)}
                />
              </div>
              <div style={K.grid3}>
                <TextControl
                  id={leafId(ctx.path, [ctx.index, 'publisher'])}
                  label="Publisher"
                  value={asText(item.publisher)}
                  readOnly={ctx.readOnly}
                  onChange={(v) => set('publisher', v)}
                />
                <TextControl
                  id={leafId(ctx.path, [ctx.index, 'sourceType'])}
                  label="Type"
                  value={asText(item.sourceType)}
                  readOnly={ctx.readOnly}
                  list={typesListId}
                  placeholder="primary, news…"
                  onChange={(v) => set('sourceType', v)}
                />
                <TextControl
                  id={leafId(ctx.path, [ctx.index, 'publishedDate'])}
                  label="Date"
                  value={asText(item.publishedDate)}
                  readOnly={ctx.readOnly}
                  placeholder="2025-06-30, 2025-06 or 2025"
                  onChange={(v) => set('publishedDate', v)}
                />
              </div>
              {claimsEditable ? (
                <div style={K.control}>
                  <span style={K.controlLabel}>Claims this source supports</span>
                  {claims.map((claim, k) => (
                    <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <TextControl
                          id={leafId(ctx.path, [ctx.index, 'claimsSupported', k])}
                          value={claim as string}
                          multiline
                          readOnly={ctx.readOnly}
                          onChange={(v) => set('claimsSupported', replaceAt(claims, k, v))}
                        />
                      </div>
                      {!ctx.readOnly && (
                        <IconButton title={`Remove claim ${k + 1}`} onClick={() => set('claimsSupported', removeAt(claims, k))}>
                          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                        </IconButton>
                      )}
                    </div>
                  ))}
                  {!ctx.readOnly && (
                    <span>
                      <button
                        type="button"
                        className="iw-jf-link"
                        style={K.linkButton}
                        onClick={() => set('claimsSupported', [...claims, ''])}
                      >
                        + Add claim
                      </button>
                    </span>
                  )}
                </div>
              ) : (
                <Unsupported item={item.claimsSupported}>Claims are stored in a shape the form does not cover.</Unsupported>
              )}
              <OtherKeysNote keys={otherKeys(item, SOURCE_KEYS)} />
            </>
          )
        }}
      />
    </>
  )
}
