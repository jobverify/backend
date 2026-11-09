/** Share identical work without sharing a caller's cancellation or deadline. */
export const createGenerationPool = ({ generate, keyFor, bindResult, requestMs }) => {
  const pending = new Map();
  return async (input, { signal, remainingMs = requestMs, share = true, ...options } = {}) => {
    const timeout = AbortSignal.timeout(Math.max(1, Math.floor(Math.min(remainingMs, requestMs))));
    const caller = signal ? AbortSignal.any([signal, timeout]) : timeout;
    caller.throwIfAborted();
    const key = share ? keyFor(input, options) : Symbol('fresh generation');
    let entry = pending.get(key);
    const joined = Boolean(entry);
    if (!entry) {
      entry = { controller: new AbortController(), waiters: new Set(), settled: false, accounted: false };
      pending.set(key, entry);
      entry.promise = Promise.resolve().then(() => generate(input, { ...options, signal: entry.controller.signal, remainingMs: 2147483647,
        onProgress: progress => { entry.progress = progress; } }))
        .finally(() => { entry.settled = true; if (pending.get(key) === entry) pending.delete(key); });
    }
    const waiter = {};
    entry.waiters.add(waiter);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        caller.removeEventListener('abort', abort);
        entry.waiters.delete(waiter);
        if (!entry.waiters.size && !entry.settled) {
          if (pending.get(key) === entry) pending.delete(key);
          entry.controller.abort();
        }
      };
      const abort = () => {
        if (!entry.waiters.has(waiter)) return;
        if (!signal?.aborted && caller.reason && typeof caller.reason === 'object') {
          const ownsCost = entry.waiters.size === 1 && !entry.accounted;
          if (ownsCost) entry.accounted = true;
          try { Object.assign(caller.reason, { rawText: entry.progress?.rawText,
            generationRequests: ownsCost ? entry.progress?.generationRequests || 0 : 0,
            ...Object.fromEntries(['correctionRequests', 'correctionsAccepted', 'correctionsRejected', 'correctionsSkipped']
              .map(key => [key, ownsCost ? entry.progress?.[key] || 0 : 0])),
            transportRetries: ownsCost ? entry.progress?.transportRetries || 0 : 0 }); } catch { /* Caller-owned reasons may be immutable. */ }
        }
        cleanup(); reject(caller.reason);
      };
      caller.addEventListener('abort', abort, { once: true });
      entry.promise.then(result => {
        if (caller.aborted) return abort();
        const ownsCost = !entry.accounted;
        entry.accounted = true;
        cleanup();
        try { resolve(bindResult(result, input, { joined, ownsCost })); } catch (error) { reject(error); }
      }, error => {
        if (caller.aborted) return abort();
        const ownsCost = !entry.accounted;
        entry.accounted = true;
        cleanup();
        if (ownsCost) return reject(error);
        const copy = Object.assign(Object.setPrototypeOf(new Error(error.message, { cause: error.cause }), Object.getPrototypeOf(error)),
          error, { name: error.name, stack: error.stack, generationRequests: 0, transportRetries: 0,
            correctionRequests: 0, correctionsAccepted: 0, correctionsRejected: 0, correctionsSkipped: 0,
            usage: undefined, timings: undefined, generations: [] });
        reject(copy);
      });
      if (caller.aborted) abort();
    });
  };
};
