import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { runElectronicArtsNative } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.ea.com'
const SEARCH_URL = `${BASE_URL}/en_US/careers/Home/`
const DEFAULT_PAGE_SIZE = 20
const INDIA_LOCATION_PATTERN = /india|hyderabad|bengaluru|bangalore|chennai|pune|mumbai|gurgaon|gurugram|noida/i

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

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const extractJobIdFromUrl = (url) => normalizeWhitespace(
  extractFirst(/\/(\d+)(?:\/)?$/i, url || ''),
)

const isIndiaLocation = (location) => INDIA_LOCATION_PATTERN.test(
  normalizeWhitespace(location) || '',
)

const extractFieldValue = (label, html) => normalizeWhitespace(
  extractFirst(
    new RegExp(
      `<div class="article__content__view__field__label">\\s*${label}\\s*<\\/div>[\\s\\S]*?<div class="article__content__view__field__value">([\\s\\S]*?)<\\/div>`,
      'i',
    ),
    html,
  ),
)

const extractLocations = (html) => normalizeWhitespace(
  extractFirst(
    /<strong>\s*Locations\s*<\/strong>\s*:\s*([\s\S]*?)<br>/i,
    html,
  ),
)

const extractBalancedDivContent = (html, startIndex) => {
  const openingTagEnd = html.indexOf('>', startIndex)
  if (openingTagEnd === -1) return null

  const divTagPattern = /<\/?div\b[^>]*>/gi
  divTagPattern.lastIndex = startIndex
  let depth = 0

  for (const match of html.matchAll(divTagPattern)) {
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return html.slice(openingTagEnd + 1, match.index)
      continue
    }

    depth += 1
  }

  return null
}

const extractDescriptionHtml = (html) => {
  const article = extractFirst(
    /<article class="article article--details "\s*>[\s\S]*?Description &amp; Requirements[\s\S]*?<\/article>/i,
    html,
    (match) => match[0],
  )

  if (!article) return null

  const contentValues = [...article.matchAll(
    /<div class="article__content__view__field__value">/gi,
  )]
    .map((match) => extractBalancedDivContent(article, match.index))
    .map((value) => value?.trim())
    .filter(Boolean)

  return contentValues.join('\n')
}

const extractRequiredSkills = (descriptionHtml) => [...String(descriptionHtml ?? '').matchAll(
  /<p\b[^>]*>([\s\S]*?)<\/p>/gi,
)]
  .map((match) => stripTags(match[1]))
  .map((line) => line?.replace(/^[•*-]\s*/, ''))
  .filter((line) => Boolean(line) && /^[A-Z].{8,}$/.test(line) && !/:$/.test(line))

const extractExperienceRequired = (descriptionHtml) => normalizeWhitespace(
  extractFirst(
    /\b\d+\s*(?:\+|-\s*\d+)?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[a-z][a-z/-]*){0,6}\s+experience\b/i,
    stripTags(descriptionHtml),
    (match) => match[0],
  ),
)

export const buildSearchUrl = ({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const normalizedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)
  const offset = Math.max(0, Number(page) - 1) * normalizedPageSize
  return `${SEARCH_URL}?jobRecordsPerPage=${normalizedPageSize}&jobOffset=${offset}`
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article class="article article--result article--non-toggle"[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a class="link link_result" href="([^"]+)"/i, cardHtml))
    const title = normalizeWhitespace(
      extractFirst(/<h3 class="article__header__text__title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i, cardHtml),
    )
    const location = normalizeWhitespace(
      extractFirst(/<span class="list-item-location">([\s\S]*?)<\/span>/i, cardHtml),
    )
    const jobId = normalizeWhitespace(
      extractFirst(/<span class="list-item-id">\s*Role ID\s*(\d+)\s*<\/span>/i, cardHtml),
    ) || extractJobIdFromUrl(sourceUrl)
    const employmentType = normalizeWhitespace(
      extractFirst(/<span class="list-item-workerType">([\s\S]*?)<\/span>/i, cardHtml),
    )
    const department = normalizeWhitespace(
      extractFirst(/<span class="list-item-department">([\s\S]*?)<\/span>/i, cardHtml),
    )

    if (!title || !sourceUrl || !jobId || !location || !isIndiaLocation(location)) {
      return null
    }

    return {
      title,
      department,
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      employmentType,
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
  const descriptionHtml = extractDescriptionHtml(html)
  const location = extractLocations(html) || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<meta property="og:title" content="([^"]+)"/i, html),
    ) || listing.title || null,
    department: extractFieldValue('Studio/Department', html) || listing.department || null,
    location,
    city: extractCity(location),
    jobId: extractFieldValue('Role ID', html) || listing.jobId || null,
    requisitionId: extractFieldValue('Role ID', html) || listing.requisitionId || listing.jobId || null,
    employmentType: extractFieldValue('Worker Type', html) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: null,
    closingDate: null,
    applyUrl: listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
    jobDescription: stripTags(descriptionHtml),
    workModel: extractFieldValue('Work Model', html),
  }
}

const fetchText = async (url, referer = `${BASE_URL}/en_US/careers`) => {
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

export const run = async (options = {}) => runElectronicArtsNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Electronic Arts scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'electronicarts')
    console.log('DB result:', result)
    process.exit(0)
  }
}
