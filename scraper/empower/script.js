import path from 'path'
import { fileURLToPath } from 'url'

const HOMEPAGE_URL = 'https://www.empower.com/'
const BASE_URL = 'https://jobs.empower.com'
export const INDIA_OVERVIEW_URL = `${BASE_URL}/india`
export const CAREER_PAGE_URL = `${BASE_URL}/india-jobs`
const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#43;/gi, '+')
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

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractLocationCity = (location) => normalizeLocation(location)?.split(',')[0]?.trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full')) return 'Full-time'
  if (normalized.includes('part')) return null
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
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

const extractRequiredSkills = (descriptionHtml) => [...new Set(
  [...String(descriptionHtml || '').matchAll(/<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)]
    .map((match) => stripTags(match[1]).replace(/^[â€¢\-\u2022]\s*/u, ''))
    .filter((text) => text && text.length > 12 && /^[A-Za-z]/.test(text)),
)]

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /\bEmpower\b/i.test(page)
    && /jobs\.empower\.com/i.test(page)
    && /Careers/i.test(page)
}

export const hasIndiaOverviewSignal = (html) => {
  const page = String(html ?? '')
  return /Country Head,\s*India/i.test(page)
    && /Bangalore office is an integral part/i.test(page)
    && /All India jobs/i.test(page)
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage === 1) return CAREER_PAGE_URL
  return `${CAREER_PAGE_URL}?p=${normalizedPage}`
}

export const extractSearchResults = (html) => {
  const section = extractFirst(/<section id="search-results-list">([\s\S]*?)<\/section>/i, html)
  if (!section) return []

  return [...section.matchAll(
    /<a href="([^"]+)" data-job-id="([^"]+)">\s*<h2>([\s\S]*?)<\/h2>\s*<span class="sr-facet job-location">([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => {
      const rawLocation = normalizeWhitespace(match[4])
      if (!/india/i.test(rawLocation || '')) return null
      const location = normalizeLocation(rawLocation)

      const sourceUrl = toAbsoluteUrl(match[1])
      const jobId = normalizeWhitespace(match[2])
      const title = normalizeWhitespace(match[3])
      if (!location || !sourceUrl || !jobId || !title) return null

      return {
        title,
        company: 'Empower',
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
  nextUrl: toAbsoluteUrl(extractFirst(/<a class="next"[^>]+href="([^"]+)"/i, html)),
})

export const extractJobDetail = (html, listing = {}) => {
  const jsonLd = extractJsonLd(html)
  const descriptionHtml = extractDescriptionHtml(html, jsonLd)
  const location = normalizeWhitespace(
    extractFirst(/<p class="job-details--location">([\s\S]*?)<\/p>/i, html),
  ) || [
    jsonLd?.jobLocation?.[0]?.address?.addressLocality,
    jsonLd?.jobLocation?.[0]?.address?.addressCountry,
  ].filter(Boolean).join(', ') || listing.location || null
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<meta[^>]+name="search-job-apply-url"[^>]+content="([^"]+)"/i, html),
  ) || toAbsoluteUrl(
    extractFirst(/<a[^>]+class="[^"]*job-apply[^"]*"[\s\S]*?href="([^"]+)"/i, html),
  ) || listing.applyUrl || listing.sourceUrl || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1 class="job-details--title[\s\S]*?">([\s\S]*?)<\/h1>/i, html),
    ) || normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: normalizeWhitespace(jsonLd?.hiringOrganization?.name) || 'Empower',
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
    employmentType: normalizeEmploymentType(jsonLd?.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jsonLd?.datePosted),
    closingDate: null,
    jobDescription: htmlToText(descriptionHtml) || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createEmpowerScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Empower homepage no longer matches the verified official public site')
    }

    const overviewHtml = await fetchText(INDIA_OVERVIEW_URL)
    if (!hasIndiaOverviewSignal(overviewHtml)) {
      throw new Error('Empower India overview page no longer matches the verified official public site')
    }

    const jobs = []
    const seenJobIds = new Set()
    let nextUrl = buildSearchUrl()
    let page = 0

    while (nextUrl && page < maxPages) {
      page += 1
      const listingHtml = await fetchText(nextUrl)
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: detail.company || 'Empower',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'empower',
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

export const run = async (options = {}) => createEmpowerScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Empower scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'empower')
    console.log('DB result:', result)
    process.exit(0)
  }
}
