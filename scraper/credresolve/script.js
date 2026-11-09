import {readCredresolveFields} from './nativeFields.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'credresolve'
export const COMPANY = 'CredResolve'
export const HOMEPAGE_URL = 'https://credresolve.co.in/'
export const JOB_OPENINGS_URL = 'https://credresolve.co.in/jobopenings'
export const CAREERS_API_URL = 'https://credresolve.co.in/wp-json/wp/v2/awsm_job_openings'
export const PAGE_SIZE = 100

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => {
  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const titleCaseWords = (value) => String(value ?? '')
  .toLowerCase()
  .split(/(\s+|\/|-)/)
  .map((part) => (/^[a-z0-9]+$/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
  .join('')
  .trim() || null

const isRemoteStatusToken = (value) => /\b(remote|hybrid|in-office|on-site|onsite)\b/i.test(String(value ?? ''))

const normalizeRemoteStatus = (...values) => {
  const combined = values.filter(Boolean).join(' ').toLowerCase()
  if (combined.includes('remote')) return 'Remote'
  if (combined.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeText(value)
  if (!normalized || isRemoteStatusToken(normalized)) return null
  return titleCaseWords(normalized)
}

const normalizeLocation = (value) => {
  const normalized = normalizeText(value)
  if (!normalized || isRemoteStatusToken(normalized)) {
    return { location: null, city: null }
  }

  if (/,?\s*india$/i.test(normalized)) {
    return {
      location: normalized,
      city: normalizeText(normalized.replace(/,?\s*india$/i, '')),
    }
  }

  return {
    location: normalized,
    city: normalized,
  }
}

const isSameDomainDetail = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase() === 'credresolve.co.in'
  } catch {
    return false
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*CredResolve Advisory Services/i.test(page)
    && /\bCredResolve Advisory Services\b/i.test(normalized)
    && /\bLoan Settlement and Financial Resolution Experts in India\b/i.test(normalized)
    && /\bAbout CredResolve\b/i.test(normalized)
    && /\bJob Openings\b/i.test(normalized)
    && /contact@credresolve\.co\.in/i.test(normalized)
}

export const hasOfficialJobOpeningsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Job Openings\s*(?:-|–|—|&#8211;|&ndash;|&mdash;)\s*CredResolve Advisory Services/i.test(page)
    && /\bJob Openings\b/i.test(normalized)
    && /\bCredResolve Advisory Services\b/i.test(normalized)
    && /\bBack Office Executive\b/i.test(normalized)
    && /\bCustomer Support Executive\b/i.test(normalized)
}

const assertVerifiedFeed = (records) => {
  if (!Array.isArray(records)) {
    throw new Error('CredResolve verified WP Job Openings feed no longer matches the public archive')
  }

  for (const record of records) {
    const classList = Array.isArray(record?.class_list) ? record.class_list : []
    if (!classList.includes('type-awsm_job_openings') || !classList.includes('status-publish') || !Number.isInteger(record?.id) || record.id<=0 || record?.content?.protected===true || !isSameDomainDetail(record?.link) || !/^\/jobopenings\/[^/]+\/$/.test(new URL(record.link).pathname)) {
      throw new Error('CredResolve verified WP Job Openings feed no longer matches the public archive')
    }
  }

  return records
}

export const buildSearchUrl = (page, pageSize = PAGE_SIZE) => {
  const url = new URL(CAREERS_API_URL)
  url.searchParams.set('_fields', 'id,link,title,content,class_list')
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractSearchResults = (records) => assertVerifiedFeed(records)
  .map((record) => {
    const contentHtml = String(record?.content?.rendered ?? '')
    const fields=readCredresolveFields(contentHtml)
    const department = fields.field('Job Category')
    const requirements = fields.items('Requirements')
    const description = [fields.field('Job Description'),...fields.items('Key Responsibilities'),...fields.items('Requirements')].filter(Boolean).join(' ')||null
    const locationField = fields.field('Job Location')
    const typeField = fields.field('Job Type')
    const location = normalizeLocation(locationField)
    const feedTitle=normalizeText(record.title?.rendered),contentJobTitle=fields.field('Job Title')
    const descriptionIntroRole=fields.field('Job Description')?.match(/^The (.+?) (?:at CredResolve(?: Advisory Services)? )?(?:will|shall|is responsible for)\b/i)?.[1]||null
    const identityQualified=Boolean(feedTitle&&contentJobTitle&&feedTitle===contentJobTitle&&(!descriptionIntroRole||descriptionIntroRole===feedTitle))

    return {
      title: normalizeText(record?.title?.rendered),
      company: COMPANY,
      department,
      location: location.location,
      city: location.city,
      country: nativeLocationCountryName(location.location),
      jobId: record?.id == null ? null : String(record.id),
      requisitionId: record?.id == null ? null : String(record.id),
      sourceUrl: normalizeText(record?.link),
      applyUrl: normalizeText(record?.link),
      employmentType: normalizeEmploymentType(typeField),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: requirements,
      postingDate: null,
      closingDate: null,
      jobDescription: identityQualified?description:null,
      rawNativeRoleEvidence:{feedTitle,contentJobTitle,descriptionIntroRole,workplaceField:locationField,identityQualified,contentHtml,contentJobDescription:description,activeNativeFieldsQualified:true,applicationSubmissionQualified:false},
      remoteStatus: normalizeRemoteStatus(locationField, typeField),
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchJson=async(url,options)=>JSON.parse(await defaultFetchText(url,options))

const defaultFetchText = async (url,{signal}={}) => {
 const request=new URL(url),surface=JOB_OPENINGS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('credresolve native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const body=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return body
}

export const createCredresolveScraper = ({
  pageSize = PAGE_SIZE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(), signal,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL,{signal})
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('CredResolve verified official homepage surface no longer matches the known first-party site')
    }

    const jobOpeningsHtml = await fetchText(JOB_OPENINGS_URL,{signal})
    if (!hasOfficialJobOpeningsSignal(jobOpeningsHtml)) {
      throw new Error('CredResolve verified official job openings surface no longer matches the known first-party site')
    }

    const jobs = [],seen=new Set();let pagesFetched=2

    for (let page = 1; ; page += 1) {
      if(page>100)throw Object.assign(Error('CredResolve unbounded inventory pagination'),{abortRetries:true})
      const pageRecords = assertVerifiedFeed(await fetchJson(buildSearchUrl(page, pageSize),{signal}))
      pagesFetched+=1
      for(const row of pageRecords){if(seen.has(row.id))throw Object.assign(Error('CredResolve duplicated/cyclic native role inventory'),{abortRetries:true});seen.add(row.id)}
      jobs.push(...extractSearchResults(pageRecords).map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })))

      if (pageRecords.length < pageSize) break
    }

    if(!jobs.length)throw Object.assign(Error('CredResolve native role inventory empty without scope proof'),{abortRetries:true})
    return finishNativeCollection(jobs,{now,pagesFetched,observedListingCount:seen.size})
  },
})

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'credresolve',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOB_OPENINGS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async (options = {}) => createCredresolveScraper().run(options)

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
