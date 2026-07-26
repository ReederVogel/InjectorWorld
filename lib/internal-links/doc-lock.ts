/**
 * Serializes async work per document key.
 *
 * Inserting an internal link is read-modify-write on a Lexical body: read the
 * doc, splice a link node in, write the whole body back. Two approvals for the
 * SAME page running concurrently would both read the pre-insert body and the
 * second write would silently discard the first link. Payload's afterChange
 * hooks give no transaction guarantee across those separate operations, so we
 * queue them per document instead.
 *
 * Scope note: this is per-process. It fully covers the real usage here (an
 * admin approving suggestions, single app instance). It would NOT protect
 * against two app instances writing the same doc at the same instant -- that
 * would need row-level locking in Postgres.
 */
const tails = new Map<string, Promise<unknown>>()

export function withDocLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = tails.get(key) ?? Promise.resolve()
  // Swallow the predecessor's rejection so one failure doesn't poison the queue.
  const run = prior.then(fn, fn)

  const tail = run.then(
    () => undefined,
    () => undefined,
  )
  tails.set(key, tail)

  // Once this tail settles, remove it if nothing newer has chained on --
  // keeps the map from growing for every document ever touched.
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key)
  })

  return run
}
