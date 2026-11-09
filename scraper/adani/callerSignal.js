// Caller cancellation settles even an injected operation that ignores its
// signal. There is no independent deadline on the whole native inventory.
export async function withCallerSignal(operation, signal) {
  signal?.throwIfAborted()
  if (!signal) return operation()
  let abort
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
  })
  try {
    const result = await Promise.race([Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }), cancelled])
    signal.throwIfAborted()
    return result
  } finally { signal.removeEventListener('abort', abort) }
}
