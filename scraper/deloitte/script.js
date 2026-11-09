import path from 'path'
import { fileURLToPath } from 'url'

import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nativeDefaults = loadNativePaginationDefaults(currentDir)

const BASE_URL = 'https://usijobs.deloitte.com'
const INDIA_SEARCH_URL = `${BASE_URL}/en_US/careersUSI`
const DEFAULT_PAGE_SIZE = 10

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
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const firstLocation = normalizeWhitespace(location)?.split(/\s*;\s*/)[0]
  return firstLocation?.split(',')[0]?.trim() || null
}

const extractDescriptionHtml = (html) => extractFirst(
  /<div class="article__view__item view--row no-label view--rich-text">[\s\S]*?<span data-map="item-value" class="field-value">([\s\S]*?)<\/span>[\s\S]*?<\/div>/i,
  html,
)

const extractRequiredSkills = (descriptionHtml) => [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractDetailLocations = (html) => {
  const locationsBlock = extractFirst(
    /<div class="article__header--locations[\s\S]*?<div class="fluid-cols[\s\S]*?">([\s\S]*?)<\/div>\s*<\/div>/i,
    html,
  )
  const multipleLocations = [...String(locationsBlock ?? '').matchAll(
    /<p class="paragraph">([\s\S]*?)<\/p>/gi,
  )]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  if (multipleLocations.length > 0) {
    return multipleLocations.join('; ')
  }

  return normalizeWhitespace(
    extractFirst(
      /<div class="article__header__text__subtitle">[\s\S]*?<p class="paragraph">([\s\S]*?)<\/p>/i,
      html,
    ),
  )
}

const extractJobPostingData = (html) => {
  const jsonText = extractFirst(
    /<script type="application\/ld\+json">\s*({[\s\S]*?})\s*<\/script>/i,
    html,
  )

  if (!jsonText) return null

  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

export const buildSearchUrl = ({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1)
  const normalizedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)

  if (pageNumber === 1) {
    return INDIA_SEARCH_URL
  }

  const offset = (pageNumber - 1) * normalizedPageSize
  return `${INDIA_SEARCH_URL}/SearchJobs/?jobRecordsPerPage=${normalizedPageSize}&jobOffset=${offset}`
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article class="article--result\b[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const title = normalizeWhitespace(
      extractFirst(/<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i, cardHtml),
    )
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a href="([^"]+)"/i, cardHtml))
    const subtitleParts = [...cardHtml.matchAll(/<span>([\s\S]*?)<\/span>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const department = subtitleParts[1] || null
    const location = subtitleParts.at(-1) || null
    const jobId = normalizeWhitespace(extractFirst(/\/(\d+)(?:\/)?$/i, sourceUrl || ''))

    if (!title || !sourceUrl || !jobId) {
      return null
    }

    return {
      title,
      department,
      location,
      city: location && /multiple locations/i.test(location) ? null : extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const nextHref = extractFirst(
    /<a[^>]*class="[^"]*paginationNextLink[^"]*"[\s\S]*?href="([^"]+)"/i,
    html,
  )
  const pageSize = Number.parseInt(
    extractFirst(/jobRecordsPerPage=(\d+)/i, nextHref || '') || '',
    10,
  )
  const nextOffset = Number.parseInt(
    extractFirst(/jobOffset=(\d+)/i, nextHref || '') || '',
    10,
  )

  return {
    hasNext: Boolean(nextHref),
    pageSize: Number.isFinite(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    nextOffset: Number.isFinite(nextOffset) ? nextOffset : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJobPostingData(html)
  const descriptionHtml = jobPosting?.description || extractDescriptionHtml(html) || null
  const location = extractDetailLocations(html) || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<h2 class="article__header__text__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i, html),
    ) || normalizeWhitespace(
      extractFirst(/<meta property="og:title" content="([^"]+)"/i, html),
    ) || listing.title || null,
    department: listing.department || null,
    location,
    city: extractCity(location),
    jobId: normalizeWhitespace(
      extractFirst(/Requisition code:\s*(\d+)/i, html),
    ) || listing.jobId || null,
    requisitionId: normalizeWhitespace(
      extractFirst(/Requisition code:\s*(\d+)/i, html),
    ) || listing.requisitionId || listing.jobId || null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeWhitespace(
      jobPosting?.datePosted || extractFirst(/"datePosted"\s*:\s*"([^"]+)"/i, html),
    ),
    closingDate: normalizeWhitespace(
      jobPosting?.validThrough || extractFirst(/"validThrough"\s*:\s*"([^"]+)"/i, html),
    ),
    applyUrl: toAbsoluteUrl(
      extractFirst(/<a class="button button--default" href="([^"]+Login\?jobId=\d+)"/i, html),
    ) || listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
    jobDescription: stripTags(descriptionHtml),
  }
}

const fetchText = async (url, referer = INDIA_SEARCH_URL, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
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

export const run = async (options = {}) => {
  const signal = options.signal
  signal?.throwIfAborted()
  const limits = nativePaginationLimits(options, nativeDefaults)
  const pagination = createNativePagination({ surface: INDIA_SEARCH_URL, limits, signal, collectionBudgetMs: options.collectionBudgetMs })
  const fetchTextImpl = options.fetchText || fetchText
  const jobs = []
  return pagination.run(jobs, async () => {
    const seenJobIds = new Set()

    for (let page = 1; page <= limits.maxPages; page += 1) {
      const listingUrl = buildSearchUrl({ page })
      const listingHtml = await readNativeWithSignal(() => fetchTextImpl(listingUrl, INDIA_SEARCH_URL, { signal: pagination.signal }), pagination.signal)
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)
      const progress = pagination.page(listings.map(job => job.jobId))
      if (!progress) return pagination.finish(jobs, { exhausted: !summary.hasNext })

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await readNativeWithSignal(() => fetchTextImpl(listing.sourceUrl, listingUrl, { signal: pagination.signal }), pagination.signal)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: 'Deloitte',
          department: detail.department || listing.department || null,
          location: detail.location || listing.location || null,
          city: detail.city || listing.city || null,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || null,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'deloitte',
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || null,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        })

        if (jobs.length >= limits.maxJobs) {
          return pagination.finish(jobs)
        }
      }

      if (!summary.hasNext) return pagination.finish(jobs, { exhausted: true })
    }

    return pagination.finish(jobs)
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Deloitte scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'deloitte')
    console.log('DB result:', result)
    process.exit(0)
  }
}
