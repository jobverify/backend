import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeInventoryEvidence, attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { parseCompany, parseListing, parseRole, discoverOfficialClient, verifyOfficialClient, verifyOfficialCMS, hasUnreviewedGeography } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tatacliq'
export const COMPANY = 'Tata CLiQ'
export const FIRST_PARTY_ROOT_URL = 'https://www.tatacliq.com/careers'

export const OFFICIAL_ATS_URL = 'https://cliqonnect.darwinbox.in/ms/candidate/careers'

export const createTataCliqScraper = () => ({
  async run({ fetchImpl = globalThis.fetch, timeoutMs = 120000, signal, now=new Date() } = {}) {
    let pagesFetched = 0
    const controller = new AbortController()
    const coverageGap = (reason, cause) => Object.assign(new Error(`TataCliq coverage gap: ${reason}`, { cause }), {
      code: 'TATACLIQ_COVERAGE_GAP', sourceListingComplete: false,
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
      // AbortSignal. Tata Digital/Neu is not an authorized Tata CLiQ inventory.
      return await Promise.race([cancelled, (async () => {
        const request = async (url, payload, extraHeaders={}) => {
        controller.signal.throwIfAborted()
        const response = await fetchImpl(url, {
          signal: controller.signal, redirect: 'manual',
          method: payload ? 'POST' : 'GET',
          headers: { accept: payload || url.includes('candidateapi') ? 'application/json' : 'text/html', ...(payload ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
          ...(payload ? {body:JSON.stringify(payload)} : {}),
        })
        if (controller.signal.aborted) throw coverageGap('Request cancelled')
        pagesFetched++
        if (response?.status !== 200) throw coverageGap(`Official careers HTTP ${response?.status ?? 'unknown'}`)
        if (response.url !== url) throw coverageGap('Unverified official careers redirect or identity')
        const body = await response.text()
        if (controller.signal.aborted) throw coverageGap('Request cancelled')
        if(typeof body==='string'&&(body.length>20*1024*1024||Buffer.byteLength(body,'utf8')>20*1024*1024))throw coverageGap('Native response exceeds 20 MiB size bound')
        if (typeof body !== 'string' || !body.trim()) throw coverageGap('Official careers body unavailable')
        return body
        }
        const official = await request(FIRST_PARTY_ROOT_URL)
        if (!official.includes('TATACLIQ-WEB-APP')) throw coverageGap('Unrecognized official careers inventory contract')
        verifyOfficialClient(await request(discoverOfficialClient(official)))
        verifyOfficialCMS(JSON.parse(await request('https://apimw.tatacliq.com/content-aggregator-service/v1/pages/landing/custom/careers',undefined,{'x-tenant-id':'beaute'})))
        const api = 'https://cliqonnect.darwinbox.in/ms/candidateapi/'
        const {total} = parseCompany(JSON.parse(await request(api+'getCompanyConfig?is_preview=false&companyId=main')))
        if (!total) throw coverageGap('Native empty inventory requires reviewed current handoff proof')
        const filters = JSON.parse(await request(api+'job/newfilters?companyId=main',{companyId:'main',id:[]}))
        if (filters.status !== 'success' || !Array.isArray(filters.message?.location)) throw coverageGap('Native location filter contract changed')
        const rows = [], ids = new Set()
        for(let page=1;rows.length<total;page++) {
          const next = parseListing(JSON.parse(await request(api+'job/alljobs?companyId=main',{companyId:'main',page,sort_option:'new',limit:10})),total)
          if(next.length!==Math.min(10,total-rows.length)||next.some(row=>ids.has(row.id)))throw coverageGap('Native pagination incomplete or duplicate')
          next.forEach(row=>{ids.add(row.id);rows.push(row)})
        }
        const jobs = []
        let scopeComplete=true
        for(const row of rows) {
          const detail=JSON.parse(await request(api+'job/'+row.id+'?companyId=main'))
          const selected=detail.message?.job
          if(detail.status!=='success'||!Array.isArray(selected)||selected.length!==1||selected[0].id!==row.id||selected[0].title!==row.title||selected[0].designation_display_name!==row.designation_display_name||selected[0].internal_job_code!==row.internal_job_code)throw coverageGap('Selected native role identity changed')
          const nativeDetail=selected[0]
          const publications=[row.posted_on,row.job_posting?.careers?.from,nativeDetail.posted_on,nativeDetail.job_posting?.careers?.from].filter(value=>Number.isSafeInteger(value)&&value>0)
          const merged={...row,...nativeDetail,nativeUnreviewedGeography:hasUnreviewedGeography(row)||hasUnreviewedGeography(nativeDetail),nativeCountryHints:[row.country,nativeDetail.country].filter(Boolean),posted_on:publications.length?Math.min(...publications):null,
            job_posting:{...row.job_posting,careers:{...row.job_posting?.careers,...nativeDetail.job_posting?.careers}}}
          for(const field of ['officelocations_without_area','officelocations_area','tool_tip_locations','officelocation_arr'])merged[field]=[...new Set([...(row[field]||[]),...(nativeDetail[field]||[])])]
          // Each native publication window must be internally consistent even
          // when merging the detail's subset would hide a listing contradiction.
          const listingWindow=parseRole(row,filters.message.location,{now}).nativeWindowEligible
          const job=parseRole(merged,filters.message.location,{now})
          job.nativeListingPublication={posted_on:row.posted_on??null,careers:row.job_posting?.careers??null}
          job.nativeDetailPublication={posted_on:nativeDetail.posted_on??null,careers:nativeDetail.job_posting?.careers??null}
          if(!job.nativeLocationScopeComplete)scopeComplete=false
          if(job.country==='India'&&job.nativeWindowEligible&&listingWindow)jobs.push(job)
        }
        const complete=scopeComplete&&jobs.every(job=>job.sourceDetailComplete)
        for(const job of jobs){job.sourceListingComplete=complete;job.sourceScopeComplete=scopeComplete}
        return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'discovery-only',surface:OFFICIAL_ATS_URL,firstParty:true,listingComplete:complete,pagesFetched,reportedTotal:total,indiaFacetCount:scopeComplete?jobs.length:null,verifiedAt:new Date().toISOString(),reason:complete?'fresh-official-client-active-careers-cms-exact-unistore-tenant-full-pages-selected-details-and-native-countries-reconciled':!scopeComplete?'unresolved-or-contradictory-native-country-scope':'selected-native-description-incomplete'})
      })()])
    } catch (error) {
      controller.abort()
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'TATACLIQ_COVERAGE_GAP') throw error
      throw coverageGap('Official careers transport/body unavailable', error)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createTataCliqScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/tatacliq/script.js')

if (isDirectExecution) {
  // Complete the check before loading persistence, including on dry runs.
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
