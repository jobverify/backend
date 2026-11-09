import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { setTimeout as wait } from 'node:timers/promises'
import { createFirstPartyHTMLScraper, createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CAREERS, EMBED, parseOfficialAtScale, parseAtScaleListing, parseAtScaleDetail, validateAtScaleURL } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "atscale"
export const COMPANY = "AtScale"
export const CAREERS_URL = CAREERS

const receive = async (operation, signal) => {
  signal.throwIfAborted()
  let abort, timer
  const cancelled = new Promise((resolve, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }) })
  const task = Promise.resolve().then(operation)
  try { return await Promise.race([task, cancelled]) }
  catch (error) {
    if (!signal.aborted) throw error
    await Promise.race([task.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, 100) })])
    throw signal.reason
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort) }
}

export async function run({ transport, fetchImpl, fetchText, fetchBrowserText, signal, now = () => new Date().toISOString(),
  requestIntervalMs = 500, sourceBudgetMs = 120000, maxJobs = null,
} = {}) {
  signal?.throwIfAborted()
  if (fetchText || fetchBrowserText || transport != null && typeof transport !== 'function') throw Error('AtScale native transport requires complete response receipts')
  if (!Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0 || requestIntervalMs > 5000
    || !Number.isSafeInteger(sourceBudgetMs) || sourceBudgetMs < 1 || sourceBudgetMs > 120000
    || maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 1 || maxJobs > 20)) throw Error('AtScale native bounded options are invalid')
  const checkedAt = now()
  if (!Number.isFinite(Date.parse(checkedAt))) throw Error('AtScale native run clock is invalid')
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(Error('AtScale native source deadline exhausted')), sourceBudgetMs)
  let lastStart = 0, selected = 0
  const config = { source: SOURCE, companyName: COMPANY, boardURL: EMBED, maxRequests: 25, maxAggregateBytes: 16 * 1024 * 1024,
    validateURL: validateAtScaleURL, sameReadIdentity: (a, b) => a === b,
    handoffs: [{ url: CAREERS, verify: parseOfficialAtScale }], parseListing: parseAtScaleListing,
    candidateForIndia: row => row.india && (maxJobs == null || selected < maxJobs) && (++selected > 0),
    parseDetail: (html, row) => parseAtScaleDetail(html, row, { now: checkedAt }), pageFingerprint: page => page.fingerprint }
  const rawTransport = transport ?? createHTMLTransport(config, { fetchImpl, signal: combined, timeoutMs: 15000 })
  const paced = async url => {
    combined.throwIfAborted()
    const remaining = requestIntervalMs - (Date.now() - lastStart)
    if (remaining > 0) { try { await wait(remaining, undefined, { signal: combined }) } catch (error) { combined.throwIfAborted(); throw error } }
    combined.throwIfAborted(); lastStart = Date.now()
    const response = await receive(() => rawTransport(url, { signal: combined }), combined)
    combined.throwIfAborted()
    return response
  }
  try {
    const result = await createFirstPartyHTMLScraper(config).collect({ signal: combined, transport: paced })
    combined.throwIfAborted()
    const unsafeInventory = result.failures.some(f => f.stage !== 'native-detail')
    if (unsafeInventory || !result.handoffVerified || !result.listingPaginationComplete || !result.closingInventoryMatches)
      throw Object.assign(Error('AtScale native inventory or official binding is incomplete'), { nativeEvidence: result })
    const final = await paced(CAREERS)
    if (!final || final.status !== 200 || final.url !== CAREERS || final.bodyComplete !== true || !(final.body instanceof Uint8Array)
      || final.body.byteLength > 2 * 1024 * 1024) throw Error('AtScale native closing official response receipt is invalid')
    const headers = final.headers && !Array.isArray(final.headers)
      ? Object.fromEntries(Object.entries(final.headers).map(([key, value]) => [key.toLowerCase(), value])) : {}
    if (Object.keys(headers).length !== Object.keys(final.headers || {}).length || typeof headers['content-type'] !== 'string'
      || headers['content-type'].split(';')[0].trim().toLowerCase() !== 'text/html') throw Error('AtScale native closing official response MIME is invalid')
    parseOfficialAtScale(new TextDecoder('utf-8', { fatal: true }).decode(final.body))
    const indiaCount = result.listingRecords.filter(row => row.india).length
    const complete = !result.failures.length && result.jobs.length === indiaCount
    const jobs = result.jobs.map(job => ({ ...job, sourceListingComplete: complete, lifecycleCleanupAllowed: complete,
      sourceInventoryScope: 'current-official-global-public-board' }))
    combined.throwIfAborted()
    return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'discovery-only', surface: EMBED,
      firstParty: true, listingComplete: complete, pagesFetched: result.pagesFetched + 1,
      reportedTotal: complete ? result.nativeReportedTotal : null, indiaFacetCount: complete ? indiaCount : null, verifiedAt: checkedAt,
      reason: `current-official-global-public-board;terminal-unfiltered-native-inventory-rechecked;observed-native-roles=${result.listingRecords.length};india-roles=${indiaCount};verified-details=${jobs.length};detail-failures=${result.failures.length};source-publication-date-unknown` })
  } finally { clearTimeout(timer) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
