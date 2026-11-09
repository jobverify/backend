import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateSourceDescriptions, sourceDescriptionFromPosting } from '../../scraper-support/utils/sourceDescriptionHydration.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const SEARCH_BASE_URL = 'https://careers.synopsys.com/search-jobs'
const INDIA_FILTER_VALUE = '1269750'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x276F;|&#10095;/gi, '')

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
    return new URL(value, 'https://careers.synopsys.com').toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
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
  /<li class="search-results-list__list-item">[\s\S]*?<\/li>/gi,
)]
  .map((match) => {
    const card = match[0]
    const sourcePath = normalizeWhitespace(extractFirst(/<a class="sr-job-link" href="([^"]+)"/i, card))
    const title = stripTags(extractFirst(/<h2>([\s\S]*?)<\/h2>/i, card))
    const location = stripTags(extractFirst(/<span class="job-location">([\s\S]*?)<\/span>/i, card))
    const department = normalizeWhitespace(
      stripTags(extractFirst(/<span class="category">([\s\S]*?)<\/span>/i, card))
        ?.replace(/^Category:\s*/i, ''),
    )
    const postingDate = normalizeWhitespace(
      stripTags(extractFirst(/<span class="job-date-posted">([\s\S]*?)<\/span>/i, card))
        ?.replace(/^Posted:\s*/i, ''),
    )
    const requisitionId = normalizeWhitespace(
      stripTags(extractFirst(/<span class="jobId">([\s\S]*?)<\/span>/i, card))
        ?.replace(/^Job ID:\s*/i, ''),
    )
    const sourceUrl = toAbsoluteUrl(sourcePath)

    if (!title || !location || !requisitionId || !sourceUrl || !/india/i.test(location)) {
      return null
    }

    return {
      title,
      company: 'Synopsys',
      department,
      location,
      city: extractCity(location),
      jobId: requisitionId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
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

const fetchText = async (url, { signal, includeResponseMetadata = false } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  return includeResponseMetadata ? { html, status: response.status, url: response.url } : html
}

export const run = async (options = {}) => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = options.maxPages ?? (Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY)
  const maxJobs = options.maxJobs ?? (Number.isInteger(config.maxJobs) ? config.maxJobs : null)
  const getPage = options.fetchText || fetchText
  const finish = () => hydrateSourceDescriptions(jobs, {
    signal: options.signal, detailEnrichmentBudgetMs: options.detailEnrichmentBudgetMs,
    fetchDetail: async (job, { signal }) => sourceDescriptionFromPosting(job,
      await getPage(job.sourceUrl, { signal, includeResponseMetadata: true })),
  })

  for (let page = 1; page <= maxPages; page += 1) {
    options.signal?.throwIfAborted()
    const html = await getPage(buildSearchUrl({ page }), { signal: options.signal })
    const listings = extractSearchResults(html)
    const summary = extractPaginationSummary(html)

    for (const job of listings) {
      if (seenJobIds.has(job.jobId)) continue
      seenJobIds.add(job.jobId)
      jobs.push({
        ...job,
        source: 'synopsys',
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })

      if (maxJobs && jobs.length >= maxJobs) {
        return finish()
      }
    }

    if (!summary.hasNext || (summary.totalPages && page >= summary.totalPages)) {
      break
    }
  }

  return finish()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Synopsys scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'synopsys')
    console.log('DB result:', result)
    process.exit(0)
  }
}
