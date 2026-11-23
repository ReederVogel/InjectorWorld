import type { FindField } from './find-engine'

/**
 * Which fields the "Find in this article" box searches on each edit page, in
 * page order (results are listed in this order). Plain data, so collection
 * configs can import it without pulling in client code.
 *
 * Left out on purpose: slug (editing it changes the url), internalLinks
 * (anchor text there must match the body exactly or the link is lost), and
 * system fields nobody edits by hand.
 */

export const FIND_IN_DOCUMENT = '/components/admin/find/FindInDocument#FindInDocument'

/** Form editors that replace Payload's JSON code editor on these fields. */
export const JSON_FORM_FIELDS = {
  glance: '/components/admin/json-forms/JsonFormFields#GlanceField',
  faq: '/components/admin/json-forms/JsonFormFields#FaqField',
  sources: '/components/admin/json-forms/JsonFormFields#SourcesField',
} as const

export const GUIDE_FIND_FIELDS: FindField[] = [
  { path: 'title', label: 'Title', kind: 'text' },
  { path: 'lede', label: 'Lede', kind: 'textarea' },
  { path: 'excerpt', label: 'Excerpt', kind: 'textarea' },
  { path: 'body', label: 'Body', kind: 'richText' },
  { path: 'answerSnippet', label: 'Answer snippet', kind: 'textarea' },
  { path: 'atAGlance', label: 'At a glance', kind: 'json' },
  { path: 'faq', label: 'FAQ', kind: 'json' },
  { path: 'sources', label: 'Sources', kind: 'json' },
  { path: 'focusKeyword', label: 'Focus keyword', kind: 'text' },
  { path: 'meta.title', label: 'SEO title', kind: 'text' },
  { path: 'meta.description', label: 'SEO description', kind: 'textarea' },
]

export const NEWS_FIND_FIELDS: FindField[] = [
  { path: 'title', label: 'Title', kind: 'text' },
  { path: 'excerpt', label: 'Excerpt', kind: 'textarea' },
  { path: 'body', label: 'Body', kind: 'richText' },
  { path: 'answerSnippet', label: 'Answer snippet', kind: 'textarea' },
  { path: 'atAGlance', label: 'At a glance', kind: 'json' },
  { path: 'faq', label: 'FAQ', kind: 'json' },
  { path: 'sources', label: 'Sources', kind: 'json' },
  { path: 'focusKeyword', label: 'Focus keyword', kind: 'text' },
  { path: 'meta.title', label: 'SEO title', kind: 'text' },
  { path: 'meta.description', label: 'SEO description', kind: 'textarea' },
]
