import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const SEARCH_BASE_URL = 'https://careers.arm.com/search-jobs'
const INDIA_FILTER_VALUE = '1269750'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(value, 'https://careers.arm.com').toString()
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

const parseJsonValue = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const flattenJsonLdNodes = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap((item) => flattenJsonLdNodes(item))
  if (typeof value !== 'object') return []

  return [
    value,
    ...flattenJsonLdNodes(value['@graph']),
  ]
}

const extractJobPosting = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]

  for (const match of scripts) {
    const parsed = parseJsonValue(match[1])
    if (!parsed) continue

    const jobPosting = flattenJsonLdNodes(parsed).find((node) => {
      const type = node?.['@type']
      return Array.isArray(type) ? type.includes('JobPosting') : type === 'JobPosting'
    })

    if (jobPosting) return jobPosting
  }

  return null
}

const inferExperienceRequired = (jobDescription) => {
  const experienceProfile = extractJobFilterSignals({
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    jobDescription,
  })?.experienceProfile

  if (experienceProfile?.confidence === 'high' && experienceProfile.evidence) {
    return normalizeWhitespace(
      experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
        ? 'No experience required'
        : experienceProfile.evidence,
    )
  }

  return null
}

export const extractJobDetailFromHtml = (html, listing = {}) => {
  const jobPosting = extractJobPosting(html)
  if (!jobPosting) return listing

  const jobDescription = stripTags(jobPosting.description)

  return {
    ...listing,
    title: normalizeWhitespace(jobPosting.title) || listing.title || null,
    location: normalizeWhitespace(
      jobPosting?.jobLocation?.[0]?.address?.addressLocality
        || jobPosting?.jobLocation?.address?.addressLocality,
    )
      ? `${normalizeWhitespace(
        jobPosting?.jobLocation?.[0]?.address?.addressLocality
          || jobPosting?.jobLocation?.address?.addressLocality,
      )}, India`
      : listing.location || null,
    city: normalizeWhitespace(
      jobPosting?.jobLocation?.[0]?.address?.addressLocality
        || jobPosting?.jobLocation?.address?.addressLocality,
    ) || listing.city || null,
    jobDescription: jobDescription || listing.jobDescription || null,
    experienceRequired: inferExperienceRequired(jobDescription) || listing.experienceRequired || null,
    postingDate: normalizeWhitespace(jobPosting.datePosted) || listing.postingDate || null,
  }
}

const mapWithConcurrency = async (items, limit, iteratee) => {
  const concurrency = Math.max(1, Number.isInteger(limit) ? limit : 1)
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
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
  /<li class="job-card[\s\S]*?<\/li>/gi,
)]
  .map((match) => {
    const card = match[0]
    const sourcePath = normalizeWhitespace(extractFirst(/<a class="job-card__title[^"]*" href="([^"]+)"/i, card))
    const jobId = normalizeWhitespace(extractFirst(/data-job-id="([^"]+)"/i, card))
    const title = normalizeWhitespace(extractFirst(/<a class="job-card__title[^"]*"[^>]*>([\s\S]*?)<\/a>/i, card))
    const location = normalizeWhitespace(extractFirst(/<span class="location">([\s\S]*?)<\/span>/i, card))
    const department = normalizeWhitespace(extractFirst(/<span class="category">([\s\S]*?)<\/span>/i, card))
    const sourceUrl = toAbsoluteUrl(sourcePath)

    if (!jobId || !title || !location || !sourceUrl || !/india/i.test(location)) {
      return null
    }

    return {
      title,
      company: 'Arm',
      department,
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

export const createArmScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText: fetchTextOverride = fetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchTextOverride(buildSearchUrl({ page }))
      const listings = extractSearchResults(html)
      const summary = extractPaginationSummary(html)

      for (const job of listings) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)

        if (maxJobs && jobs.length >= maxJobs) {
          break
        }
      }

      if ((maxJobs && jobs.length >= maxJobs) || !summary.hasNext || (summary.totalPages && page >= summary.totalPages)) {
        break
      }
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const enrichedJobs = await mapWithConcurrency(
      selectedJobs,
      6,
      async (job) => {
        try {
          const detailHtml = await fetchTextOverride(job.sourceUrl || job.applyUrl)
          return extractJobDetailFromHtml(detailHtml, job)
        } catch {
          return job
        }
      },
    )

    return enrichedJobs.map((job) => ({
      ...job,
      source: 'arm',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createArmScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Arm scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'arm')
    console.log('DB result:', result)
    process.exit(0)
  }
}
