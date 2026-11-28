import { createRuntimeVerifiedPublicAtsScraper } from './publicAtsRuntimeInventory.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from './fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const nativeState = payload => canonical([...payload.jobs].sort((a, b) => a.id - b.id))
const fail = (source, reason) => { throw Object.assign(Error(`[${source}] ${reason}`), {
  abortRetries: true, softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap',
}) }

// Opening and closing snapshots each verify the current employer's advertised
// board and every native country alternative. A changed membership or role body
// retains the healthy observed India roles without authorizing source cleanup.
export const createPairedEmployerGreenhouseScraper = provider => ({
  async run(options = {}) {
    const { signal } = options
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(provider.boardToken)}/jobs?content=true`
    const loadPage = options.fetchPage || ((url, init) => fetchTextWithRetry(url, { ...init,
      timeoutMs: 20000, attempts: 1, label: provider.source, includeResponseMetadata: true }))
    const loadJson = options.fetchJson || (async (url, init) => {
      const response = await fetchJsonWithRetry(url, { ...init, timeoutMs: 20000, attempts: 1,
        label: provider.source, includeResponseMetadata: true })
      if (response.url !== url || response.status !== 200) fail(provider.source, 'native inventory response identity changed')
      return response.payload
    })
    const snapshot = async () => {
      signal?.throwIfAborted()
      let payload, descriptionsComplete = true
      const pages = []
      const jobs = await createRuntimeVerifiedPublicAtsScraper(provider).run({ signal,
        fetchPage: async (url, init) => {
          const page = await loadPage(url, init)
          signal?.throwIfAborted()
          if (typeof page?.html !== 'string' || Buffer.byteLength(page.html) > 3000000) fail(provider.source, 'employer inventory page unavailable or oversized')
          pages.push({ requestedUrl: url, url: page.url, status: page.status })
          return page
        },
        fetchJson: async (url, init) => {
          if (url !== apiUrl || payload) fail(provider.source, 'unexpected native inventory request')
          payload = await loadJson(url, init)
          signal?.throwIfAborted()
          if (!payload || !Array.isArray(payload.jobs) || !Number.isSafeInteger(payload.meta?.total)
            || payload.meta.total !== payload.jobs.length || payload.hasMore === true
            || (payload.total != null && payload.total !== payload.jobs.length)) fail(provider.source, 'Incomplete native inventory envelope or total')
          for (const row of payload.jobs) {
            if (row?.company_name !== provider.nativeEmployerName) fail(provider.source, 'native employer does not match the current source')
            if (!hasSourceDescription({ sourceDescription: row.content })) descriptionsComplete = false
          }
          return payload
        },
      })
      return { jobs, payload: structuredClone(payload), pages, descriptionsComplete, evidence: readInventoryEvidence(jobs) }
    }
    const opening = await snapshot(), closing = await snapshot()
    signal?.throwIfAborted()
    const reasons = []
    if (!opening.evidence?.listingComplete) reasons.push(`opening:${opening.evidence?.reason || 'inventory-unavailable'}`)
    if (!closing.evidence?.listingComplete) reasons.push(`closing:${closing.evidence?.reason || 'inventory-unavailable'}`)
    if (!opening.descriptionsComplete || !closing.descriptionsComplete) reasons.push('full-native-role-description-unavailable')
    if (nativeState(opening.payload) !== nativeState(closing.payload)) reasons.push('closing-native-inventory-changed')
    const complete = reasons.length === 0, jobs = closing.jobs
    for (const job of jobs) Object.assign(job, { sourceListingComplete: complete, sourceScopeComplete: complete,
      lifecycleCleanupAllowed: complete, sourceEmployerName: job.nativeSourceRecord?.company_name || provider.nativeEmployerName })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: {
      ...jobs.nativeCollectionEvidence, source: provider.source,
      openingNativePayload: opening.payload, closingNativePayload: closing.payload,
      employerPageReceipts: [...opening.pages, ...closing.pages], lifecycleCleanupAllowed: complete,
      listingPaginationComplete: complete, observedListingCount: closing.payload.jobs.length,
      verifiedAt: new Date().toISOString(), reasons,
    } })
    return attachInventoryEvidence(jobs, { ...closing.evidence, listingComplete: complete,
      status: complete ? closing.evidence.status : 'coverage-gap', lifecycleCleanupAllowed: complete,
      pagesFetched: (opening.evidence?.pagesFetched || 0) + (closing.evidence?.pagesFetched || 0),
      indiaFacetCount: complete ? closing.evidence.indiaFacetCount : null,
      verifiedAt: new Date().toISOString(),
      reason: complete ? 'current-employer-binding-and-paired-complete-greenhouse-inventory'
        : `paired-employer-native-inventory-incomplete:${reasons.join(';')}`,
    })
  },
})
