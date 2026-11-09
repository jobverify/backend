import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SYSTECH_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SYSTECH_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_LIST_API_URL = PROVIDER_METADATA.embeddedJobsListApiUrl
export const JOBS_DETAIL_API_URL = PROVIDER_METADATA.embeddedJobsDetailApiUrl
export const US_OPENINGS_URL = PROVIDER_METADATA.usOpeningsPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
  },
  label: `${SOURCE}-jobs-api`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers at Systech – Data, AI & Analytics Roles – Systech Solutions')
    && normalized.includes('Open positions & life at Systech')
    && normalized.includes('See open roles')
    && normalized.includes('US Job Openings')
    && normalized.includes('Chennai, India')
  }

export const extractEmbeddedJobsListApiUrl = (html = '') =>
  String(html ?? '').match(/https:\/\/prod-171\.westus\.logic\.azure\.com:[^"']+/i)?.[0] ?? null

export const extractEmbeddedJobsDetailApiUrl = (html = '') =>
  String(html ?? '').match(/https:\/\/prod-125\.westus\.logic\.azure\.com:[^"']+/i)?.[0] ?? null

export const extractIndiaJobs = (payload = []) => (Array.isArray(payload) ? payload : [])
  .map((job) => {
    const title = normalizeWhitespace(job?.cr21b_jobname)
    const jobId = normalizeWhitespace(job?.cr21b_jobid)
    if (!title || !jobId) return null
    const jobUrl = new URL(CAREERS_URL)
    jobUrl.searchParams.set('jobId', jobId)
    jobUrl.hash = 'open-positions'

    return {
      title,
      company: COMPANY,
      department: null,
      // The public list does not identify a work location. Office addresses
      // elsewhere on the careers page are not evidence about this role.
      location: null,
      city: null,
      country: null,
      jobId,
      requisitionId: jobId,
      sourceUrl: jobUrl.href,
      applyUrl: jobUrl.href,
      employmentType: null,
      experienceRequired: normalizeWhitespace(job?.['cr21b_minyearsofexperience@OData.Community.Display.V1.FormattedValue']),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }
  })
  .filter(Boolean)

export const createSystechSolutionsScraper = ({
  signal: defaultSignal,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run({ signal = defaultSignal } = {}) {
    const request = async (fetcher, url, options = {}) => {
      signal?.throwIfAborted()
      try { return await fetcher(url, { ...options, signal }) }
      finally { signal?.throwIfAborted() }
    }
    const careersHtml = await request(fetchText, CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Systech Solutions verified first-party careers page no longer matches the trusted surface')
    }

    const listApiUrl = extractEmbeddedJobsListApiUrl(careersHtml)
    if (listApiUrl !== JOBS_LIST_API_URL) {
      throw new Error('Systech Solutions verified embedded jobs list API changed; refusing to guess the public jobs source')
    }

    const detailApiUrl = extractEmbeddedJobsDetailApiUrl(careersHtml)
    if (detailApiUrl !== JOBS_DETAIL_API_URL) {
      throw new Error('Systech Solutions verified embedded jobs detail API changed; refusing to guess the public jobs source')
    }

    const jobs = await request(fetchJson, JOBS_LIST_API_URL)
    if (!Array.isArray(jobs)) {
      throw new Error('Systech Solutions embedded jobs API no longer returns the verified array payload')
    }

    const parsedJobs = extractIndiaJobs(jobs)
    if (parsedJobs.length !== jobs.length || new Set(parsedJobs.map((job) => job.jobId)).size !== parsedJobs.length) {
      throw new Error('Systech Solutions incomplete structured jobs payload; refusing to publish a partial snapshot')
    }

    const scrapedAt = new Date().toISOString()
    return parsedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createSystechSolutionsScraper(options).run()

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
