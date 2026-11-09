import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOEING_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BOEING_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.careersLandingUrl
export const SEARCH_RESULTS_URL = PROVIDER_METADATA.searchResultsUrl
export const SAMPLE_JOB_URL = PROVIDER_METADATA.sampleJobUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LANDING_TITLE = 'Explore new horizons with Boeing'
const SEARCH_TITLE = 'Search our Job Opportunities at Boeing'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
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

const extractTitle = (html = '') => extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html, (match) =>
  normalizeWhitespace(match[1]))

const toAbsoluteUrl = (value, baseUrl = CAREERS_LANDING_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString()
  } catch {
    return String(value ?? '')
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

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const monthDate = new Date(normalized.replace(/\./g, ''))
  if (!Number.isNaN(monthDate.getTime())) {
    return monthDate.toISOString().slice(0, 10)
  }

  return normalized
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'regular' || normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return normalizeWhitespace(value)
}

const extractJsonLd = (html = '') => {
  const script = extractFirst(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, html)
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

  if (normalized.startsWith('basic qualification')) return 'required'
  if (normalized.startsWith('required skill') || normalized.startsWith('required skills')) return 'required'
  if (normalized.startsWith('preferred qualifications')) return 'preferred'
  if (normalized.startsWith('preferred skill') || normalized.startsWith('preferred skills')) return 'preferred'
  if (normalized.startsWith('typical education & experience')) return 'education'
  if (normalized === 'education') return 'education'

  return null
}

const addSectionMarkers = (html) => String(html ?? '').replace(
  /<(p|h[1-6])[^>]*>[\s\S]*?<\/\1>/gi,
  (block) => {
    const sectionKey = getSectionKey(stripTags(block))
    return sectionKey ? `[[SECTION:${sectionKey}]]${block}` : block
  },
)

const extractSectionBlock = (html, sectionKey) => extractFirst(
  new RegExp(`\\[\\[SECTION:${sectionKey}\\]\\]([\\s\\S]*?)(?=\\[\\[SECTION:|$)`, 'i'),
  addSectionMarkers(html),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => htmlToText(match[1]))
  .filter(Boolean)

const extractRequiredSkills = (descriptionHtml) => extractListItems(
  extractSectionBlock(descriptionHtml, 'required'),
)

const extractPreferredQualification = (descriptionHtml) => {
  const items = extractListItems(extractSectionBlock(descriptionHtml, 'preferred'))
  if (items.length === 0) return null
  return items.join('; ')
}

const extractMinimumQualification = (descriptionHtml) => {
  const section = extractSectionBlock(descriptionHtml, 'education')
  if (!section) return null

  const items = extractListItems(section)
  if (items.length > 0) return items[0]

  const text = htmlToText(section)?.replace(/^Typical Education & Experience:\s*/i, '') || null
  if (!text) return null

  return normalizeWhitespace(text.split(/Applications for this position will be accepted until/i)[0]) || null
}

const extractExperienceRequired = (descriptionHtml) => {
  const descriptionText = htmlToText(descriptionHtml)
  const rangeMatch = descriptionText?.match(/(\d+\s*-\s*\d+\s*years)/i)
  if (rangeMatch) return normalizeWhitespace(rangeMatch[1])

  const plusMatch = descriptionText?.match(/(\d+\+?\s*years)/i)
  if (plusMatch) return normalizeWhitespace(plusMatch[1])

  const openEndedMatch = descriptionText?.match(/(\d+)\s*(?:or more|or above)\s*years?(?:'|’)?/i)
  if (openEndedMatch) return `${openEndedMatch[1]}+ years`

  return null
}

const defaultFetchText = async (url) => {
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

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage === 1) return SEARCH_RESULTS_URL

  const url = new URL(SEARCH_RESULTS_URL)
  url.searchParams.set('p', String(normalizedPage))
  return url.toString()
}

export const hasCareersLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === LANDING_TITLE
    && normalized.includes('Search Jobs')
    && /boeing\.wd1\.myworkdayjobs\.com\/en-US\/EXTERNAL_CAREERS\/login/i.test(rawHtml)
    && normalized.includes('Join a team of innovators')
}

export const hasIndiaSearchResultsSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const visibleText = htmlToText(rawHtml) || ''
  const hasListingCards = /class="search-results__job-link"/i.test(rawHtml)
  const hasVerifiedZeroResultsState =
    /data-no-results="true"/i.test(rawHtml)
    && /class="search-results__no-results-msg"/i.test(rawHtml)
    && visibleText.includes('0 results found in India')
    && visibleText.includes('Please try a different keyword/location combination or broaden your search criteria.')

  return extractTitle(rawHtml) === SEARCH_TITLE
    && /data-location="India"/i.test(rawHtml)
    && /data-location-path="1269750"/i.test(rawHtml)
    && /data-total-job-results="(\d+)"/i.test(rawHtml)
    && visibleText.includes('India')
    && (hasListingCards || hasVerifiedZeroResultsState)
}

export const extractPaginationSummary = (html = '') => {
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
    hasNext: Boolean(safeCurrentPage && safeTotalPages && safeCurrentPage < safeTotalPages),
    currentPage: safeCurrentPage,
    totalPages: safeTotalPages,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
  }
}

export const extractSearchResults = (html = '') => (
  [...String(html ?? '').matchAll(
    /<a class="search-results__job-link" href="([^"]+)" data-job-id="([^"]+)"><span class="search-results__job-title">([\s\S]*?)<\/span><\/a>\s*<span class="search-results__job-info location">([\s\S]*?)<\/span>\s*<span class="search-results__job-info date">([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => {
      const sourceUrl = toAbsoluteUrl(match[1], CAREERS_LANDING_URL)
      const jobId = normalizeWhitespace(match[2])
      const title = normalizeWhitespace(match[3])
      const location = normalizeWhitespace(match[4])
      const postingDate = normalizeIsoDate(match[5])

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
        postingDate,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
)

export const extractJobDetail = (html = '', listing = {}) => {
  const jsonLd = extractJsonLd(html)
  const descriptionHtml = jsonLd?.description || ''

  const visibleLocation = normalizeWhitespace(
    extractFirst(/<span class="job-description__job-location">([\s\S]*?)<\/span>/i, html),
  )
  const location = visibleLocation
    ? [visibleLocation, /india/i.test(visibleLocation) ? null : 'India'].filter(Boolean).join(', ')
    : null

  const requisitionId = normalizeWhitespace(
    extractFirst(/job-id"><span>Job ID<\/span>\s*([^<]+)/i, html),
  ) || normalizeWhitespace(jsonLd?.identifier) || listing.requisitionId || listing.jobId || null

  const department = normalizeWhitespace(
    extractFirst(/job-category"><span>Category<\/span>\s*([^<]+)/i, html),
  ) || listing.department || null

  const remoteStatus = normalizeWhitespace(
    extractFirst(/job-role-type"><span>\s*Role Type<\/span>\s*([^<]+)/i, html),
  ) || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1 class="job-description__job-title">([\s\S]*?)<\/h1>/i, html),
    ) || normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: COMPANY_NAME,
    department,
    location: location || normalizeWhitespace([
      jsonLd?.jobLocation?.[0]?.address?.addressLocality,
      jsonLd?.jobLocation?.[0]?.address?.addressRegion,
      jsonLd?.jobLocation?.[0]?.address?.addressCountry,
    ].filter(Boolean).join(', ')) || listing.location || null,
    city: normalizeWhitespace(jsonLd?.jobLocation?.[0]?.address?.addressLocality) || extractCity(location) || listing.city || null,
    country: normalizeWhitespace(jsonLd?.jobLocation?.[0]?.address?.addressCountry) || listing.country || 'India',
    jobId: normalizeWhitespace(
      extractFirst(/data-selector-name="jobdetails"[^>]*data-job-id="([^"]+)"/i, html),
    ) || listing.jobId || null,
    requisitionId,
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
    postingDate: normalizeIsoDate(jsonLd?.datePosted)
      || normalizeIsoDate(extractFirst(/job-date"><span>Post Date<\/span>\s*([^<]+)/i, html))
      || listing.postingDate
      || null,
    closingDate: null,
    jobDescription: htmlToText(descriptionHtml),
    remoteStatus,
  }
}

const hasValidDetailHandoff = (detail) =>
  detail
  && typeof detail === 'object'
  && Boolean(detail.jobId)
  && Boolean(detail.requisitionId)
  && Boolean(detail.sourceUrl)
  && Boolean(detail.applyUrl)
  && /^https:\/\/boeing\.wd1\.myworkdayjobs\.com\//i.test(detail.applyUrl)

export const createBoeingIndiaScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepage = await fetchText(HOMEPAGE_URL)

    if (
      homepage.status !== 200
      || normalizeComparableUrl(homepage.url) !== normalizeComparableUrl(CAREERS_LANDING_URL)
      || !hasCareersLandingSignal(homepage.html)
    ) {
      throw new Error('Boeing India verified careers landing no longer matches the known first-party surface')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const searchUrl = buildSearchUrl({ page })
      const searchPage = await fetchText(searchUrl)

      if (
        searchPage.status !== 200
        || normalizeComparableUrl(searchPage.url) !== normalizeComparableUrl(searchUrl)
        || !hasIndiaSearchResultsSignal(searchPage.html)
      ) {
        throw new Error('Boeing India verified India search results no longer match the known public jobs surface')
      }

      const listings = extractSearchResults(searchPage.html)
      const summary = extractPaginationSummary(searchPage.html)

      if (summary.totalJobCount === 0) {
        if (listings.length !== 0) {
          throw new Error('Boeing India verified India search results no longer match the known public jobs surface')
        }

        break
      }

      if (listings.length === 0 || !summary.totalJobCount || summary.totalJobCount < listings.length) {
        throw new Error('Boeing India verified India search results no longer match the known public jobs surface')
      }

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPage = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailPage.html, listing)

        if (
          detailPage.status !== 200
          || normalizeComparableUrl(detailPage.url) !== normalizeComparableUrl(listing.sourceUrl)
          || !hasValidDetailHandoff(detail)
        ) {
          throw new Error('Boeing India verified job detail no longer matches the known public jobs handoff')
        }

        jobs.push({
          title: detail.title || listing.title,
          company: detail.company || COMPANY_NAME,
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired || listing.experienceRequired,
          minimumQualification: detail.minimumQualification || listing.minimumQualification,
          preferredQualification: detail.preferredQualification || listing.preferredQualification,
          requiredSkills: detail.requiredSkills || listing.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate || listing.closingDate,
          jobDescription: detail.jobDescription || listing.jobDescription,
          remoteStatus: detail.remoteStatus ?? null,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
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

export const run = async (options = {}) => createBoeingIndiaScraper(options).run(options)

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
