import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NEYSA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NEYSA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_OPENINGS_URL = PROVIDER_METADATA.officialJobOpeningsUrl
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2013\u2014\u2212â€“â€”âˆ’]/g, '-')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|span|button|a)>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(value)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hasExpectedNeysaTitle = (rawHtml, patterns) =>
  patterns.some((pattern) => pattern.test(String(rawHtml ?? '')))

const firstMatch = (source, patterns) => {
  for (const pattern of patterns) {
    const value = stripTags(String(source ?? '').match(pattern)?.[1])
    if (value) return value
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = JOB_OPENINGS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const ensureIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const normalizeExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return normalizeWhitespace(value)
}

const inferRemoteStatus = (...values) => {
  const normalized = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('work from home')) return 'Remote'
  return 'On-site'
}

const extractJobIdFromUrl = (value) => {
  try {
    const url = new URL(value)
    const queryJobId = normalizeWhitespace(url.searchParams.get('job_id'))
    if (queryJobId) return queryJobId

    const pathname = url.pathname.replace(/\/+$/, '')
    return pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const extractLabeledValue = (source, label) => firstMatch(source, [
  new RegExp(`${escapeRegex(label)}\\s*:?\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, 'i'),
  new RegExp(`${escapeRegex(label)}\\s*[:|-]\\s*([^<\\n]+)`, 'i'),
])

const extractDescriptionHtml = (html) =>
  String(html ?? '').match(
    /<h[1-6][^>]*>\s*Job Description\s*<\/h[1-6]>\s*([\s\S]*?)(?:<(?:button|a)[^>]*>\s*Apply Now\s*<\/(?:button|a)>|$)/i,
  )?.[1] || ''

const extractPostingDate = (html) => {
  const rawValue = firstMatch(html, [
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
  ])

  if (!rawValue) return null

  const isoMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
  return isoMatch?.[1] || null
}

const hasJobDetailSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /Job Description/i.test(normalized)
    && /Apply Now/i.test(normalized)
    && (
      /<meta[^>]+property=["']og:title["']/i.test(rawHtml)
      || /<title[^>]*>[\s\S]*?[\u2013-]\s*Neysa<\/title>/i.test(rawHtml)
      || /<h1[^>]*>/i.test(rawHtml)
    )
}

const isGenericDetailTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return true

  return /^(?:Job Openings?|Build a Career at Neysa)$/i.test(normalized)
}

const pickMeaningfulText = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || isGenericDetailTitle(normalized)) continue
    return normalized
  }

  return null
}

const extractSectionSlices = (html) => {
  const rawHtml = String(html ?? '')
  const headingMatches = [...rawHtml.matchAll(
    /<h2[^>]*class="[^"]*\b(?:test|department-title)\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi,
  )]

  return headingMatches.map((match, index) => {
    const start = match.index ?? 0
    const end = headingMatches[index + 1]?.index ?? rawHtml.length
    return {
      department: stripTags(match[1]),
      html: rawHtml.slice(start, end),
    }
  })
}

const extractCardsFromSection = ({ department, html }) => {
  const titleMatches = [...String(html ?? '').matchAll(/<h3[^>]*class="[^"]*\bjob-title\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi)]

  return titleMatches.map((match, index) => {
    const start = match.index ?? 0
    const end = titleMatches[index + 1]?.index ?? String(html ?? '').length
    const cardHtml = String(html ?? '').slice(start, end)
    const detailUrl = toAbsoluteUrl(
      cardHtml.match(/<a[^>]*class="[^"]*\bjob-btn\b[^"]*"[^>]*href="([^"]+)"/i)?.[1]
        || cardHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*\bjob-btn\b[^"]*"/i)?.[1],
    )

    if (!detailUrl) return null

    const location = ensureIndiaLocation(extractLabeledValue(cardHtml, 'Location'))

    return {
      title: stripTags(match[1]),
      department,
      experienceRequired: normalizeExperienceRequired(extractLabeledValue(cardHtml, 'Minimum Experience')),
      location,
      city: extractCity(location),
      detailUrl,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      jobId: extractJobIdFromUrl(detailUrl),
      requisitionId: extractJobIdFromUrl(detailUrl),
    }
  }).filter((listing) => listing?.title && listing?.location)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return hasExpectedNeysaTitle(rawHtml, [
    /<title[^>]*>\s*Careers at Neysa \| Build the Future of AI Infrastructure\s*<\/title>/i,
    /<title[^>]*>\s*Career\s*[\u2013-]\s*Neysa\s*<\/title>/i,
  ])
    && (/Build the Future of AI Infrastructure/i.test(normalized) || /\bCareer\b/i.test(normalized))
    && /View Job Openings/i.test(normalized)
}

export const extractOfficialJobOpeningsUrl = (html) =>
  toAbsoluteUrl(
    String(html ?? '').match(
      /<a[^>]+href=["'](https:\/\/neysa\.ai\/careers\/job-openings\/|\/careers\/job-openings\/)["'][^>]*>\s*View Job Openings\s*<\/a>/i,
    )?.[1],
    CAREERS_PAGE_URL,
  )

export const hasOfficialJobOpeningsSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return hasExpectedNeysaTitle(rawHtml, [
    /<title[^>]*>\s*Job Opening - Build a Career at Neysa\s*<\/title>/i,
    /<title[^>]*>\s*Job Openings?\s*[\u2013-]\s*Neysa\s*<\/title>/i,
  ])
    && /filter_career_listings/i.test(rawHtml)
    && /job-section/i.test(rawHtml)
    && /job-title/i.test(rawHtml)
    && (/Backend Engineer/i.test(normalized) || /Job Details/i.test(normalized))
}

export const extractJobListings = (html) =>
  extractSectionSlices(html)
    .flatMap((section) => extractCardsFromSection(section))
    .filter(Boolean)

const extractApplyUrl = (html, detailUrl) => toAbsoluteUrl(
  String(html ?? '').match(
    /<a[^>]*class="[^"]*\bapply-btn\b[^"]*"[^>]*href="([^"]+)"|<a[^>]*href="([^"]+)"[^>]*class="[^"]*\bapply-btn\b[^"]*"/i,
  )?.slice(1).find(Boolean),
  detailUrl,
)

const extractExperienceRequiredFromDescription = (value) => normalizeExperienceRequired(
  normalizeWhitespace(value)?.match(
    /\bExperience:\s*([^.;]+?(?:years?|yrs?))/i,
  )?.[1],
)

export const extractJobDetail = (html, listing = {}) => {
  const detailUrl = listing.detailUrl || listing.sourceUrl || listing.applyUrl
  const descriptionHtml = extractDescriptionHtml(html)
  const jobDescription = stripTags(descriptionHtml)
  const detailLocation = extractLabeledValue(html, 'Location')
  const title = pickMeaningfulText(
    firstMatch(html, [
      /<h1[^>]*class="[^"]*\bjob-title\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    ]),
    firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)\s*[\u2013-]\s*Neysa<\/title>/i,
    ]),
  ) || listing.title
  const jobId = listing.jobId || extractJobIdFromUrl(detailUrl)

  return {
    title,
    company: COMPANY,
    department: extractLabeledValue(html, 'Department') || listing.department || null,
    location: listing.location || ensureIndiaLocation(detailLocation),
    city: listing.city || extractCity(detailLocation || listing.location),
    country: PROVIDER_METADATA.countryFilter,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    sourceUrl: detailUrl,
    applyUrl: extractApplyUrl(html, detailUrl) || detailUrl,
    employmentType: extractLabeledValue(html, 'Type') || null,
    experienceRequired:
      normalizeExperienceRequired(
        firstMatch(html, [/Experience\s*:\s*([^<\n]+)/i]),
      )
      || extractExperienceRequiredFromDescription(jobDescription)
      || listing.experienceRequired
      || null,
    minimumQualification: extractLabeledValue(html, 'Minimum Qualifications') || null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: extractPostingDate(html),
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(detailLocation, listing.location, jobDescription),
  }
}

export const createNeysaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())

    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Neysa official careers page changed materially')
    }

    const discoveredJobOpeningsUrl = extractOfficialJobOpeningsUrl(careersHtml)
    if (!sameUrl(discoveredJobOpeningsUrl, JOB_OPENINGS_URL)) {
      throw new Error('The verified Neysa careers page no longer links to the expected job openings page')
    }

    const jobOpeningsHtml = await fetchText(JOB_OPENINGS_URL)
    if (!hasOfficialJobOpeningsSignal(jobOpeningsHtml)) {
      throw new Error('The verified Neysa job openings page changed materially')
    }

    const listings = extractJobListings(jobOpeningsHtml)
    if (listings.length === 0) {
      throw new Error('The verified Neysa job openings page no longer exposes parseable public jobs')
    }

    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const scrapedAt = now()
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.detailUrl)
      if (!hasJobDetailSignal(detailHtml)) {
        throw new Error(`Neysa job detail page drifted from the verified surface: ${listing.detailUrl}`)
      }

      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: listing.detailUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createNeysaScraper().run(options)

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
