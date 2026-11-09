import path from 'path'
import { fileURLToPath } from 'url'

export const COMPANY_NAME = 'Chevron Global Technology and Services'
export const LEGAL_ENTITY_NAME = 'Chevron Global Technology and Services Private Limited'
export const SOURCE = 'chevronglobaltechnologyandservices'
export const ATS_PLATFORM = 'talentbrew-radancy'
export const BASE_URL = 'https://careers.chevron.com'
export const CAREER_PAGE_URL = `${BASE_URL}/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D`

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const htmlToText = (value) => stripTags(value)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return normalized

  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'regular' || normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return normalizeWhitespace(value)
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

const getSectionKey = (label) => {
  const normalized = normalizeWhitespace(label)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'required skill' || normalized === 'required skills' || normalized === 'required qualifications') {
    return 'required'
  }
  if (normalized === 'preferred skill' || normalized === 'preferred skills' || normalized === 'preferred qualifications') {
    return 'preferred'
  }
  if (normalized === 'education') {
    return 'education'
  }
  return null
}

const addSectionMarkers = (html) => String(html ?? '').replace(
  /<(p|h[1-6])[^>]*>[\s\S]*?<\/\1>/gi,
  (block) => {
    const sectionKey = getSectionKey(stripTags(block))
    return sectionKey ? `[[SECTION:${sectionKey}]]` : block
  },
)

const extractSectionBlock = (html, sectionKey) => extractFirst(
  new RegExp(`\\[\\[SECTION:${sectionKey}\\]\\]([\\s\\S]*?)(?=\\[\\[SECTION:|$)`, 'i'),
  addSectionMarkers(html),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => htmlToText(match[1]))
  .filter(Boolean)

const extractPreferredQualification = (descriptionHtml) => {
  const items = extractListItems(extractSectionBlock(descriptionHtml, 'preferred'))
  if (items.length === 0) return null
  return items.join('; ')
}

const extractMinimumQualification = (descriptionHtml) => {
  const items = extractListItems(extractSectionBlock(descriptionHtml, 'education'))
  return items[0] || null
}

const extractRequiredSkills = (descriptionHtml) => extractListItems(
  extractSectionBlock(descriptionHtml, 'required'),
)

const extractExperienceRequired = (descriptionHtml) => {
  const descriptionText = htmlToText(descriptionHtml)
  const rangeMatch = descriptionText?.match(/(\d+\s*-\s*\d+\s*years)/i)
  if (rangeMatch) return normalizeWhitespace(rangeMatch[1])

  const plusMatch = descriptionText?.match(/(\d+\+?\s*years)/i)
  if (plusMatch) return normalizeWhitespace(plusMatch[1])

  return null
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

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(CAREER_PAGE_URL)
  const normalizedPage = Math.max(1, Number(page) || 1)

  if (normalizedPage > 1) {
    url.searchParams.set('p', String(normalizedPage))
  }

  return url.toString()
}

export const extractSearchResults = (html) => {
  const section = extractFirst(/<section id="search-results-list">([\s\S]*?)<\/section>/i, html)
  if (!section) return []

  return [...section.matchAll(
    /<a href="([^"]+)" data-job-id="([^"]+)">\s*<h2>([\s\S]*?)<\/h2>\s*<span class="job-location">([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => {
      const sourceUrl = toAbsoluteUrl(match[1])
      const jobId = normalizeWhitespace(match[2])
      const title = normalizeWhitespace(match[3])
      const location = normalizeWhitespace(match[4])

      if (!sourceUrl || !jobId || !title || !location || !/india/i.test(location)) {
        return null
      }

      return {
        title,
        company: COMPANY_NAME,
        department: null,
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
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

export const extractPaginationSummary = (html) => {
  const currentPage = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-current-page="(\d+)"/i, html)) || '',
    10,
  )
  const totalPages = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-total-pages="(\d+)"/i, html)) || '',
    10,
  )
  const totalJobCount = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-total-job-results="(\d+)"/i, html)) || '',
    10,
  )

  const safeCurrentPage = Number.isFinite(currentPage) ? currentPage : null
  const safeTotalPages = Number.isFinite(totalPages) ? totalPages : null

  return {
    hasNext: Boolean(
      /<a class="next"/i.test(String(html))
      || (safeCurrentPage && safeTotalPages && safeCurrentPage < safeTotalPages)
    ),
    currentPage: safeCurrentPage,
    totalPages: safeTotalPages,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jsonLd = extractJsonLd(html)
  const descriptionHtml = jsonLd?.description || ''
  const location = normalizeWhitespace(
    extractFirst(/<p class="ajd_header__location">([\s\S]*?)<\/p>/i, html),
  ) || [
    jsonLd?.jobLocation?.[0]?.address?.addressLocality,
    jsonLd?.jobLocation?.[0]?.address?.addressCountry,
  ].filter(Boolean).join(', ') || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<h2 class="ajd_section__heading ajd_job-details__heading heading-2">([\s\S]*?)<\/h2>/i, html),
    ) || normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: COMPANY_NAME,
    department: null,
    location,
    city: jsonLd?.jobLocation?.[0]?.address?.addressLocality || extractCity(location),
    country: jsonLd?.jobLocation?.[0]?.address?.addressCountry || listing.country || 'India',
    jobId: normalizeWhitespace(
      extractFirst(/data-selector-name="jobdetails"[^>]*data-org-id="[^"]+"[^>]*data-job-id="([^"]+)"/i, html),
    ) || listing.jobId || null,
    requisitionId: normalizeWhitespace(
      extractFirst(/<meta name="job-ats-req-id" content="([^"]+)"/i, html),
    ) || normalizeWhitespace(jsonLd?.identifier) || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || normalizeWhitespace(jsonLd?.url) || null,
    applyUrl: toAbsoluteUrl(
      extractFirst(/<meta name="search-job-apply-url" content="([^"]+)"/i, html),
    ) || toAbsoluteUrl(
      extractFirst(/<a[^>]+class="[^"]*job-apply[^"]*"[^>]+href="([^"]+)"/i, html),
    ) || listing.applyUrl || listing.sourceUrl || null,
    employmentType: normalizeEmploymentType(jsonLd?.employmentType),
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: extractMinimumQualification(descriptionHtml),
    preferredQualification: extractPreferredQualification(descriptionHtml),
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jsonLd?.datePosted) || null,
    closingDate: null,
    jobDescription: htmlToText(descriptionHtml),
    remoteStatus: null,
  }
}

export const createChevronGlobalTechnologyAndServicesScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingHtml = await fetchText(buildSearchUrl({ page }))
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
          company: detail.company || COMPANY_NAME,
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          remoteStatus: detail.remoteStatus ?? null,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext || (summary.totalPages && page >= summary.totalPages)) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createChevronGlobalTechnologyAndServicesScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY_NAME} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
