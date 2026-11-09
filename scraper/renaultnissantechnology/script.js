import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREERS_PAGE_URL = 'https://rntbci.in/careers'
export const JOBS_API_URL = 'https://mc0-portal-api.ope.apps.renault.com/external/externalJobPosting'

const COMPANY_NAME = 'Renault Nissan Technology and Business Centre'
const SOURCE = 'renaultnissantechnology'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#43;/g, '+')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[\u2018\u2019]/g, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripHtml(match[1]))
  .filter(Boolean)

const normalizeTitle = (value) => normalizeWhitespace(value)
  ?.replace(/\s+-\s+/g, ' - ')
  ?.replace(/\s{2,}/g, ' ')
  || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('regular') || normalized.includes('full')) return 'Full-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract') || normalized.includes('temporary')) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeLocation = (location, country) => {
  const normalizedLocation = normalizeWhitespace(location)
  const normalizedCountry = normalizeWhitespace(country)
  if (!normalizedLocation || !normalizedCountry) return null
  return `${normalizedLocation}, ${normalizedCountry}`
}

const extractCity = (location) => normalizeWhitespace(location)

const isIndiaJob = (entry = {}) => normalizeWhitespace(entry.locationCountry)?.toLowerCase() === 'india'

export const hasVerifiedFeedShape = (payload) =>
  normalizeWhitespace(payload?.result) === 'Success'
  && Array.isArray(payload?.data?.Report_Entry)

export const extractSearchResults = (payload) => {
  if (!hasVerifiedFeedShape(payload)) {
    return []
  }

  return payload.data.Report_Entry
    .filter((entry) => isIndiaJob(entry))
    .map((entry) => {
      const title = normalizeTitle(entry.jobPostingTitle)
      const sourceUrl = normalizeWhitespace(entry.jobPostingUrl)
      const location = normalizeLocation(entry.location, entry.locationCountry)
      const jobId = normalizeWhitespace(entry.jobpostingID)
      const requisitionId = normalizeWhitespace(entry.jobRequisitionId)
      const jobDescription = stripHtml(entry.jobPostingDescription)

      if (!title || !sourceUrl || !location || !jobId || !requisitionId) {
        return null
      }

      return {
        title,
        company: COMPANY_NAME,
        department: normalizeWhitespace(entry.jobFamilyGroup),
        location,
        city: extractCity(entry.location),
        country: 'India',
        jobId,
        requisitionId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(entry.contractType),
        experienceRequired: null,
        publicExperienceChecked: Boolean(jobDescription),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractListItems(entry.jobPostingDescription),
        postingDate: normalizeWhitespace(entry.startDate),
        closingDate: null,
        jobDescription,
      }
    })
    .filter(Boolean)
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  fetchImpl: async (...args) => {
    const response = await fetch(...args)
    if (response.status === 400) {
      const payload = await response.clone().json().catch(() => null)
      const message = payload?.errorDetails?.message || ''
      if (payload?.result === 'Error' && /StatusCodeError:\s*503|backend sent ['\"]503['\"] HTTP_STATUS/i.test(message)) {
        const error = new Error('RNTBCI careers upstream returned HTTP 503 Service Unavailable through its HTTP 400 gateway')
        error.abortRetries = true
        throw error
      }
    }
    return response
  },
})

export const createRenaultNissanTechnologyScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchJson = defaultFetchJson,
  } = {}) {
    const payload = await fetchJson(JOBS_API_URL)
    if (!hasVerifiedFeedShape(payload)) {
      throw new Error('RNTBCI careers API no longer returns the verified Report_Entry feed')
    }

    const listings = extractSearchResults(payload)
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings
    const scrapedAt = now()

    return selectedListings.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = (options) => createRenaultNissanTechnologyScraper().run(options)
