import { createDarwinboxScraper } from '../darwinbox/script.js'

export const COMPANY_NAME = 'LeadSquared'
export const SOURCE = 'leadsquared'
export const COMPANY_ID = 'main'
export const DARWINBOX_ORIGIN = 'https://leadsquaredhrms.darwinbox.in'
export const OFFICIAL_CAREERS_URL = 'https://www.leadsquared.com/careers/'
export const PUBLIC_PORTAL_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/home`
export const ALL_JOBS_ENDPOINT = 'job/alljobs'
export const JOB_COUNT_ENDPOINT = 'candidate/job/count'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')

const normalizeText = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeLocations = (record = {}) => {
  const explicitLocation = normalizeText(record.locations)

  if (explicitLocation && !/^multiple locations$/i.test(explicitLocation)) {
    return explicitLocation
  }

  const locationList = [
    record.officelocation_show_arr_list,
    record.tool_tip_locations,
    record.officelocations_area,
  ].find(Array.isArray) || []

  const normalizedLocations = [...new Set(
    locationList
      .map((location) => normalizeText(location))
      .filter(Boolean),
  )]

  if (normalizedLocations.length > 0) {
    return normalizedLocations.join(' | ')
  }

  return explicitLocation
}

const extractCity = (location) => {
  const normalizedLocation = normalizeText(location)

  if (!normalizedLocation) return null
  if (/remote/i.test(normalizedLocation)) return 'Remote'

  const firstLocation = normalizedLocation
    .split('|')
    .map((part) => part.trim())
    .find(Boolean) || normalizedLocation

  const [city] = firstLocation
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return city || firstLocation
}

const isIndiaRecord = (record = {}) => {
  const country = normalizeText(record.country)
  const location = normalizeLocations(record)

  return /india/i.test(country || '') || /india/i.test(location || '')
}

export const createLeadSquaredScraper = ({
  now = () => new Date().toISOString(),
  pageSize = 20,
  darwinboxScraper = createDarwinboxScraper({
    companyName: COMPANY_NAME,
    source: SOURCE,
    companyId: COMPANY_ID,
    pageSize,
    origin: DARWINBOX_ORIGIN,
  }),
} = {}) => {
  const buildListingApiUrl = () =>
    `${DARWINBOX_ORIGIN}/ms/candidateapi/${ALL_JOBS_ENDPOINT}?companyId=${COMPANY_ID}`

  const buildJobCountApiUrl = () =>
    `${DARWINBOX_ORIGIN}/ms/candidateapi/${JOB_COUNT_ENDPOINT}`

  const buildJobDetailUrl = (jobId) =>
    `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/jobDetails/${normalizeText(jobId) || ''}`

  const transformLeadSquaredJob = (record = {}) => {
    if (!isIndiaRecord(record)) return null

    const jobId = normalizeText(record.id)
    const location = normalizeLocations(record)

    if (!jobId || !location) return null

    return {
      title: normalizeText(record.title) || normalizeText(record.designation_display_name),
      company: COMPANY_NAME,
      department: normalizeText(record.department_name),
      location,
      city: extractCity(location),
      jobId,
      requisitionId: normalizeText(record.reqid) || null,
      sourceUrl: buildJobDetailUrl(jobId),
      applyUrl: buildJobDetailUrl(jobId),
      employmentType: normalizeText(record.emp_type_name),
      experienceRequired: normalizeText(record.experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeText(record.posted_on),
      closingDate: null,
      jobDescription: normalizeText(record.jd),
    }
  }

  const extractSearchResults = (payload = {}) =>
    Array.isArray(payload?.data)
      ? payload.data
        .map((record) => transformLeadSquaredJob(record))
        .filter(Boolean)
      : []

  const run = async ({
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
    fetchListingPage: customFetchListingPage,
  } = {}) => {
    if (!customFetchListingPage) {
      return darwinboxScraper.run({ maxPages, maxJobs })
    }

    const jobs = []
    let page = 1

    while (page <= maxPages) {
      const payload = await customFetchListingPage({
        page,
        pageSize,
        companyId: COMPANY_ID,
      })

      const results = extractSearchResults(payload)

      for (const job of results) {
        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      const totalJobCount = Number.parseInt(String(payload?.job_counts ?? ''), 10)
      const hasMore = Number.isFinite(totalJobCount)
        ? page * pageSize < totalJobCount
        : Array.isArray(payload?.data) && payload.data.length === pageSize

      if (!hasMore) break
      page += 1
    }

    return jobs
  }

  return {
    buildListingApiUrl,
    buildJobCountApiUrl,
    buildJobDetailUrl,
    extractSearchResults,
    transformLeadSquaredJob,
    run,
  }
}

const scraper = createLeadSquaredScraper()

export const {
  buildListingApiUrl,
  buildJobCountApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const transformLeadSquaredJob = scraper.transformLeadSquaredJob
