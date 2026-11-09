import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://careers.flowserve.com/locations/ind/jobs/'
export const API_ENDPOINT = 'https://prod-search-api.jobsyn.org/api/v1/solr/search'
export const PAGE_SIZE = 15
export const REQUEST_HEADERS = {
  Accept: 'application/json',
  'X-Origin': 'careers.flowserve.com',
  Referer: CAREER_PAGE_URL,
  'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
}

const COMPANY = 'Flowserve'
const SOURCE = 'flowserve'

const slugifySegment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const deriveCity = (location) => String(location || '').split(',')[0]?.trim() || null

const buildJobUrl = (job) => {
  const locationSlug = slugifySegment(job.location_exact)
  const titleSlug = slugifySegment(job.title_slug)
  const guid = String(job.guid || '').trim()

  if (!locationSlug || !titleSlug || !guid) return null
  return `https://careers.flowserve.com/${locationSlug}/${titleSlug}/${guid}/job/`
}

const getRemoteStatus = (job) =>
  Array.isArray(job.on_sites) && job.on_sites.includes(0) ? 'On-site' : null

export const mapFlowserveJob = (job) => {
  const jobUrl = buildJobUrl(job)
  if (!jobUrl) return null

  return {
    title: String(job.title_exact || '').trim() || null,
    company: COMPANY,
    department: String(job.job_category || '').trim() || null,
    location: String(job.location_exact || '').trim() || null,
    city: deriveCity(job.location_exact),
    country: String(job.country_exact || '').trim() || 'India',
    jobId: job.guid || null,
    requisitionId: job.reqid || null,
    sourceUrl: jobUrl,
    applyUrl: jobUrl,
    employmentType: String(job.job_shift || '').trim() || null,
    experienceRequired: String(job.job_type || '').trim() || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: job.date_new || job.date_updated || null,
    closingDate: null,
    jobDescription: job.description || null,
    remoteStatus: getRemoteStatus(job),
  }
}

const defaultFetchJson = (url, options) =>
  fetchJsonWithRetry(url, {
    ...options,
    headers: REQUEST_HEADERS,
    label: SOURCE,
  })

export const createFlowserveScraper = () => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const jobs = []
    let page = 1

    while (true) {
      const url = `${API_ENDPOINT}?page=${page}&location=ind&num_items=${PAGE_SIZE}`
      const payload = await fetchJson(url, { headers: REQUEST_HEADERS })
      const pageJobs = Array.isArray(payload?.jobs) ? payload.jobs : []

      jobs.push(...pageJobs.map(mapFlowserveJob).filter(Boolean))

      if (!payload?.pagination?.has_more_pages || pageJobs.length === 0) break
      page += 1
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createFlowserveScraper().run()
