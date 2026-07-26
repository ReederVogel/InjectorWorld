export type AtAGlanceFact =
  | string
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] }

/**
 * Renders the "At a glance" block. Most facts are plain strings (bulleted),
 * but some content batches embed an actual {type:'table', columns, rows}
 * object as one of the facts instead of a string -- rendering that directly
 * as a bullet's children crashes React ("Objects are not valid as a React
 * child"), which is exactly what broke the /guides/liquid-rhinoplasty build.
 * Handle both shapes explicitly instead of assuming every fact is a string.
 */
export function AtAGlanceList({ facts }: { facts: AtAGlanceFact[] }) {
  if (!facts || facts.length === 0) return null

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 text-caption font-semibold uppercase tracking-wider text-ink-secondary">At a glance</div>
      <ul className="space-y-2">
        {facts.map((fact, i) => {
          if (typeof fact === 'string') {
            return (
              <li key={i} className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                <svg
                  className="mt-0.5 flex-shrink-0"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgb(var(--brand-accent))"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {fact}
              </li>
            )
          }

          if (fact && fact.type === 'table' && Array.isArray(fact.columns) && Array.isArray(fact.rows)) {
            return (
              <li key={i} className="list-none">
                <div className="lex-table-wrap">
                  {fact.title && <div className="mb-2 text-body-sm font-semibold text-ink-primary">{fact.title}</div>}
                  <table>
                    <thead>
                      <tr>
                        {fact.columns.map((col, ci) => (
                          <th key={ci}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fact.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            )
          }

          return null
        })}
      </ul>
    </div>
  )
}
