import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'iexceed'
export const COMPANY = 'i-exceed technology solutions'
export const CAREERS_PAGE_URL = 'https://www.i-exceed.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const INDIA_LOCATION_MAP = new Map([
  ['bangalore', { location: 'Bangalore, India', city: 'Bangalore' }],
  ['bengaluru', { location: 'Bengaluru, India', city: 'Bengaluru' }],
  ['ncr', { location: 'NCR, India', city: 'NCR' }],
  ['noida', { location: 'Noida, India', city: 'Noida' }],
  ['gurgaon', { location: 'Gurgaon, India', city: 'Gurgaon' }],
  ['gurugram', { location: 'Gurugram, India', city: 'Gurugram' }],
  ['delhi', { location: 'Delhi, India', city: 'Delhi' }],
  ['hyderabad', { location: 'Hyderabad, India', city: 'Hyderabad' }],
  ['chennai', { location: 'Chennai, India', city: 'Chennai' }],
  ['pune', { location: 'Pune, India', city: 'Pune' }],
  ['mumbai', { location: 'Mumbai, India', city: 'Mumbai' }],
  ['india', { location: 'India', city: null }],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2013\u2014]/g, '–')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value).replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const unique = (items) => [...new Set(items.filter(Boolean))]

const parseJsonLdDate = (html) => {
  const date = extractFirst(/"datePublished"\s*:\s*"([^"]+)"/i, html)
  if (!date) return null
  return normalizeWhitespace(date)?.slice(0, 10) || null
}

const extractMetaDescription = (html) => normalizeWhitespace(
  extractFirst(/<meta[^>]+name="description"[^>]+content="([\s\S]*?)"[^>]*>/i, html),
)

const normalizeLocationTerms = (terms = []) => {
  const mapped = []

  for (const term of terms) {
    const normalized = normalizeWhitespace(term)?.toLowerCase()
    if (!normalized) continue

    const location = INDIA_LOCATION_MAP.get(normalized)
    if (location) mapped.push(location)
  }

  const uniqueLocations = unique(mapped.map((item) => item.location))
  const firstCity = mapped.find((item) => item.city)?.city || null

  return {
    location: uniqueLocations.join('; ') || null,
    city: firstCity,
    country: uniqueLocations.length > 0 ? 'India' : null,
  }
}

export const buildSearchUrl = () => CAREERS_PAGE_URL

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Careers\s*-\s*i-exceed technology solutions\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /awsm-job-wrap/i.test(page)
    && /All Role/i.test(page)
    && /More Details/i.test(page)
}

export const isIndiaLocation = (terms = []) => normalizeLocationTerms(terms).country === 'India'

const extractSpecificationTerms = (html, className) => {
  const section = extractFirst(
    new RegExp(`<div class="awsm-job-specification-item ${className}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
    html,
  )

  if (!section) return []

  return unique([
    ...String(section).matchAll(/<span class="awsm-job-specification-term">([\s\S]*?)<\/span>/gi),
  ].map((match) => stripTags(match[1])))
}

export const extractSearchResults = (html) => {
  const jobs = []
  const cards = [
    ...String(html ?? '').matchAll(
      /<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-(\d+)">([\s\S]*?)<\/div>\s*<\/a>\s*<\/div>/gi,
    ),
  ]

  for (const cardMatch of cards) {
    const jobId = normalizeWhitespace(cardMatch[1])
    const cardHtml = cardMatch[2]
    const sourceUrl = buildAbsoluteUrl(extractFirst(/<a href="([^"]+)" class="awsm-job-item">/i, cardHtml))
    const title = stripTags(extractFirst(/<h2 class="awsm-job-post-title">([\s\S]*?)<\/h2>/i, cardHtml))
    const departmentTerms = extractSpecificationTerms(cardHtml, 'awsm-job-specification-job-category')
    const requiredSkills = extractSpecificationTerms(cardHtml, 'awsm-job-specification-job-type')
    const locationTerms = extractSpecificationTerms(cardHtml, 'awsm-job-specification-job-location')
    const normalizedLocation = normalizeLocationTerms(locationTerms)

    if (!title || !jobId || !sourceUrl || !normalizedLocation.country) continue

    jobs.push({
      title,
      company: COMPANY,
      department: departmentTerms[0] || null,
      location: normalizedLocation.location,
      city: normalizedLocation.city,
      country: normalizedLocation.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: requiredSkills.length > 0 ? requiredSkills.join(', ') : null,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing) => {
  const description = extractMetaDescription(html) || listing.jobDescription

  return {
    ...listing,
    postingDate: parseJsonLdDate(html) || listing.postingDate,
    closingDate: null,
    jobDescription: description,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIExceedScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(buildSearchUrl())

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Official i-exceed careers page no longer matches the verified public listings surface')
    }

    const listings = extractSearchResults(careersHtml)
    const jobs = await Promise.all(
      listings.map(async (listing) => {
        const detailHtml = await fetchText(listing.sourceUrl)
        return extractJobDetail(detailHtml, listing)
      }),
    )

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createIExceedScraper().run(options)
