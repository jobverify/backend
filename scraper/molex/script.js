import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const CAREERS_ORIGIN = 'https://koch.avature.net'
const SEARCH_URL = `${CAREERS_ORIGIN}/en_US/careers/SearchJobs?732=6322&tags=rm.kcm.web.kcm-004`

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] || null

const toKochUrl = (value, baseUrl = CAREERS_ORIGIN) => {
  if (!value) return null
  try {
    const url = new URL(value.replace(/&amp;/gi, '&'), baseUrl)
    return url.origin === CAREERS_ORIGIN ? url.toString() : null
  } catch {
    return null
  }
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const extractFieldMap = (html) => {
  const fields = new Map()
  for (const match of String(html ?? '').matchAll(
    /article__content__view__field[\s\S]*?article__content__view__field__label[^>]*>([\s\S]*?)<\/div>[\s\S]*?article__content__view__field__value[^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const label = normalizeWhitespace(match[1])
    const value = normalizeWhitespace(match[2])
    if (label && value) fields.set(label.toLowerCase(), value)
  }
  return fields
}

const extractDetailLocation = (html, fields) => normalizeWhitespace(
  extractFirst(/article__header--locations[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i, html),
) || fields.get('locations') || fields.get('location') || null

const isIndiaLocation = (location) => /(?:^|[,;\s])india(?:$|[,;\s])/i.test(location || '')

export const buildSearchUrl = () => SEARCH_URL

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*article--result[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const card = match[0]
    const title = normalizeWhitespace(extractFirst(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i, card))
    const sourceUrl = toKochUrl(extractFirst(/<a[^>]*href="([^"]+)"/i, card), SEARCH_URL)
    const jobId = extractFirst(/\/(\d+)(?:\/?(?:\?|$))/, sourceUrl || '')
    const subtitles = [...card.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)

    if (!title || !sourceUrl || !/\/en_US\/careers\/JobDetail\//i.test(sourceUrl) || !jobId) return null

    return {
      title,
      department: subtitles[0] || null,
      location: subtitles.at(-1) || null,
      city: extractCity(subtitles.at(-1)),
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html, baseUrl = SEARCH_URL) => ({
  nextUrl: toKochUrl(
    extractFirst(/<a[^>]*class="[^"]*paginationNextLink[^"]*"[^>]*href="([^"]+)"/i, html),
    baseUrl,
  ),
})

export const extractJobDetail = (html, listing = {}) => {
  const fields = extractFieldMap(html)
  const location = extractDetailLocation(html, fields)
  const description = fields.get('description') || null
  const sourceUrl = toKochUrl(listing.sourceUrl)

  return {
    title: normalizeWhitespace(extractFirst(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i, html)) || listing.title || null,
    department: fields.get('department') || listing.department || null,
    location,
    city: extractCity(location),
    jobId: fields.get('job id') || listing.jobId || null,
    requisitionId: fields.get('job id') || listing.requisitionId || listing.jobId || null,
    sourceUrl,
    applyUrl: toKochUrl(extractFirst(/<a[^>]*href="([^"]+)"[^>]*>\s*Apply/i, html), sourceUrl || SEARCH_URL),
    employmentType: fields.get('worker type') || fields.get('employment type') || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

const fetchText = async (url, referer = SEARCH_URL) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: referer,
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 25
  let listingUrl = buildSearchUrl()

  for (let page = 0; page < maxPages && listingUrl; page += 1) {
    const listingHtml = await fetchText(listingUrl)
    const listings = extractSearchResults(listingHtml)
    const { nextUrl } = extractPaginationSummary(listingHtml, listingUrl)

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailHtml = await fetchText(listing.sourceUrl, listingUrl)
      const detail = extractJobDetail(detailHtml, listing)
      if (!isIndiaLocation(detail.location)) continue

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'Molex',
        department: detail.department || null,
        location: detail.location,
        city: detail.city,
        link: detail.applyUrl || detail.sourceUrl,
        applyUrl: detail.applyUrl,
        sourceUrl: detail.sourceUrl,
        source: 'molex',
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate,
        closingDate: detail.closingDate,
        scrapedAt: new Date().toISOString(),
      })
    }

    listingUrl = nextUrl
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
    await saveToDB(jobs, 'molex')
  }
}
