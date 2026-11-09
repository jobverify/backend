import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { DESI_CREW_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = DESI_CREW_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.careersPageUrl
export const JOBS_ARCHIVE_URL = PROVIDER_METADATA.jobsArchiveUrl
export const SAMPLE_JOB_URL = PROVIDER_METADATA.sampleJobUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const JOBS_API_BASE_URL = null
export const PAGE_SIZE = 100
export const buildJobsApiUrl = () => null
export const JOBS_API_URL = null

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<(?:br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/ul|\/ol|\/strong|\/em|\/a|\/span|\/dl|\/dd|\/dt)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|section|article|main|h[1-6]|ul|ol|strong|em|a|span|dl|dd|dt)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isOfficialDesiCrewUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./i, '').toLowerCase() === 'desicrew.in'
  } catch {
    return false
  }
}

const isOfficialDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./i, '').toLowerCase() === 'desicrew.in'
      && /^\/careers\/[a-z0-9-]+\/$/i.test(url.pathname)
  } catch {
    return false
  }
}

const normalizeTitle = (value) => normalizeWhitespace(value)?.replace(/\s+-\s+/g, ' - ') || null

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (/full[_\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[_\s-]?time/i.test(normalized)) return 'Part-time'
  if (/full[\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[\s-]?time/i.test(normalized)) return 'Part-time'
  if (/contract/i.test(normalized)) return 'Contract'
  if (/intern/i.test(normalized)) return 'Internship'
  if (/permanent/i.test(normalized)) return 'Permanent'
  return normalized
}

const extractExperienceRequired = (contentHtml) => {
  const contentText = stripTags(contentHtml)
  const explicitMatch = contentText.match(/\b((?:\d+\s*(?:to|-)\s*\d+|\d+\+?)\s+years?)\b/i)
  return explicitMatch?.[1] || null
}

const buildJobDescription = (contentHtml, summary) => {
  const contentText = stripTags(contentHtml)
  return normalizeOptionalValue([summary, contentText].filter(Boolean).join(' '))
}

const normalizePostedDate = (value) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const parseLocation = (address = {}) => {
  const city = normalizeOptionalValue(address.addressLocality)
  const state = normalizeOptionalValue(address.addressRegion)
  const countryCode = normalizeOptionalValue(address.addressCountry)
  const country = countryCode === 'IN' ? 'India' : countryCode || 'India'
  const location = normalizeOptionalValue([city, state].filter(Boolean).join(', '))

  return {
    location,
    city,
    state,
    country,
  }
}

const extractJsonLdBlocks = (html) => [...String(html ?? '').matchAll(
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
)]
  .map((match) => match[1].trim())
  .filter(Boolean)
  .flatMap((block) => {
    try {
      const parsed = JSON.parse(block)
      if (Array.isArray(parsed)) return parsed
      return [parsed]
    } catch {
      return []
    }
  })

const findJobPosting = (html) => {
  for (const entry of extractJsonLdBlocks(html)) {
    if (entry?.['@type'] === 'JobPosting') return entry

    if (Array.isArray(entry?.['@graph'])) {
      const jobPosting = entry['@graph'].find((item) => item?.['@type'] === 'JobPosting')
      if (jobPosting) return jobPosting
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(getFinalUrl(page, HOMEPAGE_URL))
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return status === 200
    && finalUrl === normalizeUrl(HOMEPAGE_URL)
    && /<title[^>]*>\s*DesiCrew\s+(?:-|&#8212;|&mdash;|\u2014)\s+Intelligence\.\s*Orchestrated for you\.\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.desicrew\.in\/["']/i.test(rawHtml)
    && normalized.includes('Deployed Intelligence')
    && normalized.includes('Orchestrated for you.')
    && rawHtml.includes('href="/careers/"')
}

export const hasOfficialCareersPageSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(getFinalUrl(page, CAREERS_PAGE_URL))
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hasLegacyBasinApplyForm = rawHtml.includes('id="apply-form"')
    && rawHtml.includes('usebasin.com')
  const hasCurrentInlineApplyForm = rawHtml.includes('id="apply-form"')
    && normalized.includes('What are you applying for?')
    && normalized.includes('Send application')

  return status === 200
    && finalUrl === normalizeUrl(CAREERS_PAGE_URL)
    && /<title[^>]*>\s*Careers at DesiCrew\s*\|\s*Build a career with purpose\.\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.desicrew\.in\/careers\/["']/i.test(rawHtml)
    && normalized.includes('Build a career with purpose.')
    && normalized.includes('Open roles')
    && (hasLegacyBasinApplyForm || hasCurrentInlineApplyForm)
    && /href="\/careers\/[a-z0-9-]+\/"/i.test(rawHtml)
}

export const hasOfficialJobsArchiveSignal = hasOfficialCareersPageSignal

export const hasOfficialJobsApiSignal = (payload) => payload == null

export const hasOfficialJobDetailSignal = (page, sourceUrl) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const rawHtml = String(html ?? '')
  const finalUrl = normalizeUrl(getFinalUrl(page, sourceUrl))
  const jobPosting = findJobPosting(rawHtml)

  return status === 200
    && finalUrl === normalizeUrl(sourceUrl)
    && new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(rawHtml)
    && /<title[^>]*>[\s\S]+?\|\s*DesiCrew\s*<\/title>/i.test(rawHtml)
    && rawHtml.includes('Apply for this role')
    && jobPosting?.['@type'] === 'JobPosting'
    && isOfficialDesiCrewUrl(jobPosting?.url)
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const parseRoleSummary = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) {
    return {
      department: null,
      summaryLocation: null,
    }
  }

  const [department, summaryLocation] = normalized.split(/\s+·\s+/)
  return {
    department: normalizeOptionalValue(department),
    summaryLocation: normalizeOptionalValue(summaryLocation),
  }
}

export const extractArchiveListings = (html) => {
  const listings = []
  const rolesSectionMatch = String(html ?? '').match(
    /<section id="roles"[\s\S]*?<\/section>/i,
  )
  const rolesSection = rolesSectionMatch?.[0] || String(html ?? '')

  for (const match of rolesSection.matchAll(
    /<a href="(\/careers\/[a-z0-9-]+\/)"[\s\S]*?<p class="text-h6[^"]*">([\s\S]*?)<\/p>\s*<p class="text-body-small[^"]*">([\s\S]*?)<\/p>/gi,
  )) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = normalizeTitle(match[2])
    const { department, summaryLocation } = parseRoleSummary(match[3])
    const slug = normalizeOptionalValue(match[1].split('/').filter(Boolean).at(-1))

    if (!slug || !sourceUrl || !title || !isOfficialDetailUrl(sourceUrl)) {
      continue
    }

    listings.push({
      jobId: slug,
      title,
      department,
      sourceUrl,
      summaryLocation,
    })
  }

  if (listings.length === 0) {
    throw new Error('Desi Crew verified careers listing no longer matches the trusted public surface')
  }

  return listings
}

const extractJobPostingFields = (detailHtml) => {
  const jobPosting = findJobPosting(detailHtml)
  if (!jobPosting) {
    throw new Error('Desi Crew verified job detail no longer exposes the trusted JobPosting metadata')
  }

  return jobPosting
}

export const buildJobFromListingAndApiRecord = (listing = {}, record = {}) => {
  if (!listing?.jobId || !listing?.sourceUrl || !isOfficialDetailUrl(listing.sourceUrl)) {
    throw new Error('Desi Crew verified careers listing entry is incomplete')
  }

  if (!record || typeof record !== 'object') {
    throw new Error('Desi Crew verified job detail metadata no longer matches the listing surface')
  }

  const descriptionHtml = String(record.description ?? '')
  const summary = normalizeOptionalValue(record.description && stripTags(record.description).split('. ').at(0))
  const locationBits = parseLocation(record.jobLocation?.address)
  const employmentType = Array.isArray(record.employmentType)
    ? normalizeEmploymentType(record.employmentType.join(', '))
    : normalizeEmploymentType(record.employmentType)
  const applyUrl = `${normalizeUrl(CAREERS_PAGE_URL)}/#apply`.replace('//#', '/#')

  return {
    title: normalizeTitle(listing.title || record.title),
    company: COMPANY_NAME,
    department: listing.department || null,
    location: locationBits.location || listing.summaryLocation || null,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    jobId: String(listing.jobId),
    requisitionId: String(listing.jobId),
    sourceUrl: listing.sourceUrl,
    applyUrl,
    employmentType,
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizePostedDate(record.datePosted),
    closingDate: null,
    jobDescription: buildJobDescription(descriptionHtml, summary),
  }
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Desi Crew scraper')
  }

  return parsed.toISOString()
}

export const createDesiCrewScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage

    const homepagePage = await fetchPage(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepagePage)) {
      throw new Error('Desi Crew verified homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPage)) {
      throw new Error('Desi Crew verified careers page no longer matches the trusted first-party surface')
    }

    const listings = extractArchiveListings(careersPage.html)
    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    const selectedListings = limit ? listings.slice(0, limit) : listings
    const scrapedAt = normalizeScrapedAt((options.now || now)())
    const jobs = []

    for (const listing of selectedListings) {
      const detailPage = await fetchPage(listing.sourceUrl)
      if (!hasOfficialJobDetailSignal(detailPage, listing.sourceUrl)) {
        throw new Error(`Desi Crew verified detail page no longer matches the trusted apply surface: ${listing.sourceUrl}`)
      }

      const detailRecord = extractJobPostingFields(detailPage.html)
      const job = buildJobFromListingAndApiRecord(listing, detailRecord)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createDesiCrewScraper().run(options)

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
