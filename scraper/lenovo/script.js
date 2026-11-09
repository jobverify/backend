import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.lenovo.com'
const INDIA_SEARCH_URL = `${BASE_URL}/en_US/careers/SearchJobs/?3_130_3=37`
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
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&ndash;|&#8211;/gi, '-')
      .replace(/&mdash;|&#8212;/gi, '-')
      .replace(/&amp;/gi, '&')

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
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractFieldMap = (html) => {
  const fields = new Map()

  for (const match of String(html ?? '').matchAll(
    /article__content__view__field[\s\S]*?article__content__view__field__label[^>]*>([\s\S]*?)<\/div>[\s\S]*?article__content__view__field__value[^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const label = normalizeWhitespace(match[1])?.toLowerCase()
    const value = stripTags(match[2])
    if (label && value) fields.set(label, value)
  }

  return fields
}

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(',')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join(', ')
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  return normalized.split(',')[2]?.trim()
    || normalized.split(',')[0]?.trim()
    || null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized)
  if (isoLike) {
    const [, year, month, day] = isoLike
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const dashMonth = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(normalized)
  if (dashMonth) {
    const [, day, monthName, year] = dashMonth
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

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isIndiaLocation = (location) => /india/i.test(normalizeWhitespace(location) || '')

const extractDetailArticles = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*class="([^"]*\barticle--details\b[^"]*)"[^>]*>([\s\S]*?)<\/article>/gi,
)]
  .map((match) => {
    const articleHtml = match[2]
    const heading = normalizeWhitespace(
      extractFirst(/article__header[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i, articleHtml)
      || extractFirst(/article__header[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, articleHtml),
    )
    const text = stripTags(articleHtml)

    return {
      className: normalizeWhitespace(match[1]),
      heading,
      text,
    }
  })
  .filter((article) => article.text)

const cleanDescriptionText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/^(?:description and requirements|job description)\s*/i, ''),
)

const extractDescription = (html) => {
  const articles = extractDetailArticles(html)
  const descriptionArticle = articles.find((article) => (
    /description and requirements|job description/i.test(article.heading || '')
    || /^job description\b/i.test(article.text || '')
    || /^description and requirements\b/i.test(article.text || '')
  ))

  if (descriptionArticle) {
    return cleanDescriptionText(descriptionArticle.text)
  }

  const match = extractFirst(
    /<article\b[^>]*class="[^"]*\barticle--details\b[^"]*"[^>]*>[\s\S]*?<div class="article__content__view__field__value">([\s\S]*?)<\/div>[\s\S]*?<\/article>/i,
    html,
  )
  return cleanDescriptionText(stripTags(match))
}

const extractExperienceRequired = ({ title, jobDescription, minimumQualification }) => {
  const { experienceProfile } = extractJobFilterSignals({
    title,
    jobDescription,
    minimumQualification,
    experienceRequired: null,
  })

  return experienceProfile?.confidence === 'high'
    ? experienceProfile.evidence || null
    : null
}

export const buildSearchUrl = ({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1)
  if (pageNumber === 1) return INDIA_SEARCH_URL

  const offset = (pageNumber - 1) * (Number(pageSize) || DEFAULT_PAGE_SIZE)
  return `${INDIA_SEARCH_URL}&jobRecordsPerPage=${Number(pageSize) || DEFAULT_PAGE_SIZE}&jobOffset=${offset}`
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<article class="article article--result">[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const href = extractFirst(/<a href="([^"]+)"/i, cardHtml)
    const title = normalizeWhitespace(extractFirst(/<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i, cardHtml))
    const department = normalizeWhitespace(extractFirst(/<span class="paragraph">([\s\S]*?)<\/span>/i, cardHtml))
    const subtitleMatches = [...cardHtml.matchAll(/<span>([\s\S]*?)<\/span>/gi)].map((item) => normalizeWhitespace(item[1]))
    const location = normalizeLocation(subtitleMatches[0])
    const requisitionId = normalizeWhitespace(
      subtitleMatches[1]?.replace(/^Req #:\s*/i, ''),
    )
    const sourceUrl = toAbsoluteUrl(href)
    const jobId = normalizeWhitespace(extractFirst(/\/(\d+)(?:\/)?$/i, sourceUrl || ''))

    if (!title || !location || !requisitionId || !jobId || !sourceUrl || !isIndiaLocation(location)) {
      return null
    }

    return {
      title,
      department,
      location,
      city: extractCity(location),
      jobId,
      requisitionId,
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
  const fields = extractFieldMap(html)
  const title = normalizeWhitespace(
    extractFirst(/<meta property="og:title" content="([^"]+)"/i, html),
  ) || listing.title || null
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a class="button button--primary" href="([^"]+Login\?jobId=\d+)"/i, html),
  )
  const postingDate = normalizeDate(
    extractFirst(/created\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i, html)
      || listing.postingDate,
  )
  const jobDescription = extractDescription(html)
  const minimumQualification = null
  const experienceRequired = extractExperienceRequired({
    title,
    minimumQualification,
    jobDescription,
  })

  return {
    title,
    department: listing.department || null,
    location: listing.location || null,
    city: listing.city || null,
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    employmentType: fields.get('working time') || null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
    jobDescription,
    publicExperienceChecked: Boolean(jobDescription),
  }
}

const fetchText = async (url, referer = INDIA_SEARCH_URL) => {
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

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY

  for (let page = 1; page <= maxPages; page += 1) {
    const listingUrl = buildSearchUrl({ page })
    const listingHtml = await fetchText(listingUrl, INDIA_SEARCH_URL)
    const listings = extractSearchResults(listingHtml)
    const summary = extractPaginationSummary(listingHtml)

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailHtml = await fetchText(listing.sourceUrl, listingUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'Lenovo',
        department: detail.department || listing.department || null,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        applyUrl: detail.applyUrl || null,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: 'lenovo',
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate || listing.postingDate || null,
        closingDate: detail.closingDate,
        publicExperienceChecked: Boolean(detail.publicExperienceChecked),
        scrapedAt: new Date().toISOString(),
      })
    }

    if (!summary.hasNext) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Lenovo scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'lenovo')
    console.log('DB result:', result)
    process.exit(0)
  }
}
