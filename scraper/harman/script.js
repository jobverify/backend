import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobsearch.harman.com'
const SEARCH_URL = `${BASE_URL}/en_US/careers/SearchJobs`
const FEED_URL = `${SEARCH_URL}/feed/`
const DEFAULT_PAGE_SIZE = 20
const DEFAULT_DETAIL_CONCURRENCY = 6

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
      .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
      .replace(/&ndash;|&#8211;/gi, '-')
      .replace(/&mdash;|&#8212;/gi, '-')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')

    if (next === decoded) break
    decoded = next
  }

  return decoded
}

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const unwrapCdata = (value) => String(value ?? '').replace(/<!\[CDATA\[|\]\]>/g, '')

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const dashMonthMatch = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(normalized)
  if (dashMonthMatch) {
    const [, day, monthName, year] = dashMonthMatch
    const monthMap = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    }
    const month = monthMap[monthName.toLowerCase()]
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toCanonicalUrl = (value, baseUrl = BASE_URL) => {
  if (!value) return null

  try {
    const url = new URL(decodeHtmlEntities(value), baseUrl)
    if (url.origin !== BASE_URL) return null

    if (url.pathname === '/careers') {
      url.pathname = '/en_US/careers'
    } else if (url.pathname.startsWith('/careers/')) {
      url.pathname = `/en_US${url.pathname}`
    }

    return url.toString()
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (url) => normalizeWhitespace(
  extractFirst(/\/(\d+)(?:[/?#]|$)/, url || ''),
)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const encodedMatch = /^([A-Z]{2})_([^_]+)(?:_|$)/.exec(normalized)
  if (encodedMatch) return normalizeWhitespace(encodedMatch[2])

  return normalizeWhitespace(normalized.split(/\s*-\s*|,/)[0])
}

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location) || ''
  return /^IN_/i.test(normalized)
    || /(?:^|[,;\s])india(?:$|[,;\s])/i.test(normalized)
}

const isHarmanDetailUrl = (url) => {
  const normalized = toCanonicalUrl(url)
  return normalized && /\/en_US\/careers\/JobDetail\//i.test(normalized) ? normalized : null
}

const extractFieldValue = (label, html) => normalizeWhitespace(
  extractFirst(
    new RegExp(
      `<div class="article__content__view__field__label">\\s*${escapeRegExp(label)}\\s*<\\/div>[\\s\\S]*?<div class="article__content__view__field__value">([\\s\\S]*?)<\\/div>`,
      'i',
    ),
    html,
  ),
)

const extractDescriptionHtml = (html) => {
  const matches = [...String(html ?? '').matchAll(
    /<div class="article__content__view__field[^"]*">\s*(?!<div class="article__content__view__field__label")<div class="article__content__view__field__value">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/gi,
  )]

  return matches[0]?.[1]?.trim() || null
}

const extractRequiredSkills = (descriptionHtml) => [...String(descriptionHtml ?? '').matchAll(
  /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractJobPostingData = (html) => {
  const scriptText = extractFirst(
    /<script type="application\/ld\+json">\s*({[\s\S]*?})\s*<\/script>/i,
    html,
  )

  if (!scriptText) return null

  try {
    return JSON.parse(scriptText)
  } catch {
    return null
  }
}

export const buildSearchUrl = ({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)

  if (normalizedPage === 1 && normalizedPageSize === DEFAULT_PAGE_SIZE) {
    return SEARCH_URL
  }

  const offset = (normalizedPage - 1) * normalizedPageSize
  return `${SEARCH_URL}/?jobRecordsPerPage=${normalizedPageSize}&jobOffset=${offset}`
}

export const buildFeedUrl = ({ pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const normalizedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)
  return `${FEED_URL}?jobRecordsPerPage=${normalizedPageSize}`
}

export const extractFeedResults = (xml) => [...String(xml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  .map((match) => {
    const block = match[1]
    const description = unwrapCdata(
      extractFirst(/<description>([\s\S]*?)<\/description>/i, block),
    )
    const sourceUrl = isHarmanDetailUrl(
      extractFirst(/<guid\b[^>]*>([\s\S]*?)<\/guid>/i, block)
      || extractFirst(/<link>([\s\S]*?)<\/link>/i, block),
    )
    const title = normalizeWhitespace(extractFirst(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i, block))
      || normalizeWhitespace(extractFirst(/<title>([\s\S]*?)<\/title>/i, block))
    const requisitionId = normalizeWhitespace(
      extractFirst(/(R-\d+-\d+)/i, description),
    )
    const jobId = extractJobIdFromUrl(sourceUrl)
    const postingDate = normalizeDate(extractFirst(/<pubDate>([\s\S]*?)<\/pubDate>/i, block))

    if (!title || !sourceUrl || !jobId || !requisitionId) return null

    return {
      title,
      jobId,
      requisitionId,
      postingDate,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article class="article article--result"[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const sourceUrl = isHarmanDetailUrl(extractFirst(/<a class="link" href="([^"]+)"/i, cardHtml))
    const title = normalizeWhitespace(
      extractFirst(/<h3 class="article__header__text__title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i, cardHtml),
    )
    const location = normalizeWhitespace(
      stripTags(extractFirst(/<span class="list-item-location">([\s\S]*?)<\/span>/i, cardHtml)),
    )?.replace(/^Location:\s*/i, '') || null
    const requisitionId = normalizeWhitespace(
      stripTags(extractFirst(/<span class="list-item-ref">([\s\S]*?)<\/span>/i, cardHtml)),
    )?.replace(/^Ref\s*#\s*/i, '') || null
    const postingDate = normalizeDate(
      normalizeWhitespace(
        stripTags(extractFirst(/<span class="list-item-posted">([\s\S]*?)<\/span>/i, cardHtml)),
      )?.replace(/^Date Posted:\s*/i, ''),
    )
    const jobId = extractJobIdFromUrl(sourceUrl)

    if (!title || !location || !sourceUrl || !jobId || !requisitionId) return null

    return {
      title,
      location,
      city: extractCity(location),
      jobId,
      requisitionId,
      postingDate,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJobPostingData(html)
  const sourceUrl = isHarmanDetailUrl(listing.sourceUrl)
  const location = extractFieldValue('Location:', html) || listing.location || null
  const descriptionHtml = extractDescriptionHtml(html)

  return {
    title: normalizeWhitespace(
      extractFirst(/<meta property="og:title" content="([^"]+)"/i, html),
    ) || normalizeWhitespace(jobPosting?.title) || listing.title || null,
    department: extractFieldValue('Job Family:', html) || listing.department || null,
    location,
    city: extractCity(location),
    country: isIndiaLocation(location) ? 'India' : null,
    jobId: listing.jobId || extractJobIdFromUrl(sourceUrl),
    requisitionId: listing.requisitionId || listing.jobId || extractJobIdFromUrl(sourceUrl),
    employmentType: extractFieldValue('Worker Type Reference:', html) || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeDate(jobPosting?.datePosted || listing.postingDate),
    closingDate: normalizeDate(jobPosting?.validThrough),
    applyUrl: sourceUrl,
    sourceUrl,
    jobDescription: stripTags(descriptionHtml),
  }
}

const fetchText = async (url, referer = SEARCH_URL) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: referer,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const run = async ({
  maxPages = config.maxPages,
  pageSize = DEFAULT_PAGE_SIZE,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
  fetchText: getHtml = fetchText,
} = {}) => {
  const jobs = []
  const seenJobIds = new Set()
  const boundedPages = Math.max(0, Number.isInteger(maxPages) ? maxPages : 10)

  for (let page = 1; page <= boundedPages; page += 1) {
    const listingUrl = buildSearchUrl({ page, pageSize })
    const listingHtml = await getHtml(listingUrl)
    const listings = extractSearchResults(listingHtml)

    if (listings.length === 0) break

    const indiaListings = []
    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)
      if (isIndiaLocation(listing.location)) {
        indiaListings.push(listing)
      }
    }

    const enrichedJobs = await mapWithConcurrency(
      indiaListings,
      detailConcurrency,
      async (listing) => {
        const detailHtml = await getHtml(listing.sourceUrl, listingUrl)
        const detail = extractJobDetail(detailHtml, listing)

        if (!isIndiaLocation(detail.location)) return null

        return {
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: 'HARMAN',
          department: detail.department || listing.department || null,
          location: detail.location || listing.location || null,
          city: detail.city || listing.city || null,
          country: detail.country || null,
          link: detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'harman',
          employmentType: detail.employmentType || null,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate || null,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        }
      },
    )

    jobs.push(...enrichedJobs.filter(Boolean))
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'harman')
  }
}
