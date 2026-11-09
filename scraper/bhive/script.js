import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'bhive'
export const COMPANY = 'Bhive'
export const VERIFIED_ON = '2026-07-30'
export const CAREERS_URL = 'https://bhive.careers/jobs/'
export const JOBS_API_URL = 'https://bhive.careers/wp-json/wp/v2/jobs'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PAGE_SIZE = 100
const INDIA_LOCATION_HINTS = [
  'india',
  'bangalore',
  'bengaluru',
  'mumbai',
  'pune',
  'delhi',
  'gurgaon',
  'gurugram',
  'noida',
  'hyderabad',
  'chennai',
  'kolkata',
  'ahmedabad',
  'kochi',
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/â€“|â€”/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/z$|[+-]\d{2}:\d{2}$/i.test(normalized)) return normalized
  return `${normalized}Z`
}

const buildJobsApiUrl = (pageNumber = 1) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('per_page', String(PAGE_SIZE))
  url.searchParams.set('page', String(pageNumber))
  url.searchParams.set('_embed', 'wp:term')
  return url.toString()
}

const extractTaxonomyMap = (posting = {}) => {
  const taxonomyMap = {}
  const groups = Array.isArray(posting?._embedded?.['wp:term'])
    ? posting._embedded['wp:term']
    : []

  for (const group of groups) {
    if (!Array.isArray(group)) continue

    for (const term of group) {
      const taxonomy = normalizeWhitespace(term?.taxonomy)?.toLowerCase()
      const name = normalizeWhitespace(term?.name)
      if (!taxonomy || !name || taxonomyMap[taxonomy]) continue
      taxonomyMap[taxonomy] = name
    }
  }

  return taxonomyMap
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return false

  return INDIA_LOCATION_HINTS.some((hint) => normalized.includes(hint))
}

const extractCity = (value) => normalizeWhitespace(value)?.split(/\s*,\s*/)[0] || null

const mapBhiveJob = (posting = {}, scrapedAt) => {
  const taxonomies = extractTaxonomyMap(posting)
  const title = normalizeWhitespace(posting.title?.rendered)
  const sourceUrl = normalizeUrl(posting.link)
  const jobId = normalizeWhitespace(posting.id)
  const city = extractCity(taxonomies.location)
  const jobDescription = stripTags(posting.content?.rendered)

  if (!title || !sourceUrl || !jobId || !city || !jobDescription) {
    throw new Error('Bhive jobs API no longer exposes the verified public job fields')
  }

  return {
    title,
    company: COMPANY,
    department: taxonomies.department || null,
    location: `${city}, India`,
    city,
    country: 'India',
    link: sourceUrl,
    applyUrl: sourceUrl,
    sourceUrl,
    source: SOURCE,
    jobId,
    requisitionId: jobId,
    employmentType: null,
    experienceRequired: taxonomies.experience || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(posting.date_gmt),
    closingDate: null,
    jobDescription,
    remoteStatus: null,
    scrapedAt,
  }
}

export const hasOfficialJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Jobs\s*-\s*BHIVE Careers\s*<\/title>/i.test(page)
    && text.includes('Explore our all jobs')
    && /BHIVE/i.test(text)
    && /Load More/i.test(text)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createBhiveScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialJobsPageSignal(careersHtml)) {
      throw new Error(
        'Bhive verified first-party jobs page no longer matches the trusted public jobs surface',
      )
    }

    const scrapedAt = now()
    const jobs = []
    let pageNumber = 1

    while (!Number.isFinite(maxJobs) || jobs.length < maxJobs) {
      const payload = await fetchJson(buildJobsApiUrl(pageNumber))
      if (!Array.isArray(payload)) {
        throw new Error('Bhive jobs api no longer returns an array')
      }

      const publishedIndiaJobs = payload.filter((posting) => {
        if (normalizeWhitespace(posting?.status)?.toLowerCase() !== 'publish') return false
        if (normalizeWhitespace(posting?.type)?.toLowerCase() !== 'jobs') return false

        const taxonomies = extractTaxonomyMap(posting)
        return isIndiaLocation(taxonomies.location)
      })

      for (const posting of publishedIndiaJobs) {
        jobs.push(mapBhiveJob(posting, scrapedAt))
        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
      }

      if (payload.length < PAGE_SIZE) break
      pageNumber += 1
    }

    if (jobs.length === 0) {
      throw new Error('Bhive jobs API returned no public India jobs')
    }

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createBhiveScraper(options).run(options)
