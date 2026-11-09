import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
export { MOEVING_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'moeving'
export const COMPANY = 'MoEVing'
export const FIRST_PARTY_ATS_URL = 'https://moeving.freshteam.com/jobs'

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' },
  })
  if (!response.ok) throw new Error(`MoEVing native inventory unavailable: HTTP ${response.status}`)
  if (new URL(response.url).origin !== new URL(FIRST_PARTY_ATS_URL).origin) {
    throw new Error('MoEVing native inventory identity changed by redirect')
  }
  return response.text()
}

export const createMoEVingScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, timeoutMs = 20000, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    let pagesFetched = 0
    const gap = (message, reason, cause) => Object.assign(new Error(message, { cause }), {
      name: 'MoEVingCoverageGapError', code: 'MOEVING_COVERAGE_GAP',
      softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', abortRetries: true,
      partial: true, sourceListingComplete: false, lifecycleCleanupAllowed: false,
      inventoryEvidence: normalizeInventoryEvidence({
        status: 'coverage-gap', surface: FIRST_PARTY_ATS_URL, firstParty: false,
        listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
        verifiedAt: now(), reason,
      }),
    })
    const controller = new AbortController()
    let timer
    let onAbort
    const interrupted = new Promise((resolve, reject) => {
      onAbort = () => {
        const reason = signal.reason || new Error('MoEVing caller aborted')
        controller.abort(reason)
        reject(reason)
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => {
        const reason = new Error('MoEVing native inventory deadline exceeded')
        controller.abort(reason)
        reject(reason)
      }, Math.max(1, Math.min(60000, Number(timeoutMs) || 20000)))
    })
    try {
      const html = await Promise.race([
        Promise.resolve().then(() => fetchText(FIRST_PARTY_ATS_URL, { signal: controller.signal })),
        interrupted,
      ])
      signal?.throwIfAborted()
      pagesFetched++
      if (/invalid-domain-wrapper/.test(html) && /class=["']no-ats["']/.test(html)
        && /We couldn't find/.test(html) && /You can claim it now at/.test(html)) {
        throw gap('MoEVing native inventory unavailable: inactive Freshteam tenant', 'inactive-freshteam-tenant')
      }
      throw gap('MoEVing native inventory unverified: no current enumerable listing contract established',
        'native-listing-contract-unverified')
    } catch (error) {
      signal?.throwIfAborted()
      if (error?.code === 'MOEVING_COVERAGE_GAP') throw error
      throw gap(error.message || 'MoEVing native inventory unavailable', 'native-inventory-unavailable', error)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createMoEVingScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/moeving/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
