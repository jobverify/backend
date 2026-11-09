import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const ORIGIN = 'https://career.luxoft.com'
const SEARCH_PATH = '/jobs'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
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
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
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
    return new URL(decodeHtmlEntities(value), ORIGIN).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => normalizeWhitespace(location?.split(',')[0]) || null

const extractJobIdFromUrl = (value) => normalizeWhitespace(
  extractFirst(/-(\d+)(?:\/)?$/i, value),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null
  if (normalized === 'FULL_TIME') return 'Full-time'
  if (normalized === 'PART_TIME') return null
  if (normalized.includes('CONTRACT')) return 'Contract'
  if (normalized.includes('INTERN')) return 'Internship'
  return normalizeWhitespace(value)
}

const extractJobPostingStructuredData = (html) => {
  for (const match of String(html).matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed?.['@type'] === 'JobPosting') {
        return parsed
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep scanning.
    }
  }

  return null
}

const extractDetailSkills = (html) => {
  const section = extractFirst(
    /<div class="job__grid__about-job__skills">([\s\S]*?)<div class="job__grid__about-job__other">/i,
    html,
  )
  if (!section) return []

  return [...String(section).matchAll(
    /<div class="job__grid__about-job__skills__list__item">[\s\S]*?<p class="body-l-regular">\s*([\s\S]*?)\s*<\/p>/gi,
  )]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(SEARCH_PATH, ORIGIN)
  url.searchParams.set('keyword', '')
  url.searchParams.append('country[]', 'India')

  const pageNumber = Math.max(1, Number(page) || 1)
  if (pageNumber > 1) {
    url.searchParams.set('page', String(pageNumber))
  }

  return url.toString()
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<a href="([^"]+)" class="jobs__list__job">([\s\S]*?)<\/a>/gi,
)]
  .map((match) => {
    const sourceUrl = toAbsoluteUrl(match[1])
    const card = match[2]
    const locationParts = [...card.matchAll(/<p class="body-s-regular">\s*([\s\S]*?)\s*<\/p>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)
    const location = locationParts.length > 0 ? locationParts.join(', ') : null
    const jobId = extractJobIdFromUrl(sourceUrl)
    const title = normalizeWhitespace(extractFirst(/<h2 class="subtitle-l text-rich-black">\s*([\s\S]*?)\s*<\/h2>/i, card))

    if (!title || !sourceUrl || !jobId || !location || !/india/i.test(location)) {
      return null
    }

    return {
      title,
      company: 'Luxoft',
      department: normalizeWhitespace(
        extractFirst(/<p class="body-m-regular text-dark-gray">\s*([\s\S]*?)\s*<\/p>/i, card),
      ),
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
  const pageNumbers = [...String(html).matchAll(/pagination__link[^>]*>\s*(\d+)\s*<\/a>/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)
  const currentPage = Number.parseInt(
    normalizeWhitespace(
      extractFirst(/<a[^>]*pagination__link[^>]*active[^>]*>\s*(\d+)\s*<\/a>/i, html),
    ) || '',
    10,
  )
  const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null

  return {
    hasNext: Boolean(totalPages && (Number.isFinite(currentPage) ? currentPage < totalPages : totalPages > 1)),
    currentPage: Number.isFinite(currentPage) ? currentPage : null,
    totalPages,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJobPostingStructuredData(html)
  const sourceUrl = listing.sourceUrl || toAbsoluteUrl(
    extractFirst(/<link rel="canonical" href="([^"]+)"/i, html),
  )
  const jobId = listing.jobId || extractJobIdFromUrl(sourceUrl)
  const jobDescription = stripTags(
    extractFirst(
      /<div class="job__grid__about-job">([\s\S]*?)<div class="job__grid__job-related">/i,
      html,
    ) || jobPosting?.description,
  )

  return {
    title: normalizeWhitespace(jobPosting?.title)
      || normalizeWhitespace(extractFirst(/<p class="job-header__title body-xl-semibold">\s*([\s\S]*?)\s*<\/p>/i, html))
      || listing.title
      || null,
    company: listing.company || normalizeWhitespace(jobPosting?.hiringOrganization?.name) || 'Luxoft',
    department: listing.department || null,
    location: listing.location || null,
    city: listing.city || extractCity(listing.location),
    jobId,
    requisitionId: normalizeWhitespace(jobPosting?.identifier?.value)
      || normalizeWhitespace(extractFirst(/Req\.\s*([A-Z0-9-]+)/i, html))
      || listing.requisitionId
      || jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractDetailSkills(html),
    postingDate: normalizeWhitespace(jobPosting?.datePosted) || null,
    closingDate: null,
    jobDescription,
  }
}

const defaultFetchText = async (url) => {
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

export const createLuxoftScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildSearchUrl({ page }))
      const listings = extractSearchResults(html)
      const summary = extractPaginationSummary(html)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

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

        jobs.push({
          ...job,
          source: 'luxoft',
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
  },
})

export const run = async () => createLuxoftScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Luxoft scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'luxoft')
    console.log('DB result:', result)
    process.exit(0)
  }
}
