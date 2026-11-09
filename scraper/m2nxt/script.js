import {readRoleControls,advertisedRoleClient,readLiteralRoles,norm} from './native.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'm2nxt'
export const COMPANY = 'm2nxt Solutions (P) Ltd'
export const HOMEPAGE_URL = 'https://www.m2nxt.com/'
export const CAREERS_URL = 'https://www.m2nxt.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DETAILED_TITLE = 'Pre Sales Mechanical Design & Estimation for Automation Solutions'
const EXPECTED_TITLES = [
  DETAILED_TITLE,
  'Robotics Team Lead Engineer',
  'Automation Controls Engineer - Lead',
  'Assistant Manager / Deputy Manager - Sales Engineering (Fixture Business)',
  'Team Lead - Mechanical Design (Industrial Automation)',
  'Trainee / Engineer - Mechanical Design',
  'Engineer - QA Software',
  'Technical Sales Engineer',
  'Engineer - Operations',
  'Fixture & Tooling Design Engineer',
  'Senior Engineer / Lead - Mechanical Design',
  'Senior Fixture Design Engineer',
  'Controls Engineer - Additive Manufacturing',
]

const APPLY_EMAIL = 'Ahalya.k@m2nxt.com'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014\u2212]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main|\/a|\/span|\/strong)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|main|h[1-6]|a|span|strong)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractBlock = (text, startPattern, endPattern) => {
  const start = text.search(startPattern)
  if (start < 0) return null

  const sliceStart = start + text.slice(start).match(startPattern)?.[0].length
  const remainder = text.slice(sliceStart)
  const end = endPattern ? remainder.search(endPattern) : -1

  return normalizeWhitespace(end >= 0 ? remainder.slice(0, end) : remainder)
}

const normalizeLocation = value => normalizeWhitespace(value) || null

const extractTechnicalSkills = (text) => normalizeWhitespace(text)
  ?.split(/\s*(?:;|\||,)\s*/g)
  .map((skill) => normalizeWhitespace(skill))
  .filter(Boolean) || []

const buildGenericJobDescription = (title) => `Open role listed on the verified m2nxt careers page: ${title}.`

const buildDetailedJob = (text) => {
  const block = extractBlock(
    text,
    new RegExp(`${DETAILED_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    new RegExp(EXPECTED_TITLES[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ) || text

  const afterDepartment = extractBlock(block, /Department:/i, /Location:/i)
  const location = normalizeLocation(extractBlock(block, /Location:/i, /Experience:/i))
  const experienceRequired = extractBlock(block, /Experience:/i, /Job Overview:/i)
  const overview = extractBlock(block, /Job Overview:/i, /Qualifications & Skills:/i)
  const qualificationsBlock = extractBlock(block, /Qualifications & Skills:/i, /Interested candidates may drop their CVs at/i)
  const minimumQualification = extractBlock(qualificationsBlock || '', /Education:/i, /Experience:/i)
  const experienceDetails = extractBlock(qualificationsBlock || '', /Experience/i, /Technical Skills/i)
  const technicalSkills = extractTechnicalSkills(extractBlock(qualificationsBlock || '', /Technical Skills/i, null))
  const applyUrl = `mailto:${APPLY_EMAIL}`

  return {
    title: DETAILED_TITLE,
    company: COMPANY,
    department: afterDepartment || null,
    location,
    city: location?.startsWith('Bangalore') ? 'Bangalore' : null,
    country: /\bIndia\b/i.test(location || '') ? 'India' : null,
    jobId: `${SOURCE}-${slugify(DETAILED_TITLE)}`,
    requisitionId: null,
    sourceUrl: CAREERS_URL,
    applyUrl,
    employmentType: null,
    experienceRequired: experienceRequired || experienceDetails || null,
    minimumQualification: minimumQualification || null,
    preferredQualification: null,
    requiredSkills: technicalSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      overview && `Job Overview: ${overview}`,
      minimumQualification && `Education: ${minimumQualification}`,
      experienceDetails && `Experience: ${experienceDetails}`,
      technicalSkills.length > 0 && `Technical Skills: ${technicalSkills.join('; ')}`,
      `Interested candidates may drop their CVs at ${APPLY_EMAIL}.`,
    ].filter(Boolean).join(' '),
    publicExperienceChecked: true,
  }
}

const buildGenericJob = (title) => ({
  title,
  company: COMPANY,
  department: null,
  location: null,
  city: null,
  country: null,
  jobId: `${SOURCE}-${slugify(title)}`,
  requisitionId: null,
  sourceUrl: CAREERS_URL,
  applyUrl: null,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: null,
  publicExperienceChecked: false,
})

export const hasOfficialHomepageSignal = (html) => {
  const text = stripTags(html).toLowerCase()

  return text.includes('m2nxt')
    && text.includes('revolutionize manufacturing with the power of smart factories')
    && text.includes('marketing@m2nxt.com')
    && /href=["']\/careers["']/i.test(String(html ?? ''))
}

export const hasOfficialCareersSignal = (html) => {
  const text = stripTags(html)

  return text.includes('Careers')
    && text.includes(DETAILED_TITLE)
    && text.includes('Job Openings')
    && text.includes(APPLY_EMAIL)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('m2nxt Solutions (P) Ltd verified first-party careers page no longer matches the known public surface')
  }

  const titles=readRoleControls(html),normalizedText=stripTags(html)
  if(titles[0]!==DETAILED_TITLE)throw new Error('m2nxt native initial expanded role identity changed')
  return titles.map((title,index)=>index===0?buildDetailedJob(normalizedText):buildGenericJob(title))
}

const defaultFetchText = async (url,{signal}={}) => {
 const request=new URL(url),surface=CAREERS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('m2nxt native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const body=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return body
}

export const createM2nxtScraper=()=>({
 async run({fetchText=defaultFetchText,now=()=>new Date().toISOString(),signal}={}){
 const homepage=await fetchText(HOMEPAGE_URL,{signal})
 if(!hasOfficialHomepageSignal(homepage))throw Object.assign(Error('m2nxt verified official homepage changed'),{abortRetries:true})
 const html=await fetchText(CAREERS_URL,{signal}),observations=extractPublicJobs(html),clientUrl=advertisedRoleClient(html)
 let jobs=observations
 if(clientUrl){const rows=readLiteralRoles(await fetchText(clientUrl,{signal}),readRoleControls(html),{visibilityStyles:[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n')});jobs=rows.map(row=>({
 ...buildGenericJob(norm(row.title)),department:norm(row.Department)||null,location:norm(row.Location)||null,city:null,country:/\bIndia\b/i.test(row.Location)?'India':null,
 applyUrl:row.applyLink||null,employmentType:norm(row.Employment)||null,experienceRequired:norm(row.experience)||null,jobDescription:row.description,publicExperienceChecked:Boolean(row.experience),
 rawNativeRoleEvidence:{title:row.title,location:row.Location,clientUrl,rawRoleLiteral:row.rawRoleLiteral,knowMoreLink:row.knowMoreLink,visibleControlMatched:true,identityQualified:true}
 }))
 const overview=observations[0].jobDescription.split(' Education:')[0]
 if(!norm(jobs[0].jobDescription).startsWith(norm(overview)))throw Object.assign(Error('m2nxt native expanded description contradicts literal role'),{abortRetries:true})
 if(norm(jobs[0].location)!==norm(observations[0].location))throw Object.assign(Error('m2nxt native expanded workplace contradicts literal role'),{abortRetries:true})
 }
 const result=jobs.map(job=>({...job,source:SOURCE,link:job.applyUrl||job.sourceUrl,scrapedAt:now(),companyCareerPage:CAREERS_URL,companyDomain:'m2nxt.com',atsPlatform:'official-company-careers'}))
 return finishNativeCollection(result,{now,pagesFetched:clientUrl?3:2,observedListingCount:observations.length,descriptionSurface:clientUrl?'advertised-static-JSX-literals-bound-to-visible-role-controls':'expanded-native-html-only',formRoleSelectionQualified:false})
 }
})

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'m2nxt',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async (options = {}) => createM2nxtScraper().run(options)

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
