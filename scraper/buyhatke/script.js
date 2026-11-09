import {readBuyhatkeDetail,activeListingMarkup} from './native.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://compare.buyhatke.com/company/'

const COMPANY = 'Buyhatke'
const SOURCE = 'buyhatke'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const isCompanyRoleUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return false

  try {
    const parsed = new URL(absoluteUrl)
    return parsed.origin === 'https://compare.buyhatke.com'
      && /^\/company\/[^/]+\.php$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const toJobId = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    return new URL(absoluteUrl).pathname
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.php$/i, '') || null
  } catch {
    return null
  }
}

const extractFirst = (pattern, value) => {
  const match = String(value ?? '').match(pattern)
  return match ? stripTags(match[1]) : null
}

const EXCLUDED_ROLE_PATHS = new Set([
  'index',
  'about-us',
  'media',
  'press-release',
  'blog',
  'contact-us',
  'privacy',
  'terms-and-conditions',
])

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const buildJobDescription = (html) => [...String(html ?? '').matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)
  .join('\n\n') || null

const buildListing = ({ title, sourceUrl }) => {
  const jobId = toJobId(sourceUrl)
  if (!title || !sourceUrl || !jobId || !isCompanyRoleUrl(sourceUrl) || EXCLUDED_ROLE_PATHS.has(jobId)) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location: null,
    city: null,
    country: null,
    jobId,
    requisitionId: null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Sales,\s*SEO,\s*Software Engineer Job Openings\s*\|\s*Jobs at Buyhatke\s*<\/title>/i.test(page)
    && /Careers\s*@\s*Buyhatke/i.test(page)
    && /Jobs\s*@\s*Buyhatke/i.test(page)
    && /href=["'][^"']+\.php["']/i.test(page)
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified Buyhatke careers surface with public opportunities')
  }

  const active=activeListingMarkup(html)
  const articleJobs = [...active.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
    .map((match) => {
      const cardHtml = match[1]
      const sourceUrl = toAbsoluteUrl(extractFirst(/<a\b[^>]*href=["']([^"']+)["']/i, cardHtml))
      const title = extractFirst(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i, cardHtml)

      return buildListing({ title, sourceUrl })
    })
    .filter(Boolean)

  const linkedRoleJobs = [...active.matchAll(/<a\b[^>]*href=["']([^"']+\.php)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => buildListing({
      sourceUrl: toAbsoluteUrl(match[1]),
      title: stripTags(match[2]),
    }))
    .filter(Boolean)

  const jobsByUrl = new Map()
  for (const job of [...articleJobs, ...linkedRoleJobs]) {
    if (!jobsByUrl.has(job.sourceUrl)) jobsByUrl.set(job.sourceUrl, job)
  }

  const jobs = [...jobsByUrl.values()]
  if (jobs.length === 0) {
    throw new Error('Expected verified Buyhatke careers surface with public opportunities')
  }

  return jobs
}

export const extractJobDetail = (html,listing={})=>readBuyhatkeDetail(html,listing)

const defaultFetchText = async (url,{signal}={}) => {
 const request=new URL(url),surface=CAREERS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('buyhatke native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const body=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return body
}

export const createBuyhatkeScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    const careersHtml = await fetchText(CAREERS_URL,{signal})
    const jobs = []

    for (const listing of extractListings(careersHtml)) {
      const detailHtml = await fetchText(listing.sourceUrl,{signal})
      jobs.push(extractJobDetail(detailHtml, listing))
    }

    const result=jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
    return finishNativeCollection(result,{now:overrideNow||now,pagesFetched:1+jobs.length})
  },
})

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'buyhatke',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async (options = {}) => createBuyhatkeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Buyhatke jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
