import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MINTIFI_CATALOG } from './catalog.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'
import {mapJobsWithInventoryEvidence,attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = MINTIFI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const KEKA_CAREER_PAGE_URL = PROVIDER_METADATA.kekaCareerPageUrl
export const CAREER_PORTAL_INFO_URL = PROVIDER_METADATA.kekaCareerPortalInfoUrl
export const ACTIVE_JOBS_URL = PROVIDER_METADATA.kekaActiveJobsUrl
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedKekaIdentifier
export const EXPECTED_KEKA_DOMAIN = PROVIDER_METADATA.expectedKekaDomain
export const EXPECTED_PORTAL_NAME = PROVIDER_METADATA.expectedPortalName

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const extractIdentifierFromScript = (html) =>
  String(html ?? '').match(/careers\/api\/embedjobs\/js\/([0-9a-f-]+)/i)?.[1] ?? null

export const hasVerifiedCareersPageSignal = (html) =>
  /Mintifi\s*-\s*Careers/i.test(String(html ?? ''))
  && /Browse all jobs/i.test(String(html ?? ''))
  && /mintifi\.keka\.com\/careers/i.test(String(html ?? ''))
  && /careers\/api\/embedjobs\/js\/[0-9a-f-]+/i.test(String(html ?? ''))

export const extractCareerConfig = (html) => {
  const value = String(html ?? '')
  const configBlock = value.match(/(?:window\.\w+\s*=)?\s*\{([\s\S]*?)\}\s*<\/script>/i)?.[1] ?? value
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const identifier = parseQuotedConfigValue(configBlock, 'identifier') || extractIdentifierFromScript(value)

  if (!domain || !identifier) return null

  return {
    identifier,
    domain,
    portalName: 'default',
  }
}

export const buildCareerPortalInfoUrl = ({ domain, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return `${normalizedDomain}api/organization/${portalName}/careerportalinfo`
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const buildApplyUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}applyjob/${jobId}`
}

export const hasExpectedPortalIdentity = (payload) => {
  const normalizedName = normalizeWhitespace(payload?.name)
  const normalizedShortName = normalizeWhitespace(payload?.shortName)
  const normalizedPortalDomain = normalizeWhitespace(payload?.careersPortalDomain)

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
    && normalizedPortalDomain === new URL(EXPECTED_KEKA_DOMAIN).hostname
}

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode || '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName || ''))) return true
  return /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const mapJob = (job, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation) || locations[0] || null
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)

  if (!jobId || !title) return null

  const city = normalizeWhitespace(location?.city) || normalizeWhitespace(location?.name) || null
  const locationLabel = [
    city,
    normalizeWhitespace(location?.state),
    'India',
  ].filter((part, index, values) => part && values.indexOf(part) === index).join(', ') || 'India'
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job?.departmentName),
    location: locationLabel,
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job?.jobType),
    experienceRequired: normalizeWhitespace(job?.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job?.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job?.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job?.description),
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

export const createMintifiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({fetchPage,fetchJson,...options} = {}) {
    if(maxJobs!=null&&(!Number.isSafeInteger(maxJobs)||maxJobs<0))throw Error('Mintifi invalid result limit')
    const jobs=await createVerifiedRecruitmentScraper({source:SOURCE,companyName:COMPANY,
      companyDomain:'mintifi.com',companyCareerPage:CAREERS_URL,officialHomepageUrl:'https://mintifi.com/',
      requireCorporateIdentityMatch:true,requireNativeEmployerName:true,discoverRecruitmentLinks:true,
      allowDeclaredExternalCareersPages:true}).run({now,...options,...(fetchPage?{fetchPage}:{}),
        ...(fetchJson?{fetchJson:async(url,init)=>{
          const result=await fetchJson(url,init)
          if(result?.status!==200||result.url!==url)throw Error('Mintifi native JSON response identity changed')
          return result.json
        }}:{})})
    const selected=maxJobs==null?jobs:jobs.slice(0,maxJobs)
    const projected=mapJobsWithInventoryEvidence(jobs,job=>{
      const row=job.nativeSourceRecord,account=row?.nativeAccount
      if(!account||account.name!=='Mintifi'||account.careersPortalDomain!=='mintifi.keka.com'
        ||String(row.id)!==job.jobId||row.title.trim()!==job.title)throw Error('Mintifi native account or role changed')
      if(!Array.isArray(row.jobLocations)||!row.jobLocations.length||row.jobLocations.some(place=>{
        const code=nativeCountryName(place.countryCode),name=nativeCountryName(place.countryName)
        return !code||!name||code!==name
      }))throw Error('Mintifi native countries are missing or conflicting')
      const places=row.jobLocations.filter(place=>nativeCountryName(place.countryCode)==='India')
      const labels=places.map(place=>[normalizeWhitespace(place.name)||normalizeWhitespace(place.city),
        normalizeWhitespace(place.state),'India'].filter(Boolean).join(', '))
      if(!labels.length)throw Error('Mintifi own native India placement missing')
      const rawPosted=typeof row.publishedOn==='string'?row.publishedOn:null
      const validPosted=rawPosted&&/^(?:19|20)\d{2}-\d{2}-\d{2}T/.test(rawPosted)&&Number.isFinite(Date.parse(rawPosted))
      if(validPosted&&Date.parse(rawPosted)>Date.parse(job.scrapedAt))throw Error('Mintifi native publication is in the future')
      return{...job,location:[...new Set(labels)].join(' / '),locations:[...new Set(labels)],
        city:places.length===1?normalizeWhitespace(places[0].city):null,
        postingDate:validPosted?rawPosted:null,postedAt:validPosted?rawPosted:null,
        sourcePostedDateRaw:rawPosted,sourcePostingDateUnresolved:!validPosted,
        requisitionId:typeof row.jobNumber==='string'?row.jobNumber.trim()||null:null,
        department:normalizeWhitespace(row.departmentName),experienceRequired:normalizeWhitespace(row.experience),
        requiredSkills:Array.isArray(row.skillNames)?[...row.skillNames]:[],
        nativeCountryLocations:structuredClone(row.jobLocations),sourceNativeJobType:row.jobType??null,
        firstEverPublication:null,legalEmployer:null}
    })
    const result=selected.length===jobs.length?projected:attachInventoryEvidence(projected.slice(0,selected.length),{...readInventoryEvidence(projected),
      status:'coverage-gap',listingComplete:false,reason:'Mintifi configured result limit; native source scope remains incomplete'})
    const observations=Object.getOwnPropertyDescriptor(jobs,RECRUITMENT_OBSERVATIONS)
    if(observations)Object.defineProperty(result,RECRUITMENT_OBSERVATIONS,observations)
    return result
  },
})

export const run = async (options = {}) => createMintifiScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
