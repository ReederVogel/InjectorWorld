/**
 * Event the Find box listens for on its own form element. Dispatched (with
 * bubbles: true) from inside a field, e.g. the body editor's toolbar search
 * button, to open the box limited to the field it came from.
 *
 * detail.prefill: text to search for (the editor's selection, if any).
 */
export const FIND_OPEN_EVENT = 'iw-find-open'

export type FindOpenDetail = { prefill?: string }
