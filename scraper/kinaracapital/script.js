import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kinaracapital'
export const COMPANY = 'Kinara Capital'
export const FIRST_PARTY_ROOT_URL = 'https://kinaracapital.com/careers/'
export const CAREERS_URL = 'https://careers.kinaracapital.com/'

export const createKinaraCapitalScraper = () => ({
  async run({ fetchImpl = globalThis.fetch, timeoutMs = 15000, signal } = {}) {
    let pagesFetched = 0
    const controller = new AbortController()
    const coverageGap = (reason, cause) => Object.assign(new Error(`Kinara Capital coverage gap: ${reason}`, { cause }), {
      code: 'KINARACAPITAL_COVERAGE_GAP', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
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
      await Promise.race([cancelled, (async () => {
        const read = async url => {
          const response = await fetchImpl(url, {
            signal: controller.signal, redirect: 'manual',
            headers: { accept: 'text/html' },
          })
          if (controller.signal.aborted) throw coverageGap('Request cancelled')
          pagesFetched++
          if (response?.status !== 200) throw coverageGap(`Official careers HTTP ${response?.status ?? 'unknown'}`)
          if (response.url !== url) throw coverageGap('Unverified official careers redirect or identity')
          const body = await response.text()
          if (controller.signal.aborted) throw coverageGap('Request cancelled')
          if (typeof body !== 'string' || !body.trim()) throw coverageGap('Official careers body unavailable')
          if (Buffer.byteLength(body, 'utf8') > 5 * 1024 * 1024) throw coverageGap('Official careers body exceeds size bound')
          return body
        }
        const official = document(await read(FIRST_PARTY_ROOT_URL))
        if (official.nodes(node => node.tag === 'a' && node.attrs.href === CAREERS_URL
          && official.text(node) === 'APPLY NOW').length !== 1) {
          throw coverageGap('Official APPLY NOW handoff changed')
        }
        await read(CAREERS_URL)
        // No enumerable native contract was captured. A successful shell is
        // insufficient proof of current role count or exhaustive India scope.
        throw coverageGap('Unrecognized native careers inventory contract')
      })()])
    } catch (error) {
      controller.abort()
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'KINARACAPITAL_COVERAGE_GAP') throw error
      throw coverageGap('Official careers transport/body unavailable', error)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createKinaraCapitalScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/kinaracapital/script.js')

if (isDirectExecution) {
  // Complete the check before loading persistence, including on dry runs.
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
