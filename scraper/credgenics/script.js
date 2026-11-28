import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {attachHeldNativeEvidence,collectNativeSnapshots,guardedReader} from './currentPublisher20261128.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'credgenics'
export const COMPANY = 'Credgenics'
export const HOMEPAGE_URL = 'https://www.credgenics.com/'
export const LINKEDIN_COMPANY_ID = '14634991'
export const VERIFIED_LINKEDIN_JOBS_URL =
  `https://www.linkedin.com/jobs/search/?f_C=${LINKEDIN_COMPANY_ID}&geoId=92000000`
export const ZAPPYHIRE_BOARD_URL = 'https://recruitcareers.zappyhire.com/en/credgenics'
export const ZAPPYHIRE_API_BASE = 'https://credgenics.zappyhire-multitenant-be-prod.zappyhire.com/api/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const normalizeLinkedInJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    if (hostname !== 'linkedin.com') return null

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInJobsUrl(redirected) : null
    }

    if (/^\/company\/credgenics\/jobs\/?$/i.test(url.pathname)) {
      return VERIFIED_LINKEDIN_JOBS_URL
    }

    if (/^\/jobs\/search\/?$/i.test(url.pathname)) {
      if (url.searchParams.get('f_C') !== LINKEDIN_COMPANY_ID) return null

      const normalized = new URL('https://www.linkedin.com/jobs/search/')
      normalized.searchParams.set('f_C', LINKEDIN_COMPANY_ID)
      normalized.searchParams.set('geoId', url.searchParams.get('geoId') || '92000000')
      return normalized.toString()
    }
  } catch {
    return null
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Credgenics\s*\|\s*Debt Collections\s*(?:&amp;|&)\s*Resolution Platform/i.test(page)
    && /Supercharge debt collections with AI-driven full-stack platform/i.test(text)
    && /India'?s Best Selling AI-powered Loan Collections Platform/i.test(text)
    && /\bCompany\b/i.test(text)
    && /support@credgenics\.com/i.test(text)
    && /Analog Legalhub Technology Solutions Pvt\. Ltd\.\s*All Rights Reserved\./i.test(text)
}

export const hasCurrentHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  return /<title>\s*Credgenics\s*\|\s*Customer Experience Management\s*\|/i.test(page)
    && /Supercharge debt collections with AI-driven full-stack platform/i.test(text)
    && /Analog Legalhub Technology Solutions Pvt\. Ltd\. All Rights Reserved\./i.test(text)
    && extractZappyhireBoardUrl(page) === ZAPPYHIRE_BOARD_URL
}

export const extractZappyhireBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(decodeHtmlEntities(match[1]))
      if (url.origin === new URL(ZAPPYHIRE_BOARD_URL).origin
        && url.pathname.replace(/\/$/, '') === '/en/credgenics') return ZAPPYHIRE_BOARD_URL
    } catch {
      // Ignore unrelated relative links.
    }
  }
  return null
}

export const hasZappyhireBoardShell = (html) =>
  /<title>\s*Careers\s*<\/title>/i.test(String(html ?? ''))
  && /<base\s+href=["']\/en\/["']/i.test(String(html ?? ''))
  && /<app-root><\/app-root>/i.test(String(html ?? ''))

export const buildZappyhireJobsUrl = (page, pageSize) =>
  `${ZAPPYHIRE_API_BASE}jobs/jobsearch/?page=${page}&page_size=${pageSize}`

export const buildZappyhireJobDetailUrl = (id) =>
  `${ZAPPYHIRE_API_BASE}careers/jobs/${id}/`

const parseZappyhireLocations = (locations) => (Array.isArray(locations) ? locations : [])
  .map((item) => ({
    city: normalizeWhitespace(String(item?.city ?? '').split('-')[0]),
    countryCode: typeof item?.country_code === 'string' ? item.country_code : null,
  }))
  .filter((item) => item.city)

export const extractZappyhireJob = (record, detail, verifiedCities, scrapedAt, {countryHeld=false} = {}) => {
  const item = record?._source
  const id = Number(item?.job)
  const locations = parseZappyhireLocations(detail?.location)
  const careerLink = detail?.job_board_urls?.find((link) => link?.name === 'Career Page')?.url
  let applyUrl
  try {
    applyUrl = new URL(careerLink)
  } catch {
    throw new Error(`Credgenics Zappyhire detail has no valid application URL for job ${id}`)
  }
  if (item?.client !== 'credgenics'
    || !/^credgenics$/i.test(String(item?.entity ?? ''))
    || !Number.isInteger(id)
    || detail?.id !== id
    || normalizeWhitespace(detail?.title) !== normalizeWhitespace(item?.title)
    || applyUrl.origin !== 'https://recruitcareers.zappyhire.com'
    || applyUrl.username || applyUrl.password || applyUrl.hash
    || !/^\/credgenics\/apply\/?$/.test(applyUrl.pathname)
    || applyUrl.searchParams.getAll('job').length !== 1
    || applyUrl.searchParams.get('job') !== String(id)
    || [...applyUrl.searchParams.keys()].some(key => !['job','source','company'].includes(key))
    || ['source','company'].some(key=>applyUrl.searchParams.getAll(key).length>1 || applyUrl.searchParams.has(key)&&applyUrl.searchParams.get(key)!=='1')) {
    throw new Error(`Credgenics Zappyhire job ${id} no longer matches the verified public listing and detail`)
  }
  if (countryHeld) return null
  if (locations.length === 0 || !locations.every((location) => location.countryCode === 'IN' && verifiedCities.has(location.city))) {
    throw new Error(`Credgenics Zappyhire job ${id} has unqualified native country or location`)
  }

  const location = `${locations.map((entry) => entry.city).join(', ')}, India`
  const experience = Number.isFinite(detail.experience) && Number.isFinite(detail.max_experience)
    ? `${detail.experience}-${detail.max_experience} years` : null
  const sourceUrl = applyUrl.toString()
  return {
    title: normalizeWhitespace(detail.title),
    company: COMPANY,
    department: normalizeWhitespace(detail.department),
    location,
    city: locations[0].city,
    country: 'India',
    jobId: `${SOURCE}-${id}`,
    requisitionId: String(id),
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(detail.job_type),
    experienceRequired: experience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills) ? detail.skills.map(normalizeWhitespace).filter(Boolean) : [],
    postingDate: detail.job_publish_date || null,
    closingDate: null,
    jobDescription: stripTags(detail.description),
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
    companyCareerPage: ZAPPYHIRE_BOARD_URL,
    companyDomain: 'credgenics.com',
    atsPlatform: 'official-zappyhire-board',
    nativeCriteriaData: {record:structuredClone(record),detail:structuredClone(detail)},
    sourceDetailComplete: false,
    sourceDetailStatus: 'partial',
    sourceDetailFailureKind: 'native-rendering-and-application-unqualified',
    sourceRenderedCriteriaComplete: false,
    sourceApplicationQualificationComplete: false,
    sourceAvailabilityVerified: false,
    applicationPublicContextValidated: false,
    activeApplyVerified: false,
    sourceScopeComplete: false,
    sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
  }
}

export const extractLinkedInJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const linkedInUrl = normalizeLinkedInJobsUrl(match[1])
    if (linkedInUrl) return linkedInUrl
  }

  return null
}

export const pageExposesFirstPartyJobsSignal = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl) continue

    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'credgenics.com') continue
    if (/\/(?:careers?|jobs?)(?:\/|$)/i.test(url.pathname)) return true
  }

  return false
}

const readWithOwnedResponses = async (reader,url,options) => {
  const responses=new Set()
  const dispose=async response=>{
    if(response.body&&!response.bodyUsed)await disposeResponseBody(response,{bestEffort:true})
  }
  const fetchImpl=async (input,init)=>{
    const response=await fetch(input,init)
    // A fetch which ignores abort may settle after the reader's finally ran.
    // That late response retains its own cleanup rather than escaping ownership.
    if(init.signal?.aborted){
      try{await dispose(response)}catch{}
      throw init.signal.reason
    }
    responses.add(response)
    return response
  }
  try{return await reader(url,{...options,fetchImpl})}
  finally{await Promise.allSettled([...responses].map(dispose))}
}

const defaultFetchText = async (url, {signal} = {}) => {
  const result = await readWithOwnedResponses(fetchTextWithRetry,url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
  redirect: 'manual',
  includeResponseMetadata: true,
  })
  if (result.status !== 200 || result.url !== url) throw new Error(`Credgenics public text response identity changed for ${url}`)
  return result.html
}

const defaultFetchJson = async (url, {signal} = {}) => {
  const result = await readWithOwnedResponses(fetchJsonWithRetry,url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
  redirect: 'manual',
  includeResponseMetadata: true,
  })
  if (result.status !== 200 || result.url !== url) throw new Error(`Credgenics public JSON response identity changed for ${url}`)
  return result.payload
}

export const createCredgenicsScraper = ({ pageSize = 100 } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString(), signal } = {}) {
    const readText = guardedReader(fetchText,signal)
    const readJSON = guardedReader(fetchJson,signal)
    const homepageHtml = await readText(HOMEPAGE_URL)

    if (hasCurrentHomepageSignal(homepageHtml)) {
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new Error('Credgenics Zappyhire page size must be between 1 and 100')
      }
      const scrapedAt = now()
      return collectNativeSnapshots({readText,readJSON,homepageHtml,homepageURL:HOMEPAGE_URL,boardURL:ZAPPYHIRE_BOARD_URL,apiBase:ZAPPYHIRE_API_BASE,pageSize,scrapedAt,
        verifyHomepage:hasCurrentHomepageSignal,verifyBoard:hasZappyhireBoardShell,extractJob:extractZappyhireJob,buildJobsURL:buildZappyhireJobsUrl,buildDetailURL:buildZappyhireJobDetailUrl})
    }

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Credgenics official homepage changed; refusing to assume the verified surface still applies')
    }

    if (pageExposesFirstPartyJobsSignal(homepageHtml)) {
      throw new Error('Credgenics homepage now appears to expose a first-party public jobs surface')
    }

    const linkedInJobsUrl = extractLinkedInJobsUrl(homepageHtml)
    if (linkedInJobsUrl && linkedInJobsUrl !== VERIFIED_LINKEDIN_JOBS_URL) {
      throw new Error('Credgenics careers handoff changed; refusing to assume the verified external route still applies')
    }

    return attachHeldNativeEvidence([],{surface:HOMEPAGE_URL,verifiedAt:now()})
  },
})

export const run = async (options = {}) => createCredgenicsScraper().run(options)

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
