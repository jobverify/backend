import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const CAREERS_ORIGIN = 'https://careers.tesco.com'
const SEARCH_PATH = '/en_GB/careers/SearchJobs/'
const JOB_DETAIL_PATH = '/en_GB/careers/JobDetail/'

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

const toTescoUrl = (value, baseUrl = CAREERS_ORIGIN) => {
  if (!value) return null
  try {
    const url = new URL(value.replace(/&amp;/gi, '&'), baseUrl)
    return url.origin === CAREERS_ORIGIN ? url.toString() : null
  } catch {
    return null
  }
}

const isTescoDetailUrl = (url) => {
  const parsed = toTescoUrl(url)
  return parsed && new URL(parsed).pathname.startsWith(JOB_DETAIL_PATH) ? parsed : null
}

const isIndiaLocation = (location) => /(?:^|[,;\s])india(?:$|[,;\s])/i.test(location || '')

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

export const buildSearchUrl = (joboffset = 0) => {
  const url = new URL(`${CAREERS_ORIGIN}${SEARCH_PATH}`)
  url.searchParams.set('joboffset', String(joboffset))
  return url.toString()
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*article--result[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const card = match[0]
    const title = normalizeWhitespace(extractFirst(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i, card))
    const sourceUrl = isTescoDetailUrl(extractFirst(/<a[^>]*href="([^"]+)"/i, card))
    const jobId = extractFirst(/\/([^/?#]+)(?:[/?#]|$)/, sourceUrl ? new URL(sourceUrl).pathname : '')
    const subtitles = [...card.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const location = subtitles.at(-1) || null

    if (!title || !sourceUrl || !jobId || !isIndiaLocation(location)) return null

    return {
      title,
      department: subtitles[0] || null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const fields = extractFieldMap(html)
  const location = normalizeWhitespace(
    extractFirst(/article__header--locations[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i, html),
  ) || fields.get('locations') || fields.get('location') || listing.location || null
  const sourceUrl = isTescoDetailUrl(listing.sourceUrl)
  const applyUrl = toTescoUrl(
    extractFirst(/<a[^>]*href="([^"]+)"[^>]*>\s*Apply/i, html),
    sourceUrl || buildSearchUrl(),
  )

  return {
    title: normalizeWhitespace(extractFirst(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i, html)) || listing.title || null,
    department: fields.get('department') || listing.department || null,
    location,
    city: extractCity(location),
    country: isIndiaLocation(location) ? 'India' : null,
    jobId: fields.get('job id') || listing.jobId || null,
    requisitionId: fields.get('job id') || listing.requisitionId || listing.jobId || null,
    sourceUrl,
    applyUrl,
    employmentType: fields.get('worker type') || fields.get('employment type') || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: fields.get('description') || null,
  }
}

const fetchText = async (url, referer = buildSearchUrl()) => {
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

export const run = async ({ maxPages = config.maxPages, pageSize = 10, fetchText: getHtml = fetchText } = {}) => {
  const jobs = []
  const seenJobIds = new Set()
  const boundedPages = Math.max(0, Number.isInteger(maxPages) ? maxPages : 25)

  for (let page = 0; page < boundedPages; page += 1) {
    const listingUrl = buildSearchUrl(page * pageSize)
    const listings = extractSearchResults(await getHtml(listingUrl))

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detail = extractJobDetail(await getHtml(listing.sourceUrl, listingUrl), listing)
      if (!isIndiaLocation(detail.location) || !detail.sourceUrl || !detail.applyUrl) continue

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'Tesco',
        department: detail.department,
        location: detail.location,
        city: detail.city,
        country: 'India',
        link: detail.applyUrl,
        applyUrl: detail.applyUrl,
        sourceUrl: detail.sourceUrl,
        source: 'tesco',
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
    await saveToDB(jobs, 'tesco')
  }
}
