import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'knolskape'
export const COMPANY = 'Knolskape'
export const CAREERS_URL = 'https://knolskape.com/careers/'
export const KEKA_CAREERS_URL = 'https://knolskape.keka.com/careers/'
export const KEKA_PORTAL_INFO_URL = 'https://knolskape.keka.com/careers/api/organization/default/careerportalinfo'
export const KEKA_ACTIVE_JOBS_API_URL = 'https://knolskape.keka.com/careers/api/jobs/default/active'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const isIndiaLocation = (location = {}) => (
  String(location.countryCode ?? '').toUpperCase() === 'IN'
  || /india/i.test(String(location.countryName ?? ''))
  || /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
)

const buildKekaUrl = (pathName, jobId) => (
  jobId ? new URL(`${pathName}/${encodeURIComponent(jobId)}`, KEKA_CAREERS_URL).toString() : null
)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Create\.\s*Learn\.\s*Grow\./i.test(page)
    && /Explore Job Opportunities/i.test(page)
    && /knolskape\.keka\.com\/careers\/(?:jobdetails|applyjob)\//i.test(page)
}

export const hasExpectedPortalIdentity = (payload = {}) => {
  const name = normalizeWhitespace(payload.name)?.toUpperCase()
  const shortName = normalizeWhitespace(payload.shortName)?.toUpperCase()
  const domain = String(payload.careersPortalDomain ?? '').trim().toLowerCase()

  return name === 'KNOLSKAPE'
    && shortName === 'KNOLSKAPE'
    && domain === 'knolskape.keka.com'
}

const mapJob = (job = {}) => {
  const location = (Array.isArray(job.jobLocations) ? job.jobLocations : []).find(isIndiaLocation)
  const jobId = normalizeWhitespace(job.id)
  const title = normalizeWhitespace(job.title)
  if (!location || !jobId || !title) return null

  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: [city, state, 'India'].filter(Boolean).join(', '),
    city,
    state,
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
    sourceUrl: buildKekaUrl('jobdetails', jobId),
    applyUrl: buildKekaUrl('applyjob', jobId),
    employmentType: job.jobType === 2 || job.jobType === '2' ? 'Full Time' : null,
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map(normalizeWhitespace).filter(Boolean)
      : [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description || job.excerpt),
  }
}

export const extractSearchResults = (payload = []) => (
  Array.isArray(payload) ? payload : []
).map(mapJob).filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json,text/plain,*/*', Referer: KEKA_CAREERS_URL },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createKnolskapeScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Knolskape verified careers page no longer matches the trusted first-party surface')
    }

    const portalInfo = await fetchJson(KEKA_PORTAL_INFO_URL)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('Knolskape verified Keka surface no longer matches the exact company identity')
    }

    return extractSearchResults(await fetchJson(KEKA_ACTIVE_JOBS_API_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'knolskape.com',
      atsPlatform: 'keka-official-company-branded-careers',
    }))
  },
})

export const run = async (options = {}) => createKnolskapeScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/knolskape/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
