import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'
import { runCurrentGitBook } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'gitbook'
export const COMPANY = 'GitBook'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_PAGE_URL = 'https://www.gitbook.com/careers'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/GitBook'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/GitBook'
export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/gitbook/script.js',
  dryRunFile: 'gitbook/jobs.json',
  companyCareerPage: CAREERS_PAGE_URL,
  companyDomain: 'gitbook.com',
  atsPlatform: 'ashby',
  countryFilter: 'Global',
  paginationStrategy: 'single-public-ashby-job-board-get',
  extractionStrategy: 'verified-first-party-careers-page+ashby-handoff+public-ashby-get-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: VERIFIED_ON,
  ashbyPublicBoardUrl: ASHBY_PUBLIC_BOARD_URL,
  ashbyJobBoardUrl: ASHBY_JOB_BOARD_URL,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.gitbook.com/careers is the live first-party GitBook careers page, that it exposes the Open roles section with Growth & Data (IC) and Security Engineer, and that both roles link to the public Ashby board at https://jobs.ashbyhq.com/GitBook backed by https://api.ashbyhq.com/posting-api/job-board/GitBook.',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (job = {}) => job?.address?.postalAddress || job?.address || {}

const buildLocation = (job = {}) => {
  const label = normalizeWhitespace(job?.location)
  const address = getAddress(job)
  const city = normalizeWhitespace(address?.addressLocality)
  const state = normalizeWhitespace(address?.addressRegion)
  const country = normalizeWhitespace(address?.addressCountry)

  return {
    location: label || [city, state, country].filter(Boolean).join(', ') || null,
    city,
    state,
    country,
  }
}

const inferRemoteStatus = (job = {}) => {
  if (job?.isRemote === true || /remote/i.test(String(job?.workplaceType ?? ''))) return 'Remote'
  if (/hybrid/i.test(String(job?.workplaceType ?? ''))) return 'Hybrid'
  if (job?.workplaceType) return 'On-site'
  return null
}

// Retain the native status/final URL and bounded HTML for the source validator.
// In particular a removed, advertised role's 404 is evidence to inspect.
const dispose=operation=>{try{void Promise.resolve(operation()).catch(()=>{})}catch{}}
const abortRace=(promise,signal,onLate)=>new Promise((resolve,reject)=>{
 let settled=false
 const aborted=()=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);reject(signal.reason)}
 signal.addEventListener('abort',aborted,{once:true})
 if(signal.aborted)aborted()
 Promise.resolve(promise).then(value=>{
  if(settled){if(onLate)dispose(()=>onLate(value));return}
  settled=true;signal.removeEventListener('abort',aborted);resolve(value)
 },error=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);reject(error)})
})
const fetchBoundedText = async (url, { signal } = {}, program = false) => {
 const requestSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)])
 requestSignal.throwIfAborted()
 const response=await abortRace(fetch(url,{signal:requestSignal,headers:{'User-Agent':USER_AGENT,Accept:program?'application/javascript':'text/html,application/xhtml+xml'}}),
  requestSignal,late=>late?.body?.cancel())
 if(requestSignal.aborted){dispose(()=>response.body?.cancel());requestSignal.throwIfAborted()}
 const unavailable=message=>{
  dispose(()=>response.body?.cancel())
  const error=new Error('[gitbook] '+message)
  Object.assign(error,{abortRetries:true,lifecycleCleanupAllowed:false})
  if(Number.isInteger(response.status)&&response.status>=100&&response.status<=599){
   error.status=response.status;error.cause={status:response.status,requestUrl:url}
  }
  throw error
 }
 // An advertised unavailable role's actual404 remains inspectable. Other HTTP
 // failures stop collection and retain only their actual status/known request.
 if(response.status!==200&&response.status!==404)unavailable('employer/native HTTP '+response.status)
 const contentType=response.headers.get('content-type')||''
 if(!(program?/^(?:text|application)\/(?:javascript|ecmascript)(?:\s*;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i).test(contentType)
  ||Number(response.headers.get('content-length'))>3000000)unavailable('employer/native HTTP body identity unavailable')
 const reader=response.body.getReader(),chunks=[];let bytes=0
 try{
  for(;;){
   requestSignal.throwIfAborted()
   const part=await abortRace(reader.read(),requestSignal);if(part.done)break
   bytes+=part.value.length
   if(bytes>3000000)throw new Error('[gitbook] employer/native response exceeds byte cap')
   chunks.push(Buffer.from(part.value))
  }
 }finally{dispose(()=>reader.cancel())}
 requestSignal.throwIfAborted()
 return{status:response.status,url:response.url,html:new TextDecoder().decode(Buffer.concat(chunks)),...(program?{contentType}:{})}
}
const defaultFetchText=(url,options)=>fetchBoundedText(url,options)
const defaultFetchProgram=(url,options)=>fetchBoundedText(url,options,true)

const defaultFetchJson = async (url, { signal } = {}) => {
 const response=await fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
  includeResponseMetadata: true,
})
 if(response.status!==200||response.url!==ASHBY_JOB_BOARD_URL)throw new Error('[gitbook] native-inventory-response final URL unavailable')
 return response.payload
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''
  const title = extractTitle(rawHtml) || ''

  return /gitbook careers/i.test(title)
    && normalized.includes('Open roles')
    && (
      normalized.includes('See open roles')
      || normalized.includes('Help build the future of docs for technical teams')
    )
}

export const extractVerifiedAshbyPublicBoardUrl = (html = '') =>
  /https:\/\/jobs\.ashbyhq\.com\/GitBook\b/i.test(String(html ?? ''))
    ? ASHBY_PUBLIC_BOARD_URL
    : null

export const buildAshbyJobBoardUrl = (publicBoardUrl) => {
  try {
    const url = new URL(String(publicBoardUrl ?? ''))
    if (url.hostname !== 'jobs.ashbyhq.com') return null
    const slug = url.pathname.split('/').filter(Boolean)[0]
    return slug ? `https://api.ashbyhq.com/posting-api/job-board/${slug}` : null
  } catch {
    return null
  }
}

export const extractAshbyJobs = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const jobId = normalizeWhitespace(job?.id)
      const sourceUrl = normalizeWhitespace(job?.jobUrl)
      const applyUrl = normalizeWhitespace(job?.applyUrl)
      const location = buildLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.department),
        location: location.location,
        city: location.city,
        state: location.state,
        country: location.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: extractAshbyExperienceRequired({
          title,
          jobDescription: normalizeWhitespace(job?.descriptionPlain ?? job?.descriptionHtml),
        }),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.descriptionPlain ?? job?.descriptionHtml),
        remoteStatus: inferRemoteStatus(job),
      }
    })
    .filter(Boolean)

export const createGitBookScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchPage = fetchText,
    fetchProgram = defaultFetchProgram,
    signal,
    onAudit,
  } = {}) {
    return runCurrentGitBook({fetchPage,fetchProgram,fetchJson,mapJobs:extractAshbyJobs,now,signal,onAudit})
  },
})

export const run = async (options = {}) => createGitBookScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}

