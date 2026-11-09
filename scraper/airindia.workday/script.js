import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readAirIndiaDetail } from './nativeDetails.js'
import { airIndiaRuntime, waitFor } from './runtime.js'
import { nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'airindia'
export const COMPANY = 'Air India'
export const CAREERS_URL = 'https://careers.airindia.com/go/'
export const SEARCH_URL = 'https://careers.airindia.com/search/?createNewAlert=false&q=&optionsFacetsDD_dept=&optionsFacetsDD_department='
export const DISPOSITION = 'live-first-party-successfactors-inventory'
export const VERIFIED_ON = '2026-09-13'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Sunday, September 13, 2026 that Air India publishes its complete public vacancy inventory on the first-party SuccessFactors search surface linked by SHOW ALL OPENINGS from https://careers.airindia.com/go/.'

const decodeHtml = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const getAttribute = (attributes, name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return decodeHtml(
    new RegExp(`\\b${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(attributes)?.[2] || '',
  ) || null
}

const toOfficialUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    const url = new URL(decodeHtml(value), baseUrl)
    return url.protocol === 'https:' && url.origin === new URL(CAREERS_URL).origin && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

const extractJobId = (url) => /\/(\d+)\/?(?:[?#].*)?$/.exec(String(url || ''))?.[1] || null

const extractField = (row, fieldName) => normalizeWhitespace(
  new RegExp(
    `<(?:div|span)\\b[^>]*id=["'][^"']*-section-${fieldName}-value["'][^>]*>([\\s\\S]*?)<\\/(?:div|span)>`,
    'i',
  ).exec(row)?.[1],
)

const normalizeListingLocation = value => normalizeWhitespace(value)

const getCity = (location) => {
  const city = String(location || '').split(',')[0]?.trim()
  return city && !/^India$/i.test(city) ? city : null
}

export const extractAirIndiaOpeningLinks = (html) => {
  const links = []
  const seen = new Set()

  for (const match of String(html || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1]
    const label = [getAttribute(attributes, 'title'), normalizeWhitespace(match[2])]
      .filter(Boolean)
      .join(' ')
    if (!/show all openings/i.test(label)) continue

    const url = toOfficialUrl(getAttribute(attributes, 'href'))
    if (!url || new URL(url).pathname !== '/search/' || seen.has(url)) continue
    seen.add(url)
    links.push(url)
  }

  return links
}

export const extractAirIndiaSearchResults = (html) => {
  const page = String(html || '')
  if (!/Air India Careers Jobs/i.test(page)) {
    throw new Error('Air India official search surface changed materially')
  }

  const label = normalizeWhitespace(
    /<span\b[^>]*id=["']tile-search-results-label["'][^>]*>([\s\S]*?)<\/span>/i.exec(page)?.[1],
  )
  const summaryMatch = /Showing\s+([\d,]+)\s+to\s+([\d,]+)\s+of\s+([\d,]+)\s+Jobs/i.exec(label || '')
  const explicitEmpty = /there are currently no open positions|0 most recent jobs posted by Air India Careers/i.test(page)
  if (!summaryMatch && !explicitEmpty) {
    throw new Error('Air India official search pagination contract changed materially')
  }

  const rows = [...page.matchAll(/<li\b[^>]*class=["'][^"']*\bjob-tile\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
  const jobs = rows.map((rowMatch) => {
    const row = rowMatch[1]
    const linkMatch = /<a\b(?=[^>]*class=["'][^"']*\bjobTitle-link\b[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i.exec(row)
    const sourceUrl = toOfficialUrl(linkMatch?.[1], SEARCH_URL)
    const jobId = extractJobId(sourceUrl)
    const title = normalizeWhitespace(linkMatch?.[2])
    const location = normalizeListingLocation(extractField(row, 'city'))
    const requisitionId = extractField(row, 'customfield1') || jobId
    const department = extractField(row, 'dept')

    if (!sourceUrl || !jobId || !title || !location || !requisitionId) {
      throw new Error('Air India official job tile changed materially or exposed an unsafe URL')
    }

    return {
      title,
      company: COMPANY,
      location,
      city: getCity(location),
      country: nativeLocationCountryName(location),
      nativeLocation: location,
      nativeListingCountry: nativeLocationCountryName(location),
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId,
      requisitionId,
      department,
      employmentType: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      atsPlatform: 'successfactors',
      companyCareerPage: CAREERS_URL,
      sourceListingComplete: false,
      sourceDetailComplete: false,
      sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
      publicExperienceChecked: false,
    }
  })

  if (explicitEmpty && jobs.length === 0) {
    return { jobs, start: 0, end: 0, total: 0 }
  }

  const [start, end, total] = summaryMatch.slice(1).map((value) => (
    Number.parseInt(value.replace(/,/g, ''), 10)
  ))
  const returned = Number.parseInt(
    /<ul\b[^>]*id=["']job-tile-list["'][^>]*data-record-returned=["'](\d+)["']/i.exec(page)?.[1] || '',
    10,
  )
  if (![start, end, total, returned].every(Number.isSafeInteger)
    || returned !== jobs.length
    || end - start + 1 !== jobs.length
    || end > total) {
    throw new Error('Air India official search result count changed materially or is incomplete')
  }

  return { jobs, start, end, total }
}

const defaultFetchHtml = async (url, { signal } = {}) => {
  const response = await fetch(url, {signal,redirect:'manual',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (compatible; Jobverify Air India scraper)'}})
  if(response.status!==200){try{Promise.resolve(response.body?.cancel()).catch(()=>{})}catch{};return {status:response.status,url:response.url,html:null,headers:{'content-type':response.headers.get('content-type')}}}
  const chunks=[];let bytes=0
  for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>4*1024*1024){throw Error('Air India response exceeds4MiB')};chunks.push(chunk)}
  return {status:response.status,url:response.url,html:new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)),headers:{'content-type':response.headers.get('content-type')}}
}

export const createAirIndiaScraper = ({
  fetchHtml = defaultFetchHtml,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const {signal:callerSignal=null,maxPages=50}=options
    callerSignal?.throwIfAborted()
    if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>50)throw TypeError('Invalid Air India page bound')
    const io=airIndiaRuntime(fetchHtml,options),signal=io.signal
    try {
    io.check()
    const landingHtml = await io.read(CAREERS_URL)
    io.check()
    if (!/Air India/i.test(landingHtml) || !/CURRENT OPENINGS/i.test(landingHtml)) {
      throw new Error('Air India official current-openings surface changed materially')
    }

    const [inventoryUrl] = extractAirIndiaOpeningLinks(landingHtml)
    if (!inventoryUrl) {
      throw new Error('Air India official current-openings handoff changed materially')
    }

    const jobs = []
    const seen = new Set()
    let nextUrl = inventoryUrl
    let expectedStart = 1
    let reportedTotal = null
    let pagesFetched = 0

    while (nextUrl && pagesFetched < maxPages) {
      const pageHtml = await io.read(nextUrl)
      io.check()
      const page = extractAirIndiaSearchResults(pageHtml)
      pagesFetched += 1
      reportedTotal ??= page.total

      if (page.total !== reportedTotal || (page.total > 0 && page.start !== expectedStart)) {
        throw new Error('Air India official search pagination changed materially or is incomplete')
      }

      for (const job of page.jobs) {
        if (seen.has(job.jobId)) {
          throw new Error('Air India official search pagination repeated a job and is incomplete')
        }
        seen.add(job.jobId)
        jobs.push(job)
      }

      if (page.end >= page.total) {
        nextUrl = null
        break
      }
      expectedStart = page.end + 1
      const url = new URL(inventoryUrl)
      url.searchParams.set('startrow', String(page.end))
      nextUrl = url.toString()
    }

    if (nextUrl || reportedTotal == null || jobs.length !== reportedTotal) {
      throw new Error('Air India official search inventory is incomplete')
    }

    let cursor=0
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
      while(cursor<jobs.length){
        io.check();const index=cursor++,job=jobs[index]
        let html
        try{html=await io.read(job.sourceUrl);io.check();Object.assign(job,readAirIndiaDetail(job,html))}
        catch(error){io.check();Object.assign(job,{sourceDescription:null,jobDescription:null,sourceDetailComplete:false,sourceDetailFailureKind:error?.code==='AIRINDIA_READ_TIMEOUT'?'timeout':error?.code==='AIRINDIA_DETAIL_CONTRACT'?'native-contract':'upstream',sourceCountryComplete:false,sourceEmployerComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceScopeGaps:['native-detail-unresolved'],sourceNativeDetail:{url:job.sourceUrl,originalHTML:html??null,bodySHA256:io.receipts.findLast(receipt=>receipt.url===job.sourceUrl)?.bodySHA256??null}})}
      }
    }))
    io.check()
    const verifiedAt=now();io.check()
    const countryComplete=jobs.every(job=>job.sourceCountryComplete===true&&job.sourceEmployerComplete===true)
    for(const job of jobs){job.scrapedAt=verifiedAt;job.sourceListingComplete=false;job.lifecycleCleanupAllowed=false;job.sourceScopeComplete=false}
    const audit={source:SOURCE,declaredListingComplete:true,configuredCountryMembershipComplete:countryComplete,companyInventoryComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,observedListingCount:jobs.length,reportedTotal,detailHealth:{complete:jobs.every(job=>job.sourceDetailComplete===true),inspectedJobs:jobs.length,incompleteJobs:jobs.filter(job=>!job.sourceDetailComplete).length,missingDescriptions:jobs.filter(job=>!job.sourceDescription).length},sourceScopeComplete:false,lifecycleCleanupAllowed:false,receipts:io.receipts,productionWrites:false,applicationsVisited:false}
    if(options.onAudit)await waitFor(()=>options.onAudit(structuredClone(audit)),signal)
    if(options.onRecords)await waitFor(()=>options.onRecords(structuredClone(jobs)),signal)
    io.check()
    attachInventoryEvidence(jobs,{
      // This declared board does not enumerate the other company hiring channels.
      // Country-qualified rows and an observed zero do not establish company scope.
      status:'coverage-gap',surface:inventoryUrl,
      firstParty:io.receipts.filter(receipt=>receipt.url===CAREERS_URL||receipt.url===inventoryUrl).every(receipt=>receipt.firstParty),
      listingComplete:false,pagesFetched,reportedTotal,indiaFacetCount:null,verifiedAt,
      reason:'complete-air-india-declared-listing;company-inventory-scope-unresolved'+(countryComplete?'':';native-country-or-employer-scope-unresolved'),
    })
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:jobs.length,observedVacancyCount:jobs.length,sourceScopeComplete:false})
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
    return jobs
    } finally {io.close()}

  },
})

export const run = async (options = {}) => createAirIndiaScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
