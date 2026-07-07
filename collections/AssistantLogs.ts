import type { CollectionConfig } from 'payload'

/**
 * Audit trail + cost-control ledger for the AI assistant. Every exchange
 * (success or refusal) is logged here by the server route via overrideAccess
 * -- never created through the public API or the admin UI by hand. Powers two
 * hard caps computed from this table: a monthly spend ceiling and a per-IP
 * daily message limit (see lib/assistant/usage.ts).
 */
export const AssistantLogs: CollectionConfig = {
  slug: 'assistant-logs',
  admin: {
    useAsTitle: 'query',
    defaultColumns: ['query', 'ip', 'estimatedCostUsd', 'toolsUsed', 'flagged', 'createdAt'],
    group: 'System',
    description: 'AI assistant conversation log. Read-only audit trail; also powers the monthly spend cap and per-IP daily limit.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    create: () => false,
    update: () => false,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'query', type: 'text', admin: { readOnly: true, description: "The visitor's message (truncated)." } },
    { name: 'ip', type: 'text', admin: { readOnly: true } },
    { name: 'tokensIn', type: 'number', admin: { readOnly: true } },
    { name: 'tokensOut', type: 'number', admin: { readOnly: true } },
    { name: 'estimatedCostUsd', type: 'number', admin: { readOnly: true, description: 'Estimated USD cost of this exchange.' } },
    { name: 'toolsUsed', type: 'text', admin: { readOnly: true, description: 'Comma-separated tool names called for this exchange.' } },
    {
      name: 'flagged',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, description: 'True when the assistant declined an off-topic or out-of-scope request.' },
    },
  ],
  timestamps: true,
}
