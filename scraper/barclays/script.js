import path from 'path'
import { fileURLToPath } from 'url'

const BASE_URL = 'https://search.jobs.barclays'
const CAREER_PAGE_URL = `${BASE_URL}/search-jobs/india`
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const FETCH_TIMEOUT_MS = 15000
const EXPERIENCE_CONTEXT_PATTERN = String.raw`(?:\s+of\s+(?:[a-z0-9+/,&().-]+\s+){0,8}?experience|\s+(?:[a-z0-9+/,&().-]+\s+){0,8}?experience|\s+experience)`

const createFetchTimeoutSignal = (timeoutMs = FETCH_TIMEOUT_MS) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value || '').replace(/<[^>]+>/g, ' '))

const extractFirst = (pattern, value) => {
  const match = String(value || '').match(pattern)
  return match ? match[1] : null
}

const toAbsoluteUrl = (value) => {
  const normalized = decodeHtmlEntities(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractLocationCity = (location) => {
  const firstSegment = normalizeWhitespace(String(location || '').split(';')[0] || '')
  return firstSegment.split(',')[0]?.trim() || null
}

const normalizeEmploymentType = (employmentType, workHours) => {
  const summary = `${normalizeWhitespace(employmentType)} ${normalizeWhitespace(workHours)}`.toLowerCase()
  if (summary.includes('full time') || summary.includes('permanent')) return 'Full-time'
  if (summary.includes('part time')) return null
  if (summary.includes('contract')) return 'Contract'
  return null
}

const normalizeIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null

  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const extractJsonLd = (html) => {
  const script = extractFirst(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
    html,
  )
  if (!script) return null

  try {
    return JSON.parse(script)
  } catch {
    return null
  }
}

const extractDescriptionHtml = (html, jsonLd) => (
  jsonLd?.description
  || extractFirst(/<div class="ats-description[\s\S]*?">([\s\S]*?)<\/div>\s*<\/section>/i, html)
  || ''
)

const htmlToText = (html) => stripTags(
  String(html || '')
    .replace(/<\/li>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' '),
)

const extractRequiredSkills = (descriptionHtml) => {
  const skills = []
  let capture = false

  for (const match of String(descriptionHtml || '').matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = stripTags(match[2])
    if (!text) continue

    if (/^Essential skills \/ Basic qualifications:/i.test(text)) {
      capture = true
      continue
    }

    if (/^(Desirable skills|You may be assessed|Purpose of the role|Accountabilities|Vice President Expectations)/i.test(text)) {
      capture = false
    }

    if (capture && match[1].toLowerCase() === 'li') {
      skills.push(text)
    }
  }

  return [...new Set(skills)]
}

const formatExperienceYears = (minimum, maximum = null, suffix = '') => {
  if (!minimum) return null
  if (maximum) return `${minimum}-${maximum} years`
  return `${minimum}${suffix} years`
}

const extractExperienceRequired = (jobDescription) => {
  const text = normalizeWhitespace(jobDescription)
  if (!text) return null

  const rangeMatch = text.match(new RegExp(`(?:at\\s+least\\s+|minimum\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:-|to)\\s*(\\d+(?:\\.\\d+)?)\\s+years?${EXPERIENCE_CONTEXT_PATTERN}`, 'i'))
  if (rangeMatch) {
    return formatExperienceYears(rangeMatch[1], rangeMatch[2])
  }

  const plusMatch = text.match(new RegExp(`(?:at\\s+least\\s+|minimum\\s+)?(\\d+(?:\\.\\d+)?)\\+\\s+years?${EXPERIENCE_CONTEXT_PATTERN}`, 'i'))
  if (plusMatch) {
    return formatExperienceYears(plusMatch[1], null, '+')
  }

  const singleMatch = text.match(new RegExp(`(?:at\\s+least\\s+|minimum\\s+)?(\\d+(?:\\.\\d+)?)\\s+years?${EXPERIENCE_CONTEXT_PATTERN}`, 'i'))
  if (singleMatch) {
    return formatExperienceYears(singleMatch[1])
  }

  return null
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage === 1) return CAREER_PAGE_URL
  return `${CAREER_PAGE_URL}&p=${normalizedPage}`
}

export const extractSearchResults = (html) => {
  const section = extractFirst(/<section id="search-results-list">([\s\S]*?)<\/section>/i, html)
  if (!section) return []

  return [...section.matchAll(
    /<a[^>]+href="([^"]+)"[^>]+class="headline-3 job-title--link text--black"[^>]+data-job-id="([^"]+)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/a>[\s\S]*?<div class="job-location">([\s\S]*?)<\/div>/gi,
  )]
    .map((match) => {
      const location = stripTags(match[4])
      if (!/india/i.test(location)) return null

      const sourceUrl = toAbsoluteUrl(match[1])
      const jobId = normalizeWhitespace(match[2])
      const title = normalizeWhitespace(match[3])
      if (!sourceUrl || !jobId || !title) return null

      return {
        title,
        company: 'Barclays',
        department: null,
        location,
        city: extractLocationCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: 'Full-time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
}

export const extractPaginationSummary = (html) => ({
  nextUrl: toAbsoluteUrl(extractFirst(/<a class="next" href="([^"]+)"/i, html)),
})

export const extractJobDetail = (html, listing = {}) => {
  const jsonLd = extractJsonLd(html)
  const descriptionHtml = extractDescriptionHtml(html, jsonLd)
  const jobDescription = htmlToText(descriptionHtml) || null
  const location = normalizeWhitespace(
    extractFirst(/<p class="job-details--location">([\s\S]*?)<\/p>/i, html),
  ) || [
    jsonLd?.jobLocation?.[0]?.address?.addressLocality,
    jsonLd?.jobLocation?.[0]?.address?.addressCountry,
  ].filter(Boolean).join(', ') || listing.location || null
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<meta[^>]+name="search-job-apply-url"[^>]+content="([^"]+)"/i, html),
  ) || toAbsoluteUrl(
    extractFirst(/<a[^>]+class="button btn job-apply top btn--blue"[\s\S]*?href="([^"]+)"/i, html),
  ) || listing.applyUrl || listing.sourceUrl || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1 class="job-details--title[\s\S]*?">([\s\S]*?)<\/h1>/i, html),
    ) || normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: normalizeWhitespace(jsonLd?.hiringOrganization?.name) || 'Barclays',
    department: normalizeWhitespace(jsonLd?.industry) || listing.department || null,
    location,
    city: jsonLd?.jobLocation?.[0]?.address?.addressLocality || extractLocationCity(location),
    country: 'India',
    jobId: normalizeWhitespace(
      extractFirst(/data-selector-name="jobdetails"[^>]*data-job-id="([^"]+)"/i, html),
    ) || listing.jobId || null,
    requisitionId: normalizeWhitespace(jsonLd?.identifier) || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || normalizeWhitespace(jsonLd?.url) || null,
    applyUrl,
    employmentType: normalizeEmploymentType(jsonLd?.employmentType, jsonLd?.workHours),
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jsonLd?.datePosted) || null,
    closingDate: null,
    jobDescription,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createFetchTimeoutSignal(),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createBarclaysScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  includeDetails = true,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()
    const seenPageUrls = new Set()
    let nextUrl = buildSearchUrl()
    let page = 0

    while (nextUrl && page < maxPages) {
      if (seenPageUrls.has(nextUrl)) break
      seenPageUrls.add(nextUrl)
      page += 1
      const listingHtml = await fetchText(nextUrl)
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = includeDetails
          ? extractJobDetail(await fetchText(listing.sourceUrl), listing)
          : listing

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: detail.company || 'Barclays',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'barclays',
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      nextUrl = summary.nextUrl
    }

    return jobs
  },
})

export const run = async (options = {}) => createBarclaysScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Barclays scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'barclays')
    console.log('DB result:', result)
    process.exit(0)
  }
}
