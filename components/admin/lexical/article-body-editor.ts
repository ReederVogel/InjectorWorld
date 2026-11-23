/**
 * Rich text editor for the Guides and News body (field-level, so every other
 * richText field in the admin keeps the plain default editor).
 *
 * Adds two things on top of Payload's default features, both UI only (no new
 * node types, so stored content and the site's renderer are unaffected):
 *   - FixedToolbarFeature: formatting buttons always visible above the body,
 *     sticky under the Save bar while scrolling a long article;
 *   - FindInBodyFeature: a search button in that toolbar that opens the
 *     "Find in this article" box limited to the body.
 */

import { FixedToolbarFeature, createServerFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

const FindInBodyFeature = createServerFeature({
  feature: {
    ClientFeature: '/components/admin/lexical/FindInBodyFeature.client#FindInBodyFeatureClient',
  },
  key: 'iwFindInBody',
})

export const articleBodyEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [...defaultFeatures, FixedToolbarFeature(), FindInBodyFeature()],
})

/** UI-only field shown under the body: word count and a read-time suggestion. */
export const BODY_STATS_COMPONENT = '/components/admin/lexical/BodyStats#BodyStats'
