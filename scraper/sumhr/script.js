import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { SUMHR_CATALOG } from './catalog.js'
import { ATS_URL, parseBoard, parseDetail, activeHtml } from './native.js'
export { ATS_URL } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sumhr'
export const COMPANY = 'SumHR'
export const FIRST_PARTY_ROOT_URL = 'https://sumhr.com/'
export const ABOUT_URL = 'https://sumhr.com/about-us/'
export const PROVIDER_METADATA = SUMHR_CATALOG

const MAX_BYTES = 2 * 1024 * 1024
async function readBounded(response, signal) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('SumHR missing source body')
  const chunks = []
  let size = 0
  const cancel = () => { void reader.cancel(signal.reason).catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); throw new Error('SumHR source exceeds body bound') }
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock() }
}

export const createSumHrScraper = () => ({
  async run({ fetchImpl = fetch, signal, timeoutMs = 20000 } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw new Error('SumHR invalid request budget')
    signal?.throwIfAborted()
    const controller = new AbortController()
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    const timer = setTimeout(() => controller.abort(new Error('SumHR source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => { onAbort = () => reject(combined.reason); combined.addEventListener('abort', onAbort, { once: true }) })
    try {
      const collect = async () => {
        const request = async url => {
          combined.throwIfAborted()
          const response = await fetchImpl(url, { signal: combined, redirect: 'error', headers: { Accept: 'text/html' } })
          combined.throwIfAborted()
          if (response.status !== 200 || (response.url && response.url !== url)) throw new Error('SumHR source HTTP failure or changed redirect identity')
          const type = response.headers?.get('content-type') || ''
          if (type && !/^(?:text\/html|text\/plain)\b/i.test(type)) throw new Error('SumHR unexpected source content type')
          return readBounded(response, combined)
        }
        const homepage = activeHtml(await request(FIRST_PARTY_ROOT_URL))
        if (!/<title[^>]*>[^<]*sumhr/i.test(homepage) || !/<a\b[^>]*href=["'](?:https:\/\/(?:www\.)?sumhr\.com)?\/about-us\/["']/i.test(homepage)) throw new Error('SumHR official about handoff missing')
        const about = activeHtml(await request(ABOUT_URL))
        if (!/<title[^>]*>[^<]*sumhr/i.test(about) || !/Want to join our fun bunch\?/i.test(about) || !/humans@sumhr\.com/i.test(about)) throw new Error('SumHR official join contract changed')
        const rows = parseBoard(await request(ATS_URL))
        const jobs = []
        for (const row of rows) jobs.push(parseDetail(await request(row.url), row))
        // Native tenant identity is coherent, but the corporate outbound ATS
        // authorization and complete employer inventory remain unproven.
        return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: ATS_URL,
          firstParty: false, listingComplete: false, pagesFetched: 3 + rows.length,
          reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
          reason: 'native-sumhr-client-u0mr5-configured-sumhr-domain-contact-and-active-forms;corporate-outbound-ats-authorization-and-whole-company-scope-unproven' })
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      combined.removeEventListener('abort', onAbort)
      if (!controller.signal.aborted) controller.abort(new Error('SumHR request finished'))
    }
  },
})

export const run = async (options = {}) => createSumHrScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/sumhr/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
