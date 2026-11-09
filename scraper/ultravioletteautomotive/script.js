import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeDocument, readBoard, readAPI, readDetail, BOARD_URL, API_URL } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ultravioletteautomotive'
export const COMPANY = 'Ultraviolette Automotive'
export const OFFICIAL_CAREERS_URL = 'https://www.ultraviolette.com/de/careers'
export const HOMEPAGE_URL = 'https://www.ultraviolette.com/'
export const CURRENT_CAREERS_URL = 'https://www.ultraviolette.com/careers'

// Race both fetch and body reads: injected clients can ignore AbortSignal.
export function createRequestScope({ fetchImpl = globalThis.fetch, signal, timeoutMs = 15000, overallTimeoutMs = 60000 } = {}) {
  if (![timeoutMs, overallTimeoutMs].every(value => Number.isFinite(value) && value > 0 && value <= 2147483647)) throw new Error('Finite positive request and overall timeouts within timer bounds are required')
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const overall = setTimeout(() => controller.abort(new Error('Ultraviolette overall request timed out')), overallTimeoutMs)
  const retainedResponses = []
  const get = async url => {
    if (controller.signal.aborted) throw controller.signal.reason
    let rejectAbort
    const aborted = new Promise((resolve, reject) => { rejectAbort = () => reject(controller.signal.reason); controller.signal.addEventListener('abort', rejectAbort, { once: true }) })
    const timer = setTimeout(() => controller.abort(new Error('Ultraviolette request timed out: ' + url)), timeoutMs)
    try {
      return await Promise.race([aborted, (async () => {
        const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'text/html,application/json', 'User-Agent': 'Jobverify/1.0' } })
        const finalUrl = response.url || url
        if (new URL(finalUrl).href !== new URL(url).href) throw new Error('Unexpected Ultraviolette redirect: ' + finalUrl)
        const body = await response.text()
        if (controller.signal.aborted) throw controller.signal.reason
        const capture = { url, finalUrl, status: response.status, capturedAt: new Date().toISOString(), body }
        retainedResponses.push(capture)
        return capture
      })()])
    } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', rejectAbort) }
  }
  return { get, retainedResponses, abort(reason) { controller.abort(reason) }, close() { clearTimeout(overall); signal?.removeEventListener('abort', abort) } }
}

export const createUltravioletteAutomotiveScraper = () => ({
  async run(options = {}) {
    const scope = createRequestScope(options)
    try {
      const careers = await scope.get(CURRENT_CAREERS_URL)
      if (careers.status !== 200 && careers.status !== 404) throw new Error('Ultraviolette careers HTTP ' + careers.status)
      const scripts = careers.status === 200 ? nativeDocument(careers.body).nodes(node => node.tag === 'script' && /^\/_next\/static\/chunks\/pages\/careers-[a-z\d]+\.js$/.test(node.attrs.src || '')) : []
      if (scripts.length === 1) {
        const chunk = await scope.get(new URL(scripts[0].attrs.src, CURRENT_CAREERS_URL).href)
        if (chunk.status !== 200 || !/rec_embed_js\.load\(\{widget_id:"rec_job_listing_div",page_name:"Careers",source:"CareerSite",site:"https:\/\/ultraviolette\.zohorecruit\.in"/.test(chunk.body)) throw new Error('Ultraviolette official Zoho embed binding changed')
        const board = await scope.get(BOARD_URL)
        if (board.status !== 200) throw new Error('Ultraviolette board HTTP ' + board.status)
        const api = await scope.get(API_URL)
        if (api.status !== 200) throw new Error('Ultraviolette API HTTP ' + api.status)
        const rows = readAPI(api.body, readBoard(board.body))
        const jobs = []
        let next = 0, fatal
        const worker = async () => {
          while (!fatal && next < rows.length) {
            const row = rows[next++]
            try {
              const page = await scope.get(row.$url)
              if (page.status !== 200) throw new Error('Ultraviolette detail HTTP ' + page.status)
              const fact = readDetail(page.body, row)
              if (fact.country !== 'India') continue
              const { detail, description } = fact
              jobs.push({
                source: SOURCE, company: COMPANY, jobId: row.id, id: row.id,
                requisitionId: detail.Job_Opening_ID || null, title: detail.Posting_Title,
                sourceUrl: row.$url, applyUrl: row.$url, link: row.$url,
                applicationLinkSource: 'public-native-role-page', applicationVisited: false,
                country: 'India', city: detail.City || null,
                location: [detail.City, detail.State, 'India'].filter(Boolean).join(', '),
                employmentType: detail.Job_Type, experienceRequired: detail.Exprience || null,
                postingDate: null, postedAt: null, nativePublicationDate: null,
                nativeDateOpened: detail.Date_Opened ?? null, nativeDateOpenedIsPublicationDate: false,
                firstEverPublication: null, closingDate: null,
                jobDescription: description, sourceDescription: description, nativeDescriptionHTML: detail.Job_Description ?? null,
                nativeHiringOrganization: 'Ultraviolette Automotive Private Limited', nativeListingRecord: row,
                nativeDetailRecord: detail, sourceDetailComplete: Boolean(description),
                sourceDetailStatus: description ? 'complete' : 'partial-missing-description',
                sourceListingComplete: true, sourceScopeComplete: true,
                lifecycleCleanupAllowed: true,
              })
            } catch (error) { if (!fatal) { fatal = error; scope.abort(error) }; throw fatal }
          }
        }
        const results = await Promise.allSettled(Array.from({ length: Math.min(4, rows.length) }, worker))
        if (fatal) throw fatal
        const rejected = results.find(result => result.status === 'rejected')
        if (rejected) throw rejected.reason
        jobs.sort((a, b) => rows.findIndex(row => row.id === a.id) - rows.findIndex(row => row.id === b.id))
        const complete = jobs.every(job => job.sourceDetailComplete)
        if (!complete) for (const job of jobs) { job.sourceListingComplete = false; job.sourceScopeComplete = false; job.lifecycleCleanupAllowed = false }
        const evidence = { status: complete ? (rows.length ? 'complete-inventory' : 'verified-empty') : 'discovery-only', surface: API_URL,
          firstParty: true, listingComplete: complete, pagesFetched: scope.retainedResponses.length,
          reportedTotal: rows.length, indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString(),
          reason: 'Official careers embed binding; complete embedded native board and public API ID parity; all native detail identities/countries validated.' }
        Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: scope.retainedResponses })
        return attachInventoryEvidence(jobs, evidence)
      }
      return attachInventoryEvidence([], {
        status: 'coverage-gap', surface: CURRENT_CAREERS_URL, firstParty: true,
        listingComplete: false, pagesFetched: scope.retainedResponses.length,
        reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
        reason: 'No complete native inventory verified; retired or changed careers routes cannot certify zero. A discovered Zoho tenant requires verified official binding and exhaustive native inventory.',
      })
    } finally { scope.close() }
  },
})

export const run = async (options = {}) => createUltravioletteAutomotiveScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/ultravioletteautomotive/script.js')

if (isDirectExecution) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(path.join(currentDir, 'jobs.json'), JSON.stringify(jobs, null, 2))
    const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
    console.log(JSON.stringify(readInventoryEvidence(jobs)))
  } else {
    const { saveToDB } = await import('../../scraper-support/utils/saveToDB.js')
    await saveToDB(jobs, SOURCE)
  }
}
