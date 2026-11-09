import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import AVASO_TECHNOLOGY_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = AVASO_TECHNOLOGY_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_LANDING_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const BASE_URL = 'https://careers.avasotech.com'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, group = 1) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[group] : null
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

const isIndiaCountry = (value) => /\bindia\b/i.test(String(value ?? ''))

const deriveCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalizeWhitespace(
    normalized
      .split(',')[0]
      .split('/')[0]
      .split(' - ')[0],
  )
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const shortMonthDateMatch = normalized.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (shortMonthDateMatch) {
    const [, monthName, day, year] = shortMonthDateMatch
    const monthMap = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    }
    const month = monthMap[`${monthName[0].toUpperCase()}${monthName.slice(1, 3).toLowerCase()}`]
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`
    }
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toISOString().slice(0, 10)
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const sortJobs = (jobs) => [...jobs].sort((left, right) =>
  String(left.title || '').localeCompare(String(right.title || ''), 'en', { sensitivity: 'base' }))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /id=["']searchresults["']/i.test(page)
    && /class=["'][^"']*jobTitle-link[^"']*["']/i.test(page)
    && /Search results for/i.test(page)
}

export const extractPaginationLinks = (html = '') => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=["']([^"']*startrow=\d+[^"']*)["'][^>]*>/gi,
)]
  .map((match) => toAbsoluteUrl(match[1]))
  .filter(Boolean)

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
)]
  .map((match) => {
    const row = match[1]
    const detailUrl = toAbsoluteUrl(
      extractFirst(/<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i, row),
    )
    const title = normalizeWhitespace(
      extractFirst(/<a\b[^>]*class=["'][^"']*jobTitle-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i, row),
    )
    const city = normalizeWhitespace(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const country = normalizeWhitespace(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobDepartment[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const postingDate = normalizePostingDate(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const jobId = extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, detailUrl || '')

    if (!title || !detailUrl || !city || !country || !jobId) return null

    return {
      title,
      company: COMPANY,
      location: `${city}, ${country}`,
      city,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      detailUrl,
      applyUrl: detailUrl,
      department: null,
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

export const extractJobDetail = (html = '', listing = {}) => {
  const detailShell = extractFirst(
    /<div\b[^>]*class=["'][^"']*jobDisplayShell[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/body>/i,
    html,
  ) || html
  const jobContent = extractFirst(
    /<div\b[^>]*class=["'][^"']*job\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    detailShell,
  )
  const rawLocation = stripTags(
    extractFirst(/<strong>\s*Location\s*<\/strong>\s*<\/p>\s*<ul>\s*<li>([\s\S]*?)<\/li>/i, detailShell),
  )
  const location = rawLocation || listing.location || null
  const country = isIndiaCountry(location) ? 'India' : listing.country || null
  const jobId = listing.jobId || extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, listing.sourceUrl || '')

  return {
    ...listing,
    title: normalizeWhitespace(
      extractFirst(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i, html),
    ) || listing.title || null,
    location,
    city: deriveCity(location) || listing.city || null,
    country,
    jobId: jobId || null,
    requisitionId: listing.requisitionId || jobId || null,
    applyUrl: toAbsoluteUrl(
      extractFirst(/<a\b[^>]*class=["'][^"']*\bapply\b[^"']*\bdialogApplyBtn\b[^"']*["'][^>]*href=["']([^"']+)["']/i, detailShell),
    ) || listing.applyUrl || listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
    requiredSkills: extractListItems(jobContent),
    postingDate: normalizePostingDate(
      extractFirst(/itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, detailShell),
    ) || listing.postingDate || null,
    jobDescription: stripTags(jobContent) || listing.jobDescription || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createAvasoTechnologySolutionsScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: overrideNow = now,
  } = {}) {
    const listings = []
    const queuedUrls = [CAREERS_URL]
    const seenPageUrls = new Set()

    while (queuedUrls.length > 0 && seenPageUrls.size < maxPages) {
      const pageUrl = queuedUrls.shift()
      if (!pageUrl || seenPageUrls.has(pageUrl)) continue
      seenPageUrls.add(pageUrl)

      const listingHtml = await fetchText(pageUrl)
      if (seenPageUrls.size === 1 && !hasOfficialCareersSignal(listingHtml)) {
        throw new Error('AVASO Technology Solutions verified SuccessFactors search board no longer matches the official surface')
      }

      listings.push(...extractJobCards(listingHtml))

      for (const paginationUrl of extractPaginationLinks(listingHtml)) {
        if (!seenPageUrls.has(paginationUrl) && !queuedUrls.includes(paginationUrl)) {
          queuedUrls.push(paginationUrl)
        }
      }
    }

    const jobs = []
    const seenJobIds = new Set()

    for (const listing of listings) {
      if (!isIndiaCountry(listing.country) || seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
      if (!isIndiaCountry(detail.location) && !isIndiaCountry(detail.country)) continue

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        country: detail.country || 'India',
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: overrideNow(),
      })

      if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) {
        break
      }
    }

    return sortJobs(jobs)
  },
})

export const run = async (options = {}) => createAvasoTechnologySolutionsScraper(options).run(options)

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
