import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'housr'
export const COMPANY = 'Housr'
export const VERIFIED_ON = '2026-07-30'
export const CAREERS_URL = 'https://housr.in/career'
export const DISPOSITION = 'verified-first-party-careers-page-plus-same-origin-detail-pages'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 30, 2026 that https://housr.in/career was the live first-party Housr careers page, that it publicly listed 9 same-origin openings under /career/{jobId}, and that detail pages such as https://housr.in/career/4 exposed trustworthy job descriptions plus Apply with LinkedIn handoffs for current India roles including Assistant Resident Manager/Resident Manager (Bangalore & Pune). This scraper validates the verified Housr careers shell and same-origin detail payloads, then returns the current India jobs from the official public surface.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const CAREERS_PAGE_PATTERNS = [
  /<title[^>]*>\s*Shape the Future of Luxury CoLiving At Housr\s*<\/title>/i,
  /\bShape the Future of Luxury Living\b/i,
  /\bExplore Roles at Housr\b/i,
  /\bDirectly reach out to us\b/i,
  /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>/i,
]

const DETAIL_PAGE_PATTERNS = [
  /<title[^>]*>[\s\S]*?\s+-\s+Housr\s*<\/title>/i,
  /\bFill this Form\b/i,
  /\bApply with LinkedIn\b/i,
  /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>/i,
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
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const buildDetailUrl = (jobId) => toAbsoluteUrl(`/career/${jobId}`, CAREERS_URL)

const extractNextDataPayload = (html = '') => {
  const match = String(html).match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )

  if (!match) {
    throw new Error('Housr verified public surface no longer exposes __NEXT_DATA__')
  }

  try {
    return JSON.parse(match[1])
  } catch (error) {
    throw new Error(`Unable to parse Housr __NEXT_DATA__ payload: ${error.message}`)
  }
}

const getPageProps = (payload) => payload?.props?.pageProps ?? payload?.pageProps ?? null

const normalizeTitleKey = (value) =>
  normalizeWhitespace(value)
    ?.replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase() || ''

const titlesMatch = (left, right) => {
  const leftKey = normalizeTitleKey(left)
  const rightKey = normalizeTitleKey(right)
  return Boolean(leftKey && rightKey && leftKey === rightKey)
}

const extractListingPayload = (html = '') => {
  const payload = extractNextDataPayload(html)
  const data = getPageProps(payload)?.response?.data
  return Array.isArray(data) ? data : []
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  if (!CAREERS_PAGE_PATTERNS.every((pattern) => pattern.test(page))) return false

  try {
    return extractListingPayload(page).length > 0
  } catch {
    return false
  }
}

export const hasOfficialDetailPageSignal = (html = '') => {
  const page = String(html ?? '')
  if (!DETAIL_PAGE_PATTERNS.every((pattern) => pattern.test(page))) return false

  try {
    return Boolean(getPageProps(extractNextDataPayload(page))?.response?.data)
  } catch {
    return false
  }
}

export const extractListingCards = (html = '', baseUrl = CAREERS_URL) => {
  const matches = String(html).matchAll(
    /<a href="([^"]*\/career\/\d+)">[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<div class="hire_viewPhone__cwjtf">[\s\S]*?<p>[\s\S]*?<\/span>([^<]+)<\/p>[\s\S]*?<p>[\s\S]*?<\/span>([^<]+)<\/p>/gi,
  )

  return [...matches]
    .map((match) => {
      const detailUrl = toAbsoluteUrl(match[1], baseUrl)
      const title = stripTags(match[2])
      const location = stripTags(match[3])
      const employmentType = stripTags(match[4])

      if (!detailUrl || !title || !location || !employmentType) return null

      return {
        title,
        detailUrl,
        location,
        employmentType,
      }
    })
    .filter(Boolean)
}

export const extractDetailPayload = (html = '') =>
  getPageProps(extractNextDataPayload(html))?.response?.data ?? null

const extractJobId = (detailUrl) => {
  try {
    return new URL(detailUrl).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const extractExperienceRequired = (value) =>
  normalizeWhitespace(value)?.match(/\b(\d+\s*(?:-\s*\d+)?\s*years?)\b/i)?.[1] || null

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s*,\s*/)[0] || null

const mapJob = ({
  listing,
  detail,
  embedded,
}) => {
  const sourceUrl = listing.detailUrl
  const jobId = extractJobId(sourceUrl)
  const title = normalizeWhitespace(detail?.job_name)
  const listingTitle = normalizeWhitespace(listing.title)
  const listingLocation = normalizeWhitespace(listing.location)
  const detailLocation = normalizeWhitespace(detail?.job_location)
  const employmentType = normalizeWhitespace(listing.employmentType)

  if (!jobId || !title || !listingTitle || !titlesMatch(title, listingTitle)) return null
  if (!listingLocation || !detailLocation || !titlesMatch(detailLocation, listingLocation)) return null
  if (!employmentType) return null

  const embeddedTitle = normalizeWhitespace(embedded?.job_name)
  const embeddedLocation = normalizeWhitespace(embedded?.job_location)

  if (
    (embeddedTitle && !titlesMatch(embeddedTitle, title))
    || (embeddedLocation && !titlesMatch(embeddedLocation, listingLocation))
  ) {
    return null
  }

  const applyUrl = toAbsoluteUrl(detail?.linkedin_url) || sourceUrl

  return {
    title,
    company: COMPANY,
    department: null,
    location: listingLocation,
    city: extractCity(listingLocation),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType,
    experienceRequired: extractExperienceRequired(detail?.expertise_required),
    minimumQualification: normalizeWhitespace(detail?.expertise_required),
    preferredQualification: normalizeWhitespace(detail?.what_to_expect),
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(detail?.job_description),
    remoteStatus: null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const createHousrScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Housr verified official careers page changed materially')
    }

    const listings = extractListingCards(careersHtml, CAREERS_URL)
    if (listings.length === 0) {
      throw new Error('Housr careers page no longer exposes the verified public listing cards')
    }

    const embeddedListings = extractListingPayload(careersHtml)
    const embeddedById = new Map(
      embeddedListings
        .map((listing) => {
          const jobId = normalizeWhitespace(listing?.job_id)
          return jobId ? [jobId, listing] : null
        })
        .filter(Boolean),
    )

    const jobs = []
    const seenJobIds = new Set()
    const scrapedAt = now()

    for (const listing of listings) {
      if (Number.isInteger(maxJobs) && jobs.length >= maxJobs) break

      const jobId = extractJobId(listing.detailUrl)
      if (!jobId || seenJobIds.has(jobId)) continue

      const detailHtml = await fetchText(listing.detailUrl)
      if (!hasOfficialDetailPageSignal(detailHtml)) {
        throw new Error('Housr verified detail page changed materially')
      }

      const detail = extractDetailPayload(detailHtml)
      const job = mapJob({
        listing,
        detail,
        embedded: embeddedById.get(jobId) || null,
      })

      if (!job) continue

      seenJobIds.add(jobId)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      })
    }

    if (jobs.length === 0) {
      throw new Error('Housr careers page returned no public India jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createHousrScraper(options).run(options)
