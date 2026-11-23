'use client'

/**
 * A search button in the body editor's fixed toolbar. It opens the "Find in
 * this article" box limited to this editor's field, prefilled with the
 * selected text. The box does the searching (components/admin/find).
 */

import { createClientFeature, toolbarFeatureButtonsGroupWithItems } from '@payloadcms/richtext-lexical/client'
import type { LexicalEditor } from 'lexical'
import { FIND_OPEN_EVENT, type FindOpenDetail } from '../find/find-events'

function FindInBodyButton({ editor }: { editor: LexicalEditor }) {
  return (
    <button
      type="button"
      className="toolbar-popup__button toolbar-popup__button-iwFindInBody"
      title="Find in this field"
      aria-label="Find in this field"
      // Keep the editor's selection: it becomes the search text.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const root = editor.getRootElement()
        if (!root) return
        const sel = window.getSelection()
        const prefill = sel && sel.rangeCount && root.contains(sel.anchorNode) ? sel.toString() : ''
        root.dispatchEvent(
          new CustomEvent<FindOpenDetail>(FIND_OPEN_EVENT, { bubbles: true, detail: { prefill } }),
        )
      }}
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
    </button>
  )
}

export const FindInBodyFeatureClient = createClientFeature({
  toolbarFixed: {
    groups: [
      toolbarFeatureButtonsGroupWithItems([
        {
          key: 'iwFindInBody',
          Component: FindInBodyButton as any,
          order: 100,
        },
      ]),
    ],
  },
})
