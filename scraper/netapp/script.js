import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const SEARCH_BASE_URL = 'https://careers.netapp.com/search-jobs'
const INDIA_FILTER_VALUE = '1269750'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
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
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(value, 'https://careers.netapp.com').toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const getIndiaLocationSegments = (location) => String(location ?? '')
  .split(';')
  .map((segment) => normalizeWhitespace(segment))
  .filter((segment) => /india/i.test(segment || ''))

const normalizeIndiaLocation = (location) => {
  const indiaSegments = getIndiaLocationSegments(location)
  return indiaSegments[indiaSegments.length - 1] || null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(SEARCH_BASE_URL)
  url.searchParams.set('acm', 'ALL')
  url.searchParams.set('alrpm', INDIA_FILTER_VALUE)
  url.searchParams.set('ascf', JSON.stringify([{ key: 'ALL', value: '' }]))

  const pageNumber = Math.max(1, Number(page) || 1)
  if (pageNumber > 1) {
    url.searchParams.set('p', String(pageNumber))
  }

  return url.toString()
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<li>\s*<a href="[^"]+" data-job-id="[^"]+">[\s\S]*?<\/a>\s*(?:<button[\s\S]*?<\/button>)?\s*<\/li>/gi,
)]
  .map((match) => {
    const card = match[0]
    const sourcePath = normalizeWhitespace(extractFirst(/<a href="([^"]+)" data-job-id=/i, card))
    const jobId = normalizeWhitespace(extractFirst(/data-job-id="([^"]+)"/i, card))
    const title = stripTags(extractFirst(/<h3>([\s\S]*?)<\/h3>/i, card))
    const rawLocation = stripTags(extractFirst(/<span class="job-location[^"]*">([\s\S]*?)<\/span>/i, card))
    const location = normalizeIndiaLocation(rawLocation)
    const sourceUrl = toAbsoluteUrl(sourcePath)

    if (!jobId || !title || !location || !sourceUrl) return null

    return {
      title,
      company: 'NetApp',
      department: null,
      location,
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

export const extractPaginationSummary = (html) => {
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

  return {
    hasNext: /<a class="next"/i.test(String(html)),
    currentPage: Number.isFinite(currentPage) ? currentPage : null,
    totalPages: Number.isFinite(totalPages) ? totalPages : null,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
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
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null

  for (let page = 1; page <= maxPages; page += 1) {
    const html = await fetchText(buildSearchUrl({ page }))
    const listings = extractSearchResults(html)
    const summary = extractPaginationSummary(html)

    for (const job of listings) {
      if (seenJobIds.has(job.jobId)) continue
      seenJobIds.add(job.jobId)
      jobs.push({
        ...job,
        source: 'netapp',
        link: job.applyUrl || job.sourceUrl,
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running NetApp scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'netapp')
    console.log('DB result:', result)
    process.exit(0)
  }
}
