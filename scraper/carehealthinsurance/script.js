import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeInventoryEvidence, attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createHash } from 'node:crypto'
import { officialContract, rows } from './native.js'
import candidate from './catalog.candidate.json' with {type:'json'}

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'carehealthinsurance'
export const COMPANY = 'Care Health Insurance'
export const FIRST_PARTY_ROOT_URL = 'https://www.careinsurance.com/rhicl/careers'
export const SEARCH_URL = FIRST_PARTY_ROOT_URL + '/job-search'
export const PROVIDER_METADATA = {...candidate, modulePath:fileURLToPath(import.meta.url)}

export const createCareHealthInsuranceScraper = () => ({
  async run({fetchImpl = globalThis.fetch, signal, timeoutMs = 30000} = {}) {
    signal?.throwIfAborted()
    let pagesFetched = 0, surface = FIRST_PARTY_ROOT_URL
    const controller = new AbortController(), retainedResponses = []
    const gap = (reason, cause) => Object.assign(new Error('Care Health Insurance coverage gap: ' + reason, {cause}), {
      code:'CAREHEALTHINSURANCE_COVERAGE_GAP', sourceListingComplete:false, lifecycleCleanupAllowed:false,
      retainedResponses,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap', surface, firstParty:true,
        listingComplete:false, pagesFetched, reportedTotal:null, indiaFacetCount:null,
        verifiedAt:new Date().toISOString(), reason}),
    })
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw gap('Invalid aggregate request budget')
    let timer, onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => {controller.abort(signal.reason); reject(signal.reason)}
      signal?.addEventListener('abort', onAbort, {once:true})
      timer = setTimeout(() => { const error = gap('Aggregate source deadline exceeded'); controller.abort(error); reject(error) }, timeoutMs)
    })
    const collect = async () => {
      const read = async url => {
        controller.signal.throwIfAborted(); surface = url
        const response = await fetchImpl(url, {signal:controller.signal, redirect:'error', headers:{Accept:'text/html'}})
        controller.signal.throwIfAborted()
        if (response.url !== url || response.status !== 200) throw gap('Source HTTP failure or final URL changed')
        let body
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []
          let bytes = 0
          const cancel = () => {void reader.cancel(controller.signal.reason).catch(() => {})}
          controller.signal.addEventListener('abort', cancel, {once:true})
          try {
            while (true) {
              controller.signal.throwIfAborted()
              const {done, value} = await reader.read()
              controller.signal.throwIfAborted()
              if (done) break
              bytes += value.byteLength
              if (bytes > 5000000) {void reader.cancel().catch(() => {}); throw gap('Source body exceeds bound')}
              chunks.push(value)
            }
            body = Buffer.concat(chunks).toString('utf8')
          } finally {controller.signal.removeEventListener('abort', cancel); reader.releaseLock()}
        } else body = await response.text()
        controller.signal.throwIfAborted()
        if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 5000000) throw gap('Source body missing or exceeds bound')
        pagesFetched++
        retainedResponses.push({url, status:response.status, body, bodySHA256:createHash('sha256').update(body).digest('hex')})
        return body
      }
      const home=await read(FIRST_PARTY_ROOT_URL), search=await read(SEARCH_URL)
      officialContract(home, search, SEARCH_URL)
      const seen=new Set(), nativeRows=[]
      for(const category of ['0','1','2']) nativeRows.push(...rows(await read('https://www.careinsurance.com/rhicl/getOpenings/'+category), category, seen, new Date()))
      const geographyGaps=nativeRows.filter(r => !r.india).map(r => ({id:r.id, title:r.title, location:r.location, reason:'Native country not explicit; city or region alone cannot establish India'}))
      const jobs=nativeRows.filter(r => r.india).map(r => ({source:SOURCE, company:COMPANY, jobId:r.id, title:r.title,
        location:r.location, country:'India', link:SEARCH_URL, applyUrl:SEARCH_URL, sourceUrl:SEARCH_URL,
        jobDescription:r.description, postingDate:r.postingDate, sourceDetailComplete:Boolean(r.description),
        nativeCreatedAt:r.nativeCreatedAt, nativeUpdatedAt:r.nativeUpdatedAt, nativeCategory:r.category,
        sourceFirstParty:true, sourceListingComplete:false, sourceScopeComplete:false, lifecycleCleanupAllowed:false,
        scrapedAt:new Date().toISOString(), nativeApplicationSelection:{job_title:r.title, location:r.location, category:r.category},
      }))
      if(!jobs.length) throw gap('No explicit India native roles verified; company-wide scope remains incomplete')
      const collection={nativeRecordCount:nativeRows.length, geographyGaps, sourceListingComplete:false, lifecycleCleanupAllowed:false,
        pagination:'Reviewed client consumes one unpaginated array for each of three categories; no public company-wide total',
        retainedResponses}
      for(const [index,job] of jobs.entries()) job.nativeCollectionEvidence=index === 0 ? collection : {...collection,retainedResponses:retainedResponses.map(({body,...rest}) => rest)}
      return attachInventoryEvidence(jobs,{status:'discovery-only', surface:SEARCH_URL, firstParty:true, listingComplete:false,
        pagesFetched, reportedTotal:null, indiaFacetCount:null, verifiedAt:new Date().toISOString(),
        reason:'Reviewed first-party category arrays recovered; country gaps and whole-company scope remain incomplete'})
    }
    try { return await Promise.race([collect(), aborted]) }
    catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'CAREHEALTHINSURANCE_COVERAGE_GAP') throw error
      throw gap('Source transport, body or native contract unavailable', error)
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort()
    }
  },
})

export const run = async (options = {}) => createCareHealthInsuranceScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/carehealthinsurance/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
