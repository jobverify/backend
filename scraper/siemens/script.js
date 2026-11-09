import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const SEARCH_BASE_URL = 'https://jobs.siemens.com/en_US/externaljobs/SearchJobs'
const DEFAULT_PAGE_SIZE = 6

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#8226;/gi, '•')
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
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), SEARCH_BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const normalizeLocationText = (value) => normalizeWhitespace(value)
  ?.replace(/\s*-\s*/g, ', ')

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const getJobTypeValue = (jobType, employmentType) => {
  const primary = normalizeWhitespace(jobType)
  if (primary) return primary

  const fallback = normalizeWhitespace(employmentType)?.toLowerCase()
  if (!fallback) return null
  if (/permanent|regular|full/.test(fallback)) return 'Full-time'
  if (/part/.test(fallback)) return null
  if (/intern/.test(fallback)) return 'Internship'
  if (/contract|temporary|consultant/.test(fallback)) return 'Contract'
  return normalizeWhitespace(employmentType)
}

const getRemoteStatus = (workMode) => {
  const normalized = normalizeWhitespace(workMode)?.toLowerCase()
  if (!normalized) return null
  if (/remote/.test(normalized) && /hybrid/.test(normalized)) return 'Hybrid'
  if (/hybrid/.test(normalized)) return 'Hybrid'
  if (/remote/.test(normalized)) return 'Remote'
  if (/office|site|onsite|on-site/.test(normalized)) return 'On-site'
  return null
}

const extractFieldMap = (html) => {
  const fieldMap = new Map()

  for (const match of String(html).matchAll(
    /<div class="article__content__view__field[^"]*"[\s\S]*?<div class="article__content__view__field__label"[^>]*>\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div class="article__content__view__field__value">([\s\S]*?)<\/div>/gi,
  )) {
    const label = stripTags(match[1])
    const value = stripTags(match[2])
    if (label && value) {
      fieldMap.set(label, value)
    }
  }

  return fieldMap
}

const extractSkills = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildSearchUrl = ({ offset = 0, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const normalizedOffset = Math.max(0, Number(offset) || 0)
  const normalizedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)

  if (normalizedOffset === 0) {
    return SEARCH_BASE_URL
  }

  return `${SEARCH_BASE_URL}/?folderRecordsPerPage=${normalizedPageSize}&folderOffset=${normalizedOffset}`
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<article class="article article--result[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const article = match[0]
    const title = stripTags(extractFirst(
      /<h3 class="article__header__text__title[\s\S]*?<a class="link" href="[^"]+"[^>]*>([\s\S]*?)<\/a>/i,
      article,
    ))
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a class="link" href="([^"]+)"/i, article))
    const city = stripTags(extractFirst(/<span class="list-item-jobCity">([\s\S]*?)<\/span>/i, article))
    const state = stripTags(extractFirst(/<span class="list-item-jobState">([\s\S]*?)<\/span>/i, article))
    const country = stripTags(extractFirst(/<span class="list-item-jobCountry">([\s\S]*?)<\/span>/i, article))
    const jobId = normalizeWhitespace(
      extractFirst(/<span class="list-item-jobId">Job ID:\s*([\s\S]*?)<\/span>/i, article),
    )
    const department = stripTags(extractFirst(/<span class="list-item-family">([\s\S]*?)<\/span>/i, article))

    if (!title || !sourceUrl || !jobId || !country || !/india/i.test(country)) return null

    const location = [city, state, country].filter(Boolean).join(', ')

    return {
      title,
      company: 'Siemens',
      department,
      location: normalizeWhitespace(location),
      city: extractCity(location),
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

export const extractPaginationSummary = (html) => ({
  nextUrl: toAbsoluteUrl(
    extractFirst(
      /<li class="list-controls__pagination__item paginationNextLink">[\s\S]*?<a href="([^"]+)"/i,
      html,
    ),
  ),
})

export const extractJobDetail = (html, listing = {}) => {
  const fieldMap = extractFieldMap(html)
  const descriptionHtml = extractFirst(
    /<div class="article__content__view__field tf_replaceFieldVideoTokens">[\s\S]*?<div class="article__content__view__field__value">([\s\S]*?)<\/div>\s*<\/div>/i,
    html,
  )
  const rawLocation = fieldMap.get('Location(s)') || listing.location
  const normalizedLocation = normalizeLocationText(rawLocation) || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<meta property="og:title" content="([^"]+)"/i, html),
    ) || listing.title || null,
    company: 'Siemens',
    department: listing.department || null,
    location: normalizedLocation,
    city: extractCity(normalizedLocation),
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: toAbsoluteUrl(
      extractFirst(/<a class="button button--hero" href="([^"]+)"/i, html),
    ) || listing.applyUrl || listing.sourceUrl || null,
    employmentType: getJobTypeValue(fieldMap.get('Job type'), fieldMap.get('Employment type')),
    experienceRequired: null,
    experienceLevel: fieldMap.get('Experience level') || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractSkills(descriptionHtml),
    postingDate: null,
    closingDate: null,
    remoteStatus: getRemoteStatus(fieldMap.get('Work mode')),
    jobDescription: stripTags(descriptionHtml),
  }
}

const fetchText = async (url) => {
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

export const run = async () => {
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null
  const jobs = []
  const seenJobIds = new Set()
  let nextUrl = buildSearchUrl()
  let page = 0

  while (nextUrl && page < maxPages) {
    page += 1
    const html = await fetchText(nextUrl)
    const listings = extractSearchResults(html)
    const summary = extractPaginationSummary(html)

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue

      let job = listing

      try {
        const detailHtml = await fetchText(listing.sourceUrl)
        job = {
          ...listing,
          ...extractJobDetail(detailHtml, listing),
        }
      } catch {
        job = listing
      }

      seenJobIds.add(job.jobId)
      jobs.push({
        ...job,
        source: 'siemens',
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs
      }
    }

    nextUrl = summary.nextUrl
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Siemens scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'siemens')
    console.log('DB result:', result)
    process.exit(0)
  }
}
