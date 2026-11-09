import { readFileSync } from 'node:fs'
import path from 'node:path'
import { attachInventoryEvidence } from './inventoryEvidence.js'

// Native feeds must not inherit the central DOM scraper's ten-page default.
// Explicit source-local limits and caller limits still apply.
export const loadNativePaginationDefaults = directory => {
  try {
    const local = JSON.parse(readFileSync(path.join(directory, 'config.json'), 'utf8'))
    return { maxPages: local.maxPages, maxJobs: local.maxJobs }
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

export const nativePaginationLimits = (options = {}, defaults = {}) => Object.fromEntries(
  ['maxPages', 'maxJobs'].map(key => {
    const requested = options[key] ?? defaults[key] ?? Infinity
    // Existing native maxJobs controls use zero for unlimited. Apply the same
    // convention to page limits rather than returning an unfetched empty list.
    const value = requested === 0 ? Infinity : requested
    if (value !== Infinity && (!Number.isInteger(value) || value < 0)) throw new TypeError(`Invalid native ${key} limit`)
    return [key, value]
  }),
)

// Injected readers may ignore AbortSignal. Race them too, and keep the caller's
// exact reason rather than wrapping cancellation as a transport/parser error.
export const readNativeWithSignal = async (operation, signal) => {
  signal?.throwIfAborted()
  if (!signal) return operation()
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    const value = await Promise.race([Promise.resolve().then(() => {
      signal.throwIfAborted()
      return operation()
    }), aborted])
    signal.throwIfAborted()
    return value
  } finally { signal.removeEventListener('abort', onAbort) }
}

export const NATIVE_PAGINATION_EVIDENCE = Symbol.for('jobverify.native-pagination-evidence')
export const DEFAULT_NATIVE_COLLECTION_BUDGET_MS = 240000

export const createNativePagination = ({ surface, limits, signal, collectionBudgetMs = DEFAULT_NATIVE_COLLECTION_BUDGET_MS, identityScope = 'parsed-card' }) => {
  if (!Number.isFinite(collectionBudgetMs) || collectionBudgetMs < 0) throw new TypeError('Invalid native collection budget')
  const budgetController = new AbortController()
  const requestSignal = signal ? AbortSignal.any([signal, budgetController.signal]) : budgetController.signal
  const budgetReason = Object.assign(new Error('Native collection budget exhausted'), {
    name: 'NativeCollectionBudgetError', code: 'NATIVE_COLLECTION_INCOMPLETE',
    softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', abortRetries: true,
    partial: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  })
  const check = () => { signal?.throwIfAborted(); requestSignal.throwIfAborted() }
  let pagesFetched = 0
  let reportedTotal = null
  let gap = null
  const seen = new Set()
  const pagination = {
    signal: requestSignal,
    throwIfAborted: check,
    async run(jobs, operation, { flushCompleted } = {}) {
      const timer = setTimeout(() => budgetController.abort(budgetReason), collectionBudgetMs)
      if (collectionBudgetMs === 0) budgetController.abort(budgetReason)
      try {
        check()
        const result = await operation()
        signal?.throwIfAborted()
        return result
      } catch (error) {
        // External cancellation always wins, even if it races our own timer.
        signal?.throwIfAborted()
        if (error !== budgetReason || !budgetController.signal.aborted) throw error
        flushCompleted?.()
        if (!jobs.length) {
          budgetReason.inventoryEvidence = { status: 'coverage-gap', surface, firstParty: true,
            listingComplete: false, pagesFetched, reportedTotal, indiaFacetCount: null,
            verifiedAt: new Date().toISOString(), reason: 'native-collection-budget-exhausted;company-scope-unverified' }
          throw budgetReason
        }
        return pagination.finish(jobs, { reason: 'native-collection-budget-exhausted' })
      } finally { clearTimeout(timer) }
    },
    page(keys, total = null) {
      check()
      pagesFetched += 1
      if (Number.isInteger(total) && total >= 0) {
        if (reportedTotal != null && reportedTotal !== total) gap ||= 'native-total-changed'
        reportedTotal = Math.max(reportedTotal ?? 0, total)
      }
      let fresh = 0
      for (const key of keys) {
        if (!key) { gap ||= 'native-malformed-listing-identity'; continue }
        if (seen.has(key)) continue
        seen.add(key)
        fresh += 1
      }
      if (!fresh && reportedTotal !== 0) gap ||= 'native-pagination-no-progress'
      return fresh > 0
    },
    finish(jobs, { exhausted = false, reason = exhausted ? 'native-pagination-exhausted' : 'native-pagination-limit' } = {}) {
      signal?.throwIfAborted()
      if (budgetController.signal.aborted) {
        if (!jobs.length) throw budgetReason
        exhausted = false
        reason = 'native-collection-budget-exhausted'
      }
      if (exhausted && reportedTotal != null && seen.size !== reportedTotal) gap ||= 'native-total-unreconciled'
      const receipt = { pagesFetched, reportedTotal, observedUnique: seen.size, identityScope,
        continuationExhausted: exhausted, limits, collectionBudgetMs,
        reason: budgetController.signal.aborted ? reason : gap || reason }
      Object.defineProperty(jobs, NATIVE_PAGINATION_EVIDENCE, { value: receipt })
      // Native pagination does not prove employer-wide scope, geography, or full
      // details. Keep lifecycle cleanup disabled even after feed exhaustion.
      for (const job of jobs) Object.assign(job, {
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      })
      return attachInventoryEvidence(jobs, {
        status: gap || !exhausted ? 'coverage-gap' : 'discovery-only', surface,
        firstParty: true, listingComplete: false, pagesFetched, reportedTotal,
        verifiedAt: new Date().toISOString(), reason: `${receipt.reason};company-scope-unverified`,
      })
    },
  }
  return pagination
}
