import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * Reusable audit-log hooks. Attach to any collection's `hooks` to record
 * create / update / delete actions into the `audit-logs` collection.
 *
 * Usage in a collection config:
 *   import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
 *   hooks: { afterChange: [auditAfterChange], afterDelete: [auditAfterDelete] }
 *
 * Writes go through the local API with overrideAccess so they succeed even
 * though the audit-logs collection blocks create in its access rules.
 */

function pickTitle(doc: any): string {
  if (!doc || typeof doc !== 'object') return ''
  return (
    doc.fullName ||
    doc.clinicName ||
    doc.title ||
    doc.name ||
    doc.patientName ||
    doc.notes ||
    doc.question ||
    String(doc.id ?? '')
  )
}

function changedFieldNames(before: any, after: any): string[] {
  if (!before || !after) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const k of keys) {
    if (k === 'updatedAt') continue
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k)
  }
  return changed
}

export const auditAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  collection,
  req,
}) => {
  try {
    const action = operation === 'create' ? 'create' : 'update'
    const changedFields = action === 'update' ? changedFieldNames(previousDoc, doc) : []
    const title = pickTitle(doc)

    await req.payload.create({
      collection: 'audit-logs',
      overrideAccess: true,
      data: {
        action,
        collectionSlug: collection.slug,
        documentId: String(doc?.id ?? ''),
        documentTitle: title,
        userEmail: req.user?.email || 'system',
        userId: req.user?.id ? String(req.user.id) : undefined,
        summary: `${action} ${collection.slug}: ${title}`,
        changedFields: changedFields.length ? changedFields : undefined,
      },
    })
  } catch (err) {
    // Never let audit logging break the actual write.
    req.payload.logger.error(`[audit] failed to log change on ${collection.slug}: ${err}`)
  }
  return doc
}

export const auditAfterDelete: CollectionAfterDeleteHook = async ({ doc, collection, req }) => {
  try {
    const title = pickTitle(doc)
    await req.payload.create({
      collection: 'audit-logs',
      overrideAccess: true,
      data: {
        action: 'delete',
        collectionSlug: collection.slug,
        documentId: String(doc?.id ?? ''),
        documentTitle: title,
        userEmail: req.user?.email || 'system',
        userId: req.user?.id ? String(req.user.id) : undefined,
        summary: `delete ${collection.slug}: ${title}`,
      },
    })
  } catch (err) {
    req.payload.logger.error(`[audit] failed to log delete on ${collection.slug}: ${err}`)
  }
  return doc
}
