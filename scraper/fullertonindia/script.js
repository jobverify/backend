import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FULLERTON_INDIA_CATALOG } from './catalog.js'
import {declaredRoleDescription,readDescriptionPDF,fetchDescriptionPDF,nativePDFRoleIdentity} from './nativeDetails.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FULLERTON_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const REDIRECTED_HOMEPAGE_URL = PROVIDER_METADATA.redirectedHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_ENTRY_URL = PROVIDER_METADATA.jobsBoardEntryUrl
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const JOBS_API_BODY = {
  JDFileName: '',
  OrgCode: '',
  KeyName: '',
}

const WORKLINE_ORIGIN = new URL(JOBS_BOARD_URL).origin

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|button|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeField = (value) => normalizeWhitespace(value) || null
const nativeCountryLabelOf = record => typeof record?.Country_Name==='string'?normalizeField(record.Country_Name):null

const toAbsoluteUrl = (value, baseUrl = JOBS_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const readBoundedBody = async (response,signal) => {
  const reader=response.body?.getReader()
  if(!reader)throw Error('Missing Workline public response body')
  const chunks=[];let bytes=0
  try{for(;;){signal?.throwIfAborted();const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength
    if(bytes>4e6)throw Error('Workline public response body limit');chunks.push(Buffer.from(item.value))}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  return Buffer.concat(chunks).toString('utf8')
}
const defaultFetchPage = async (url,{signal}={}) => {
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean))
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    credentials:'omit',signal:requestSignal,
  })

  return {
    status: response.status,
    url: response.url,
    html: await readBoundedBody(response,requestSignal),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const requestSignal=AbortSignal.any([options.signal,AbortSignal.timeout(20000)].filter(Boolean))
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    redirect: 'error',credentials:'omit',signal:requestSignal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  if(response.url!==url)throw Error('Workline native search response identity changed')
  return JSON.parse(await readBoundedBody(response,requestSignal))
}

const normalizeDate = (value) => {
  const normalized = normalizeField(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null

  const [, day, monthText, year] = match
  const month = MONTHS[monthText.toLowerCase()]
  if (!month) return null

  const candidate=`${year}-${month}-${day.padStart(2, '0')}`
  const parsed=new Date(candidate+'T00:00:00Z')
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===candidate?candidate:null
}

const uniqueParts = (parts) => {
  const seen = new Set()
  const output = []

  for (const value of parts) {
    const normalized = normalizeField(value)
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    output.push(normalized)
  }

  return output
}

const buildLocation = (record) => {
  const country = nativeCountryLabelOf(record)
  const locationName = normalizeField(record?.LOCATIONNAME || record?.Field2)
  const state = normalizeField(record?.State_Name)
  const parts = uniqueParts([locationName, state, country])

  return parts.length > 0 ? parts.join(', ') : country
}

const buildJobDescription = (record) => {
  const lines = [
    normalizeField(record?.Business_Name)
      ? `Business: ${normalizeField(record.Business_Name)}`
      : null,
    normalizeField(record?.Field1)
      ? `Line of business: ${normalizeField(record.Field1)}`
      : null,
    normalizeField(record?.FunName)
      ? `Function: ${normalizeField(record.FunName)}`
      : null,
    normalizeField(record?.LOCATIONNAME)
      ? `Location: ${normalizeField(record.LOCATIONNAME)}`
      : null,
    normalizeField(record?.GradeName)
      ? `Grade: ${normalizeField(record.GradeName)}`
      : null,
    Number.isFinite(Number(record?.No_Of_Vacancies))
      ? `Open positions: ${Number(record.No_Of_Vacancies)}`
      : null,
    normalizeField(record?.PublishDate)
      ? `Posted: ${normalizeField(record.PublishDate)}`
      : null,
  ].filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : null
}

const getTrackToken = (recordOrTrackToken) => {
  if (typeof recordOrTrackToken === 'string') {
    return normalizeField(recordOrTrackToken)
  }

  return normalizeField(recordOrTrackToken?.TrackToken)
}

const getSearchKeyword = (record) => normalizeField(record?.SearchKeyWord)

const isIndiaListingRecord = (record) => {
  const country = nativeCountryLabelOf(record)
  return typeof country==='string'&&/^India$/i.test(country)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title\b[^>]*>\s*SMFG India Credit: Leading Financial Company for Loans\s*<\/title>/i.test(page)
    && /\bSMFG India Credit\b/i.test(text)
    && /href=["'](?:https:\/\/www\.smfgindiacredit\.com)?\/careers\.aspx["']/i.test(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title\b[^>]*>\s*SMFG India Credit Careers - Current Job Openings &(?:amp;)? Employee Testimonials\s*<\/title>/i.test(page)
    && /Careers - SMFG India Credit/i.test(text)
    && /Explore Jobs/i.test(text)
    && /Upload Your Profile/i.test(text)
    && /app52\.workline\.hr\/Candidate\/GeneralOpening\.aspx/i.test(page)
}

export const extractJobsBoardEntryUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["']([^"']*app52\.workline\.hr\/Candidate\/GeneralOpening\.aspx[^"']*)["']/i,
  )

  return toAbsoluteUrl(match?.[1], CAREERS_URL)
}

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*SMFG - Workline - Possibilities Infinite\s*<\/title>/i.test(page)
    && /Begin your search for greater opportunities/i.test(text)
    && /\bSearch Jobs\b/i.test(text)
    && /\bPost Resume\b/i.test(text)
    && /(GeneralOpenings\.js|GetCurrentopening)/i.test(page)
}

export const hasVerifiedJobsPayloadContract = (payload) => {
  if (typeof payload?.d?.obj1 !== 'string' || typeof payload?.d?.obj2 !== 'string') {
    return false
  }

  try {
    return Array.isArray(JSON.parse(payload.d.obj1))
  } catch {
    return false
  }
}

export const extractListingRecords = (payload) => {
  if (!hasVerifiedJobsPayloadContract(payload)) {
    throw new Error('Fullerton India verified jobs api no longer matches the known public response contract')
  }

  return JSON.parse(payload.d.obj1).filter((record) => record && typeof record === 'object')
}

export const buildDetailUrl = (record = {}) => {
  const trackToken = getTrackToken(record)
  const searchKeyword = getSearchKeyword(record)

  if (!trackToken || !searchKeyword) return null

  return `${WORKLINE_ORIGIN}/CandidatePortal/${trackToken}/${encodeURIComponent(searchKeyword)}`
}

export const buildApplyUrl = (recordOrTrackToken) => {
  const trackToken = getTrackToken(recordOrTrackToken)
  if (!trackToken) return null

  return `${WORKLINE_ORIGIN}/Candidate/SignInv1.aspx?PRFCode=${encodeURIComponent(trackToken)}&Flag=C&DirectApply=1`
}

export const mapListingRecordToJob = (record, { scrapedAt = new Date().toISOString() } = {}) => {
  const title = normalizeField(record?.Position_Name)
  const requisitionId = normalizeField(record?.Req_No)
  const sourceUrl = buildDetailUrl(record)
  const applyUrl = buildApplyUrl(record)
  const city = normalizeField(record?.LOCATIONNAME || record?.Field2)
  const nativeCountryLabel=nativeCountryLabelOf(record)
  const country=nativeCountryName(nativeCountryLabel)

  if (!title || !requisitionId || !sourceUrl || !applyUrl) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeField(record?.FunName) || normalizeField(record?.Field1),
    location: buildLocation(record),
    city,
    country,
    sourceNativeCountryLabel:nativeCountryLabel,
    sourceCountryScopeUnresolved:country===null,
    sourceUrl,
    applyUrl,
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId,
    employmentType: null,
    workplaceType: null,
    experienceRequired: normalizeField(record?.Experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: normalizeDate(record?.PublishDate),
    closingDate: null,
    jobDescription: null,
    sourceDescription:null,
    sourceListingSummary:buildJobDescription(record),
    sourceDetailComplete:false,
    sourceDetailFailureKind:'native-description-not-read',
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: applyUrl,
    scrapedAt,
  }
}

export const createFullertonIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, fetchPDF=fetchDescriptionPDF, signal, maxDetails=20 } = {}) {
    signal?.throwIfAborted()
    if(!Number.isSafeInteger(maxDetails)||maxDetails<1||maxDetails>100)throw Error('Invalid Workline public detail bound')
    const homepage = await fetchPage(REDIRECTED_HOMEPAGE_URL,{signal})
    if (
      homepage.status !== 200
      || homepage.url !== REDIRECTED_HOMEPAGE_URL
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Fullerton India verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL,{signal})
    const jobsBoardEntryUrl = extractJobsBoardEntryUrl(careersPage.html)
    if (
      careersPage.status !== 200
      || !hasOfficialCareersSignal(careersPage.html)
      || jobsBoardEntryUrl !== JOBS_BOARD_ENTRY_URL
    ) {
      throw new Error('Fullerton India verified careers page no longer matches the known first-party handoff')
    }

    const jobsBoard = await fetchPage(JOBS_BOARD_ENTRY_URL,{signal})
    if (
      jobsBoard.status !== 200
      || jobsBoard.url !== JOBS_BOARD_URL
      || !hasOfficialJobsBoardSignal(jobsBoard.html)
    ) {
      throw new Error('Fullerton India verified jobs board no longer matches the known public Workline surface')
    }

    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: WORKLINE_ORIGIN,
        Referer: JOBS_BOARD_URL,
      },
      body: JSON.stringify(JOBS_API_BODY),
      signal,
    })

    if (!hasVerifiedJobsPayloadContract(payload)) {
      throw new Error('Fullerton India verified jobs api no longer matches the known public response contract')
    }

    const scrapedAt = now()

    const jobs=[],failures=[],detailFailures=[],seen=new Set(),pdfs=new Map(),records=extractListingRecords(payload)
    for(const record of records.filter(isIndiaListingRecord)){
      signal?.throwIfAborted()
      const job=mapListingRecordToJob(record,{scrapedAt})
      if(!job)continue
      if(seen.has(job.jobId)){failures.push('duplicate-native-requisition');continue}
      seen.add(job.jobId)
      if(seen.size>Math.min(100,Math.max(1,maxDetails))){failures.push('native-detail-budget-reached');break}
      try{
        if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.TrackToken||'')
          ||!Number.isSafeInteger(record.PRFCode)||record.PRFCode<1||!record.JobSpecificationFile)throw Error('Native public role identity or description unavailable')
        const page=await fetchPage(job.sourceUrl,{signal})
        if(page.status!==200||page.url!==job.sourceUrl)throw Error('Native role HTTP '+page.status+' or response identity changed')
        const declared=declaredRoleDescription(page,record)
        if(!pdfs.has(declared.url))pdfs.set(declared.url,fetchPDF(declared.url,{signal}).then(bytes=>readDescriptionPDF(bytes,{signal})))
        const pdf=await pdfs.get(declared.url)
        const identity=nativePDFRoleIdentity(pdf,record)
        if(!identity.complete)failures.push(identity.failureKind)
        jobs.push({...job,country:'India',jobDescription:identity.complete?pdf.text:null,sourceDescription:identity.complete?pdf.text:null,
          sourceDetailComplete:identity.complete,sourceDetailFailureKind:identity.failureKind,
          sourceDescriptionIdentityComplete:identity.complete,sourceNativePDFTitle:identity.title,sourceScopeComplete:false,sourceListingComplete:false,
          lifecycleCleanupAllowed:false,applicationVisited:false,nativeSourceRecord:{listing:record,detail:declared,pdf},
          nativeEmployerBinding:{method:'current-corporate-handoff-and-role-brand',brand:'SMFG India Credit',legalEmployer:null}})
      }catch(error){
        signal?.throwIfAborted();failures.push(String(error.message||error).slice(0,250))
        detailFailures.push({stage:'native-detail',message:String(error.message||error).slice(0,250),cause:error})
        if(/HTTP (?:401|403|429|451)\b/.test(String(error.message||error)))break
      }
    }
    if(!jobs.length&&failures.length)throw Object.assign(Error('Fullerton India current native role descriptions unavailable',{cause:detailFailures[0]?.cause}),{
      failureKind:'coverage_gap',nativeFailures:failures,nativeEvidence:{source:SOURCE,observedListingCount:records.length,records,jobs,failures:detailFailures},sourceScopeComplete:false,lifecycleCleanupAllowed:false})
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:records.length,observedVacancyCount:records.length,
      sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOBS_BOARD_URL,firstParty:fetchPage===defaultFetchPage&&fetchJson===defaultFetchJson&&fetchPDF===fetchDescriptionPDF,listingComplete:false,pagesFetched:3+seen.size,
      reportedTotal:null,indiaFacetCount:null,verifiedAt:scrapedAt,reason:'current-native-India-roles-and-linked-full-PDF-descriptions;company-scope-incomplete;failures='+failures.length})
  },
})

export const run = async (options = {}) => createFullertonIndiaScraper().run(options)

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
