import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TECHOUTS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const STATE_CODE_TO_NAME = {
  TG: 'Telangana',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})

const normalizeLocation = (jobLocations = []) => {
  const location = Array.isArray(jobLocations) ? jobLocations[0] : null
  const city = normalizeWhitespace(location?.city)
  const state = normalizeWhitespace(location?.state)
  const country = normalizeWhitespace(location?.countryName)

  if (!city || !country) return 'India'
  const stateName = STATE_CODE_TO_NAME[state] || state
  return stateName ? `${city}, ${stateName}, ${country}` : `${city}, ${country}`
}

const buildJobUrl = (jobId) => `https://techouts.keka.com/careers/jobdetails/${jobId}`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('Build your Future with Techouts')
    && /identifier:\s*'3ba5a10f-a9f3-413c-9853-0c55d1e34587'/i.test(page)
    && /domain:\s*'https:\/\/techouts\.keka\.com\/careers\/'/i.test(page)
    && /id="khembedjobs"/i.test(page)
  }

export const extractJobsFromActivePayload = (payload = []) => {
  const jobs = []

  for (const posting of Array.isArray(payload) ? payload : []) {
    const title = normalizeWhitespace(posting?.title)
    const jobId = posting?.id
    if (!title || !jobId) continue

    const sourceUrl = buildJobUrl(jobId)
    jobs.push({
      title,
      company: COMPANY,
      department: normalizeWhitespace(posting?.departmentName) || null,
      location: normalizeLocation(posting?.jobLocations),
      country: 'India',
      sourceUrl,
      applyUrl: sourceUrl,
      link: sourceUrl,
      jobDescription: normalizeWhitespace(posting?.excerpt) || null,
      employmentType: posting?.jobType === 2 ? 'Full-time' : null,
      experienceRequired: normalizeWhitespace(posting?.experience) || null,
      postingDate: normalizeWhitespace(posting?.publishedOn) || null,
      remoteStatus: 'On-site',
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    })
  }

  return jobs
}

export const createTechoutsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Techouts careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobsFromActivePayload(await fetchJson(JOBS_API_URL))
    if (jobs.length === 0) {
      throw new Error('Techouts no longer exposes trusted public Keka jobs')
    }

    return jobs.map((job) => ({
      ...job,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTechoutsScraper(options).run(options)

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
