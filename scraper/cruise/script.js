import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cruise'
export const COMPANY = 'Cruise'
export const FIRST_PARTY_ROOT_URL = 'https://www.getcruise.com/careers/'

export const createCruiseScraper = () => ({
  async run({ fetchImpl = globalThis.fetch, timeoutMs = 15000, signal } = {}) {
    let pagesFetched = 0
    const controller = new AbortController()
    const coverageGap = (reason, cause) => Object.assign(new Error(`Cruise coverage gap: ${reason}`, { cause }), {
      code: 'CRUISE_COVERAGE_GAP', sourceListingComplete: false,
      inventoryEvidence: normalizeInventoryEvidence({
        status: 'coverage-gap', surface: FIRST_PARTY_ROOT_URL, firstParty: false,
        listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
        verifiedAt: new Date().toISOString(), reason,
      }),
    })
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw coverageGap('Invalid aggregate timeout')
    signal?.throwIfAborted()
    let timer
    let onAbort
    const cancelled = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(coverageGap('Aggregate timeout checking official careers surface'))
      }, timeoutMs)
      onAbort = () => {
        controller.abort(signal.reason)
        reject(signal.reason)
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    try {
      // Race the entire request AND body read: injected transports need not honor
      // AbortSignal. No fallback board is an authorized Cruise inventory.
      await Promise.race([cancelled, (async () => {
        const response = await fetchImpl(FIRST_PARTY_ROOT_URL, {
          signal: controller.signal, redirect: 'manual',
          headers: { accept: 'text/html' },
        })
        if (controller.signal.aborted) throw coverageGap('Request cancelled')
        pagesFetched++
        if (response?.status !== 200) throw coverageGap(`Official careers HTTP ${response?.status ?? 'unknown'}`)
        if (response.url !== FIRST_PARTY_ROOT_URL) throw coverageGap('Unverified official careers redirect or identity')
        const body = await response.text()
        if (controller.signal.aborted) throw coverageGap('Request cancelled')
        if (typeof body !== 'string' || !body.trim()) throw coverageGap('Official careers body unavailable')
        // Current live evidence is a TLS transport failure, not a verified
        // enumerable careers contract. Even a successful HTML response needs
        // a reviewed identity, geography, count and pagination contract before
        // it can certify inventory or stale-job deletion.
        throw coverageGap('Unrecognized official careers inventory contract')
      })()])
    } catch (error) {
      controller.abort()
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'CRUISE_COVERAGE_GAP') throw error
      throw coverageGap('Official careers transport/body unavailable', error)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createCruiseScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/cruise/script.js')

if (isDirectExecution) {
  // Complete the check before loading persistence, including on dry runs.
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
