import {readFingentOpenings,readFingentDetail,advertisedFieldStylesheet} from './native.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'fingent'
export const COMPANY = 'Fingent'
export const HOMEPAGE_URL = 'https://www.fingent.com/careers/'
export const CAREERS_URL = 'https://www.fingent.com/careers/career-openings/'
export const VERIFIED_AT = '2026-08-14'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Fingent',
  adapter: 'script',
  modulePath: '../../scraper/fingent/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-first-party-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-searchable-list',
  extractionStrategy: 'verified-first-party-openings-page+careers-jobs-links+public-title-and-experience',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'fingent.com',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.fingent.com/careers/ remained the live Fingent careers home with title "Home - Fingent Careers", and that https://www.fingent.com/careers/career-openings/ remained the live first-party Fingent openings page with title "Career Openings - Fingent Careers". The page publicly exposed /careers/jobs/ links such as Senior Consultant - Magento (Contract), Junior DevOps Engineer/DevOps Engineer, Associate Technical Lead - .NET, Senior Software Engineer .NET, and Data Engineer with visible experience ranges in the listing text.',
  dryRunFile: 'fingent/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|&#x2013;|–/gi, ' - ')
  .replace(/&#8212;|&mdash;|&#x2014;|—/gi, ' - ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url,{signal}={}) => {
 const request=new URL(url),surface=CAREERS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('fingent native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const body=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return body
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Career Openings\s*-\s*Fingent Careers\s*<\/title>/i.test(page)
    && text.includes('Explore Our Current Openings')
    && /open-positions\s+careeropenings/i.test(page)
}

export const extractOpenings = readFingentOpenings

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'fingent',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) => {
  const careersHtml = await fetchText(CAREERS_URL,{signal})
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Fingent verified first-party openings page changed materially')
  }

  const jobs = extractOpenings(careersHtml)
  if (!jobs.length) {
    throw new Error('Fingent verified first-party openings page no longer exposes public roles')
  }

  const stylesheetUrl=advertisedFieldStylesheet(careersHtml),authorCSS=await fetchText(stylesheetUrl,{signal})
  const detailed=[]
  for(const job of jobs)detailed.push(readFingentDetail(await fetchText(job.sourceUrl,{signal}),job,{authorCSS,stylesheetUrl}))
  const result=detailed.map((job) => ({
    ...job,
    company: COMPANY,
    link: job.applyUrl,
    source: SOURCE,
    scrapedAt: now(),
  }))
  return finishNativeCollection(result,{now,pagesFetched:2+jobs.length})
}

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
