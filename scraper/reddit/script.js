import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import REDDIT_CATALOG from './catalog.js'
import {retainRedditNativeRecords} from './nativeRecords.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = REDDIT_CATALOG.source
export const COMPANY = REDDIT_CATALOG.companyName
export const VERIFIED_ON = REDDIT_CATALOG.verifiedOn
export const PROVIDER_METADATA = REDDIT_CATALOG
export const CAREERS_PAGE_URL = REDDIT_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_URL = REDDIT_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = REDDIT_CATALOG.greenhouseJobsApiUrl
export const extractNativeJobsFromGreenhousePayload = retainRedditNativeRecords

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'),
)?.toLowerCase() || ''

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  return /\bIndia\b/i.test(normalized)
    || /\bRemote\s*-\s*India\b/i.test(normalized)
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /\bremote\b/i.test(normalized)) return null

  return normalized.split(',')[0]?.trim() || null
}

const normalizeRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase() || ''
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const normalizeGreenhouseJobUrl = (value, jobId) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  try {
    const url = new URL(String(value ?? ''))
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/g, '')

    if (hostname !== 'job-boards.greenhouse.io') return null
    if (pathname !== `/reddit/jobs/${normalizedId}`) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${normalizedId}`
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers - Reddit\s*<\/title>/i.test(page)
    && normalized.includes('view job openings')
    && /https:\/\/job-boards\.greenhouse\.io\/reddit\/jobs\/\d+/i.test(page)
    && /"Remote - India"\s*:\s*"India"/i.test(page)
    && /"Bangalore, India"\s*:\s*"India"/i.test(page)
}

export const extractIndiaJobsFromGreenhousePayload = (payload,{scrapedAt=new Date().toISOString()}={}) =>
  retainRedditNativeRecords(payload,{scrapedAt})
    .filter(job=>isIndiaLocation(job.location))
    .map(job=>({...job,country:'India',city:deriveCity(job.location),department:normalizeWhitespace(job.sourceNativeRecord.departments?.[0]?.name),requisitionId:job.jobId,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],closingDate:null,remoteStatus:normalizeRemoteStatus(job.location)}))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createRedditScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = defaultNow,
    signal,
    onAudit,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified official Reddit careers page changed materially')
    }

    const payload=await fetchJson(GREENHOUSE_JOBS_API_URL)
    signal?.throwIfAborted()
    const nativeRecords=retainRedditNativeRecords(payload,{scrapedAt:now()})
    const nativeById=new Map(nativeRecords.map(row=>[row.jobId,row]))
    // Preserve the CURRENT strongest engine, complete original envelope and
    // all its country/detail/identity evidence. No feed subset or rebuilding.
    const strong=await createPublishingGapAtsScraper({...REDDIT_CATALOG,boardToken:'reddit',sourceScopeComplete:false,lifecycleCleanupAllowed:false}).run({fetchJson:async url=>{if(url!==GREENHOUSE_JOBS_API_URL)throw Error('Unexpected Reddit native endpoint');return payload},signal})
    signal?.throwIfAborted()
    const strongestEngineEvidence=readInventoryEvidence(strong)
    const jobs=strong.map(job=>{
      const native=nativeById.get(String(job.jobId));if(!native)throw Error('Reddit strongest engine returned unknown native identity')
      // Enrichment fields cannot overwrite engine country, location, identity,
      // detail flags, normalized dates, content provenance or employment type.
      const {sourceFirstPublished,sourceUpdatedAt,sourceEmploymentCriteria,sourceNativeMetadata,sourceNativeRecord,sourceNativeContent,sourceNativeRequisitionId,sourceCriteriaIssues,sourceCriteriaReviewComplete,legalHiringEmployer,sourcePublisher}=native
      return {...job,sourceFirstPublished,sourceUpdatedAt,sourceEmploymentCriteria,sourceNativeMetadata,sourceNativeRecord,sourceNativeContent,sourceNativeRequisitionId,sourceCriteriaIssues,sourceCriteriaReviewComplete,legalHiringEmployer,sourcePublisher,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    })
    const audit={source:SOURCE,productionWrites:false,currentLiveQualification:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,originalNativePayload:structuredClone(payload),nativeRecords,strongestEngineEvidence,observedNativeBoardCount:payload.jobs.length,missingProofs:['current corporate activation and hiring-channel scope','all native role country alternatives and full detail schema','fresh opening/closing global cohort'],noClosingCaptureClaimed:true}
    Object.defineProperty(jobs,'sourceAudit',{value:audit});onAudit?.(structuredClone(audit));signal?.throwIfAborted()
    return attachInventoryEvidence(jobs,{...strongestEngineEvidence,status:'discovery-only',listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:'reddit-native-criteria-retained-source-scope-unresolved:'+strongestEngineEvidence.reason})
  },
})

export const run = async (options = {}) => createRedditScraper(options).run(options)

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
