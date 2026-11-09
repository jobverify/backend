import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { parseNativeListing, parseNativeDetail, classifyLocations, reconcileActiveJobs } from './native.js'
import { SKAN_CATALOG } from './catalog.js'
export { parseNativeListing, parseNativeDetail, classifyLocations } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'skan'
export const COMPANY = 'Skan'
export const FIRST_PARTY_ROOT_URL = 'https://www.skan.ai/current-openings'
export const OFFICIAL_CAREERS_URL = 'https://www.skan.ai/careers'
export const ACTIVE_JOBS_URL = 'https://skanai.keka.com/careers/api/jobs/default/active'
export const PROVIDER_METADATA = SKAN_CATALOG

const defaultFetchText = async (url, { signal, checkBudget = () => signal?.throwIfAborted() } = {}) => {
  const response = await fetch(url, { signal, headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
  try {
    checkBudget()
    if (response.status !== 200 || response.url !== url) throw new Error('Skan source HTTP failure or redirect identity changed')
    if (!response.body?.getReader) throw new Error('Skan source missing readable response stream')
  } catch (error) {
    try { void response.body?.cancel().catch(() => {}) } catch {}
    throw error
  }
  const reader = response.body.getReader(), chunks = []
  let bytes = 0
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    checkBudget()
    while (true) {
      const { done, value } = await reader.read()
      checkBudget()
      if (done) break
      bytes += value.byteLength
      if (bytes > 4 * 1024 * 1024) throw new Error('Skan source response exceeds request bound')
      chunks.push(value)
    }
    return Buffer.concat(chunks, bytes).toString('utf8')
  } catch (error) {
    cancel()
    throw error
  } finally { signal?.removeEventListener('abort', cancel); reader.releaseLock() }
}

export const createSkanScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, timeoutMs = 120000, now = new Date() } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) throw new Error('Skan invalid request budget')
    if (!Number.isFinite(new Date(now).getTime())) throw new Error('Skan invalid verification clock')
    signal?.throwIfAborted()
    const controller = new AbortController(), combined = composeAbortSignals(signal, controller.signal)
    const deadline = performance.now() + timeoutMs
    const checkBudget = () => {
      if (performance.now() >= deadline && !controller.signal.aborted) controller.abort(new Error('Skan source timed out'))
      combined.throwIfAborted()
    }
    const timer = setTimeout(() => controller.abort(new Error('Skan source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => { onAbort = () => reject(combined.reason); combined.addEventListener('abort', onAbort, { once: true }) })
    try {
      const collect = async () => {
        let pagesFetched = 0
        const request = async url => { checkBudget(); const body = await fetchText(url, { signal: combined, checkBudget }); checkBudget(); pagesFetched++; return body }
        const rows = parseNativeListing(await request(OFFICIAL_CAREERS_URL)), details = []
        const active = reconcileActiveJobs(await request(ACTIVE_JOBS_URL), rows, { now })
        const activeRows = rows.filter(row => active.has(row.id))
        for (let offset = 0; offset < activeRows.length; offset += 4) {
          const results = await Promise.all(activeRows.slice(offset, offset + 4).map(async row => {
            const detail = parseNativeDetail(await request(row.href), row), native = active.get(row.id)
            checkBudget()
            // Preserve the public API values; contradictory foreign labels never promote India scope.
            return { ...detail, postingDate: native.publishedOn ?? null, nativePublishedOn: native.publishedOn ?? null,
              nativePublishedSinceDays: native.publishedSinceDays, nativeLocations: native.jobLocations, nativeCountryConflict: native.nativeCountryConflict }
          }))
          details.push(...results)
        }
        const jobs = details.filter(job => job.locations.length)
        const listingAgrees = activeRows.length === rows.length && active.size === rows.length
        const scopeComplete = listingAgrees && details.every(job => job.scopeComplete && !job.nativeCountryConflict), complete = scopeComplete && jobs.every(job => job.sourceDetailComplete)
        for (const job of jobs) { delete job.scopeComplete; job.sourceListingComplete = complete }
        checkBudget()
        return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'discovery-only', surface: OFFICIAL_CAREERS_URL,
          firstParty: true, listingComplete: complete, pagesFetched, reportedTotal: rows.length,
          indiaFacetCount: scopeComplete ? jobs.length : null, verifiedAt: new Date().toISOString(),
          reason: !listingAgrees ? 'native-active-listing-count-disagreement' : complete ? 'first-party-complete-payload-visible-department-counts-and-all-keka-details-reconciled' : !scopeComplete ? 'native-city-only-location-country-unresolved' : 'selected-native-description-missing' })
      }
      return await Promise.race([collect(), aborted])
    } finally { clearTimeout(timer); combined.removeEventListener('abort', onAbort); controller.abort(new Error('Skan collection finished')) }
  },
})

export const run = async (options = {}) => createSkanScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/skan/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
