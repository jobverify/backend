import { discoverOfficialAtsBoards } from './officialAtsDiscovery.js'
import { createPublishingGapAtsScraper } from './publishingGapAts.js'
import { fetchJsonWithRetry } from './fetch.js'

export const OFFICIAL_ATS_DISCOVERY = Symbol.for('jobverify.official-ats-discovery')

const coverageGap = (provider, discovery, reason = discovery.boards.length > 1
    ? 'ambiguous current employer boards'
    : discovery.reason || 'current employer binding unavailable') => Object.assign(
  new Error(`[${provider.source}] Official ATS recovery: ${reason}`),
  { softFailure: true, upstreamOutage: false, abortRetries: true, failureKind: 'coverage_gap',
    discoveryEvidence: discovery },
)

// A real extraction path for former placeholders. Board names are discovered
// from active first-party recruiting links on every run, never from source IDs
// or historical zero counts. Additional hiring channels remain unknown until a
// source-specific scope audit permits complete-inventory/lifecycle claims.
export const createOfficialAtsRecoveryScraper = provider => ({
  async run({ fetchPage, fetchJson, signal, sourceTimeoutMs = 90000 } = {}) {
    if (!Number.isSafeInteger(sourceTimeoutMs) || sourceTimeoutMs < 1 || sourceTimeoutMs > 120000) {
      throw new Error('Official ATS recovery source timeout must be between 1 and 120000 milliseconds')
    }
    const reviewedNames = provider.nativeEmployerNames ?? []
    if (!Array.isArray(reviewedNames) || reviewedNames.length > 4
      || reviewedNames.some(name => typeof name !== 'string' || !/[\p{L}\p{N}]/u.test(name) || name.length > 200)) {
      throw new Error('Official ATS recovery native employer names must be an explicitly reviewed list')
    }
    signal?.throwIfAborted()
    const runSignal = AbortSignal.any([
      ...(signal ? [signal] : []), AbortSignal.timeout(sourceTimeoutMs),
    ])
    const discovery = await discoverOfficialAtsBoards(provider, { fetchPage, signal: runSignal })
    runSignal.throwIfAborted()
    if (discovery.boards.length !== 1) throw coverageGap(provider, discovery)

    const binding = discovery.boards[0]
    if (binding.atsPlatform === 'greenhouse' && binding.bindingEvidence.matchedLinks
      .some(link => new URL(link).hostname.endsWith('.eu.greenhouse.io'))) {
      throw coverageGap(provider, discovery, 'European Greenhouse feed requires a regional extractor')
    }
    const candidate = {
      ...provider,
      ...binding,
      ...(binding.atsPlatform === 'lever' ? { leverRegion: binding.region || 'global' } : {}),
      adapter: 'publicAts',
      companyCareerPage: binding.bindingEvidence.officialURL,
      sourceScopeComplete: false,
      zeroResultPolicy: 'evidence-required',
    }
    const loadJson = fetchJson || ((url, options) => fetchJsonWithRetry(url, { ...options, timeoutMs: 20000, label: provider.source }))
    const companyKey = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : null
    const acceptedEmployerNames = new Set([provider.companyName, ...reviewedNames].map(companyKey).filter(Boolean))
    const jobs = await createPublishingGapAtsScraper(candidate).run({
      signal: runSignal,
      fetchJson: async (url, options) => {
        const payload = await loadJson(url, options)
        runSignal.throwIfAborted()
        if (binding.atsPlatform === 'greenhouse' && Array.isArray(payload?.jobs)
          && payload.jobs.some(job => !acceptedEmployerNames.has(companyKey(job.company_name)))) {
          throw coverageGap(provider, discovery, 'native employer name does not match the registered company')
        }
        return payload
      },
    })
    runSignal.throwIfAborted()
    for (const job of jobs) {
      job.officialAtsBinding = binding.bindingEvidence
      job.sourceScopeComplete = false
      job.sourceListingComplete = false
      job.lifecycleCleanupAllowed = false
    }
    Object.defineProperty(jobs, OFFICIAL_ATS_DISCOVERY, { value: discovery })
    return jobs
  },
})
