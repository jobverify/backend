import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { normalizeInventoryEvidence, attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { activeDocument, employerListingURL, listingRows, detailJob } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'truemeds'
export const COMPANY = 'Truemeds'
export const FIRST_PARTY_ROOT_URL = 'https://www.truemeds.in/about-us'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/truemeds-india'

export const createTruemedsScraper = () => ({
  async run({fetchImpl = globalThis.fetch, timeoutMs = 60000, signal, now = () => new Date().toISOString()} = {}) {
    signal?.throwIfAborted()
    let firstParty = false, pagesFetched = 0, surface = FIRST_PARTY_ROOT_URL
    const retainedResponses = [], controller = new AbortController()
    const gap = (reason, cause) => Object.assign(new Error(`Truemeds coverage gap: ${reason}`, {cause}), {
      code: 'TRUEMEDS_COVERAGE_GAP', sourceListingComplete: false, lifecycleCleanupAllowed: false,
      retainedResponses,
      inventoryEvidence: normalizeInventoryEvidence({status:'coverage-gap', surface, firstParty,
        listingComplete:false, pagesFetched, reportedTotal:null, indiaFacetCount:null,
        verifiedAt:new Date().toISOString(), reason}),
    })
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw gap('Invalid aggregate deadline')
    let timer, onAbort
    const cancelled = new Promise((_, reject) => {
      onAbort = () => { controller.abort(signal.reason); reject(signal.reason) }
      signal?.addEventListener('abort', onAbort, {once:true})
      timer = setTimeout(() => {
        const error = gap('Aggregate deadline exceeded checking official employer inventory')
        controller.abort(error); reject(error)
      }, timeoutMs)
    })
    const inspect = async () => {
      const read = async url => {
        controller.signal.throwIfAborted(); surface = url
        const response = await fetchImpl(url, {signal:controller.signal, redirect:'manual', headers:{accept:'text/html'}})
        controller.signal.throwIfAborted()
        if (response?.url !== url) throw gap('Native final URL identity changed')
        const body = await response.text()
        controller.signal.throwIfAborted()
        if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 5000000) throw gap('Native body unavailable or exceeds bound')
        pagesFetched++
        retainedResponses.push({url, status:response.status, body, bodySHA256:createHash('sha256').update(body).digest('hex')})
        if (response.status !== 200) throw gap(`Native HTTP ${response.status}`)
        return activeDocument(body)
      }
      const official = await read(FIRST_PARTY_ROOT_URL)
      if (!official.text(official.root).includes('Intellihealth Solutions Private Limited')
        || !official.text(official.root).includes('India')
        || !official.nodes(n => n.tag === 'a' && n.attrs.href === EMPLOYER_URL).length) {
        throw gap('Official Intellihealth employer identity or LinkedIn handoff changed')
      }
      firstParty = true
      const company = await read(EMPLOYER_URL)
      const listingURL = employerListingURL(company)
      const rows = listingRows(await read(listingURL)), jobs = [], detailGaps = [], exclusions = []
      for (const row of rows) {
        controller.signal.throwIfAborted()
        try {
          const job = detailJob(await read(row.url), row, now())
          if (job) jobs.push(job)
          else exclusions.push({id:row.id, reason:'native-non-India-closed-or-future'})
        } catch (error) {
          if (signal?.aborted || controller.signal.aborted) throw error
          const failure = error?.code === 'TRUEMEDS_COVERAGE_GAP' ? error : gap('Native role contract drift', error)
          detailGaps.push({id:row.id, url:row.url, code:failure.code, reason:failure.cause?.message || failure.message})
        }
      }
      if (!jobs.length && detailGaps.length) throw gap('No eligible roles could be verified from native details')
      const reason = 'Employer LinkedIn board recovered; whole-company inventory unverified' + (detailGaps.length ? '; blocked or unverified details retained' : '')
      const evidence = {status:'discovery-only', surface:listingURL, firstParty:true, listingComplete:false,
        pagesFetched, reportedTotal:rows.length, indiaFacetCount:null, verifiedAt:now(), reason}
      const collection = {source:'truemeds', listingURL, listingRecordCount:rows.length, extractedDetailJobs:jobs.length,
        sourceListingComplete:false, lifecycleCleanupAllowed:false, detailGaps, exclusions, retainedResponses}
      for (const [index, job] of jobs.entries()) job.nativeCollectionEvidence = index === 0 ? collection : {
        ...collection, retainedResponses:retainedResponses.map(({body, ...metadata}) => metadata), fullBatchEvidenceOnFirstExtractedJob:true}
      return attachInventoryEvidence(jobs, evidence)
    }
    try { return await Promise.race([inspect(), cancelled]) }
    catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'TRUEMEDS_COVERAGE_GAP') throw error
      throw gap('Native employer transport/body or inventory contract unavailable', error)
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort()
    }
  },
})

export const run = async (options = {}) => createTruemedsScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/truemeds/script.js')

if (isDirectExecution) {
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
