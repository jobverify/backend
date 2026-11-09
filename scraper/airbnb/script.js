import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import AIRBNB_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AIRBNB_CATALOG.source
export const COMPANY = AIRBNB_CATALOG.companyName
export const VERIFIED_AT = AIRBNB_CATALOG.verifiedOn
export const CAREERS_ENTRY_URL = AIRBNB_CATALOG.officialCareersEntryUrl
export const CAREERS_HOME_URL = AIRBNB_CATALOG.officialCareersHomeUrl
export const POSITIONS_URL = AIRBNB_CATALOG.positionsUrl
export const ACCEPTED_CAREERS_HOME_URLS = [
  CAREERS_HOME_URL,
  CAREERS_HOME_URL.replace(/\/$/, ''),
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

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

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isAcceptedCareersHomeUrl = (value) =>
  ACCEPTED_CAREERS_HOME_URLS.some((candidate) => sameUrl(value, candidate))

const isIndiaLocation = (value) => /\bIndia\b/i.test(normalizeWhitespace(value) || '')

const deriveCity = (location) => {
  const scopedCity = getValidIndiaCityForJob({
    country: 'India',
    location: normalizeWhitespace(location),
  })
  if (scopedCity) return scopedCity

  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^remote\b/i.test(normalized)) return 'Remote'

  return normalizeCity(normalized.split(',')[0]?.trim() || normalized)
}

const inferRemoteStatus = (workplaceType, location) => {
  const normalizedWorkplaceType = normalizeWhitespace(workplaceType)?.toLowerCase() || ''
  const normalizedLocation = normalizeWhitespace(location)?.toLowerCase() || ''

  if (
    normalizedWorkplaceType.includes('live and work anywhere')
    || normalizedWorkplaceType.includes('remote')
    || normalizedLocation.startsWith('remote')
    || normalizedLocation.includes(' remote')
  ) {
    return 'Remote'
  }

  if (normalizedWorkplaceType.includes('hybrid')) return 'Hybrid'
  if (normalizedWorkplaceType.includes('onsite') || normalizedWorkplaceType.includes('on-site')) {
    return 'On-site'
  }

  return 'On-site'
}

export const buildPositionsPageUrl = ({ page = 1 } = {}) => {
  if (Number.isInteger(page) && page > 1) {
    return new URL(`page/${page}/`, POSITIONS_URL).toString()
  }

  return POSITIONS_URL
}

export const hasOfficialCareersHomeSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Home\s*-\s*Careers at Airbnb\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Discover your place at Airbnb\s*<\/h1>/i.test(page)
    && /Explore open roles/i.test(page)
    && /Open Positions/i.test(page)
}

export const hasOfficialPositionsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Positions Archive(?:\s*-\s*Page\s*\d+\s*of\s*\d+)?\s*-\s*Careers at Airbnb\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*All Jobs\s*<\/h1>/i.test(page)
    && /<ul\b[^>]*class=["'][^"']*\bjob-list\b/i.test(page)
    && /Sort by:/i.test(page)
}

export const normalizeAirbnbJobUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value, CAREERS_HOME_URL)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathnameMatch = url.pathname.replace(/\/+$/, '').match(/^\/positions\/(\d+)$/i)

    if (hostname !== 'careers.airbnb.com' || !pathnameMatch) return null

    return `https://careers.airbnb.com/positions/${pathnameMatch[1]}/`
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (value) => normalizeAirbnbJobUrl(value)?.match(/\/positions\/(\d+)\//i)?.[1] || null

export const extractPaginationSummary = (html) => {
  const page = String(html ?? '')
  const currentPage = Number.parseInt(
    page.match(/<title>\s*Positions Archive\s*-\s*Page\s*(\d+)\s*of\s*\d+\s*-\s*Careers at Airbnb\s*<\/title>/i)?.[1]
      || '1',
    10,
  )
  const totalPagesFromTitle = Number.parseInt(
    page.match(/<title>\s*Positions Archive\s*-\s*Page\s*\d+\s*of\s*(\d+)\s*-\s*Careers at Airbnb\s*<\/title>/i)?.[1]
      || '',
    10,
  )
  const pageNumbers = [
    ...new Set(
      [...page.matchAll(/\/positions\/page\/(\d+)\/?/gi)]
        .map((match) => Number.parseInt(match[1], 10))
        .filter(Number.isFinite),
    ),
  ]
  const totalPages = Math.max(currentPage, totalPagesFromTitle || 0, ...pageNumbers, 1)

  return {
    currentPage,
    totalPages,
    hasNext: currentPage < totalPages,
  }
}

const extractMetaValues = (block) => {
  const metaBlock = String(block ?? '').match(
    /<div\b[^>]*class=["'][^"']*text-size-3[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )?.[1] || ''

  return [...metaBlock.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((value) => value && value !== '•')
}

const extractLocation = (block) => stripTags(
  String(block ?? '').match(
    /<div\b[^>]*class=["'][^"']*justify-end[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/i,
  )?.[1],
)

export const extractIndiaJobCardsFromPage = (html) => {
  const listHtml = String(html ?? '').match(
    /<ul\b[^>]*class=["'][^"']*\bjob-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
  )?.[1] || ''
  const jobs = []

  for (const match of listHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = match[1]
    const href = block.match(/<a\b[^>]+href=["']([^"']*\/positions\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || null
    const sourceUrl = normalizeAirbnbJobUrl(href)
    const title = stripTags(
      block.match(/<a\b[^>]+href=["'][^"']*\/positions\/\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
    )
    const location = extractLocation(block)
    const [department = null, workplaceType = null] = extractMetaValues(block)

    if (isIndiaLocation(location) && !sourceUrl) {
      throw new Error('Airbnb positions archive no longer exposes the verified first-party Airbnb detail URLs')
    }

    if (!title || !location || !sourceUrl || !isIndiaLocation(location)) continue

    const jobId = extractJobIdFromUrl(sourceUrl)
    if (!jobId) {
      throw new Error('Airbnb positions archive no longer exposes the verified first-party Airbnb detail URLs')
    }

    jobs.push({
      title,
      location,
      department,
      workplaceType,
      sourceUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  return jobs
}

export const createAirbnbScraper = ({
  maxJobs = null,
  maxPages = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHome = await fetchPage(CAREERS_ENTRY_URL)

    if (
      careersHome.status !== 200
      || !isAcceptedCareersHomeUrl(careersHome.url)
      || !hasOfficialCareersHomeSignal(careersHome.html)
    ) {
      throw new Error('Verified official Airbnb careers entry surface changed materially')
    }

    const selectedMaxPages = Number.isInteger(maxPages) && maxPages > 0
      ? maxPages
      : Number.POSITIVE_INFINITY

    const jobs = []
    const seenJobIds = new Set()
    let currentPage = 1

    while (currentPage <= selectedMaxPages) {
      const pageUrl = buildPositionsPageUrl({ page: currentPage })
      const page = await fetchPage(pageUrl)

      if (
        page.status !== 200
        || !sameUrl(page.url, pageUrl)
        || !hasOfficialPositionsSignal(page.html)
      ) {
        throw new Error('Verified official Airbnb positions surface changed materially')
      }

      const pagination = extractPaginationSummary(page.html)
      if (pagination.currentPage !== currentPage) {
        throw new Error('Verified official Airbnb positions surface changed materially')
      }

      for (const listing of extractIndiaJobCardsFromPage(page.html)) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        jobs.push({
          title: listing.title,
          company: COMPANY,
          location: listing.location,
          city: deriveCity(listing.location),
          country: 'India',
          link: listing.sourceUrl,
          applyUrl: listing.sourceUrl,
          sourceUrl: listing.sourceUrl,
          source: SOURCE,
          jobId: listing.jobId,
          requisitionId: listing.requisitionId,
          department: listing.department,
          employmentType: null,
          experienceRequired: null,
          jobDescription: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          remoteStatus: inferRemoteStatus(listing.workplaceType, listing.location),
          scrapedAt: now(),
        })

        if (Number.isInteger(maxJobs) && maxJobs > 0 && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!pagination.hasNext) break
      currentPage += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createAirbnbScraper(options).run(options)

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
