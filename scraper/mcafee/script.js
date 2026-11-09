import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MCAFEE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const JOIN_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_PAGE_URL = PROVIDER_METADATA.jobsPageUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const SEARCH_RESULTS_URL = PROVIDER_METADATA.searchResultsUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      Referer: JOBS_PAGE_URL,
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  return {
    status: response.status,
    url: response.url,
    json: await response.json(),
  }
}

export const hasJoinShellSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Careers At McAfee')
    && normalized.includes('Join our Talent Community')
    && normalized.includes('See jobs by:')
    && normalized.includes('Categories')
    && normalized.includes('Locations')
}

export const hasNonEnumerableSearchShellSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page.html)
  return Number(page.status) === 404
    && normalized.includes('The page you are looking for no longer exists.')
    && normalized.includes('start your job search')
    && normalized.includes('See jobs by:')
    && normalized.includes('Categories')
    && normalized.includes('Locations')
}

export const hasJobsPageSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('McAfee, LLC Job Search - Jobs')
    && normalized.includes('Not ready to apply? Stay connected with us')
    && normalized.includes('Jobs Log In')
}

export const isIndiaCountryJob = (job = {}) =>
  String(job?.data?.country ?? '').trim().toLowerCase() === 'india'

export const buildJobDetailUrl = (job = {}) => {
  const slug = String(job?.data?.slug ?? '').trim()
  const language = String(job?.data?.language ?? 'en-us').trim() || 'en-us'
  if (!slug) return null
  return `${JOBS_PAGE_URL}/${slug}?lang=${language}`
}

export const normalizeMcAfeeJob = (job = {}) => {
  const data = job?.data ?? {}
  if (!isIndiaCountryJob(job)) return null

  const title = normalizeWhitespace(data.title)
  const jobId = normalizeWhitespace(data.req_id || data.slug)
  const sourceUrl = buildJobDetailUrl(job)
  const applyUrl = normalizeWhitespace(data.apply_url)
  if (!title || !jobId || !sourceUrl || !applyUrl) return null

  const categories = Array.isArray(data.categories)
    ? data.categories.map((category) => normalizeWhitespace(category?.name)).filter(Boolean)
    : []
  const employmentType = normalizeWhitespace(String(data.employment_type || '').replace(/_/g, ' '))
  const city = normalizeWhitespace(data.city)
  const state = normalizeWhitespace(data.state)
  const shortLocation = normalizeWhitespace(data.short_location || data.full_location || data.location_name)
  const location = [city, 'India'].filter(Boolean).join(', ')
    || shortLocation
    || [city, state, 'India'].filter(Boolean).join(', ')
  const responsibilities = normalizeWhitespace(data.responsibilities)
  const description = normalizeWhitespace(data.description)
  const requiredSkills = Array.isArray(data.tags1)
    ? data.tags1.map((tag) => normalizeWhitespace(tag)).filter(Boolean)
    : []

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(data.department) || categories[0] || null,
    location,
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: normalizeWhitespace(data.posted_date),
    closingDate: normalizeWhitespace(data.posting_expiry_date),
    jobDescription: [description, responsibilities].filter(Boolean).join('\n\n') || null,
    remoteStatus: requiredSkills.some((tag) => /remote/i.test(tag)) ? 'Remote' : null,
  }
}

export const hasMcAfeeJobsApiSignal = (payload = {}) => {
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : []
  if (jobs.length === 0) return false

  return jobs.every((job) => isIndiaCountryJob(job) && normalizeMcAfeeJob(job))
}

export const createMcAfeeScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const joinPage = await fetchPage(JOIN_URL)
    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    const searchPage = await fetchPage(SEARCH_RESULTS_URL)
    const jobsApiPage = await fetchJson(`${JOBS_API_URL}?country=India&limit=100`)

    if (joinPage.status !== 200 || !hasJoinShellSignal(joinPage.html)) {
      throw new Error('McAfee join page no longer matches the verified careers shell')
    }

    if (jobsPage.status !== 200 || !hasJobsPageSignal(jobsPage.html)) {
      throw new Error('McAfee jobs page no longer matches the verified public search surface')
    }

    if (!hasNonEnumerableSearchShellSignal(searchPage)) {
      throw new Error('McAfee legacy search shell changed materially')
    }

    if (jobsApiPage.status !== 200 || !hasMcAfeeJobsApiSignal(jobsApiPage.json)) {
      throw new Error('McAfee public jobs API no longer matches the verified India inventory contract')
    }

    return jobsApiPage.json.jobs
      .map((job) => normalizeMcAfeeJob(job))
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createMcAfeeScraper().run(options)

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
