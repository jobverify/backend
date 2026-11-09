import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const EXPERIENCED_OPENINGS_URL = 'https://www.aspiresys.com/openings?country=IN&Exp_level=Experienced'
export const FRESHER_OPENINGS_URL = 'https://www.aspiresys.com/openings?country=IN&Exp_level=Fresher'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null
  return new URL(value, 'https://www.aspiresys.com').toString()
}

const toIsoDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

export const buildSearchUrls = () => [
  EXPERIENCED_OPENINGS_URL,
  FRESHER_OPENINGS_URL,
]

export const extractListingJobs = (html) => {
  const jobs = []
  const pattern = /<div class="opening-oppourtunity">[\s\S]*?<h3><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h3>[\s\S]*?<span class="op-location">([\s\S]*?)<\/span>[\s\S]*?<span class="op-statename">([\s\S]*?)<\/span>[\s\S]*?<span class="op-job-type">([\s\S]*?)<\/span>[\s\S]*?<span class="op-exp-year">([\s\S]*?)<\/span>[\s\S]*?<div class="op-oppourtunity-description">([\s\S]*?)<\/div>[\s\S]*?<a href="([^"]+)">Apply now<\/a>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    jobs.push({
      detailUrl: toAbsoluteUrl(match[1]),
      title: normalizeWhitespace(match[2]),
      country: normalizeWhitespace(match[3]),
      cities: normalizeWhitespace(match[4]),
      employmentType: normalizeWhitespace(match[5]),
      experienceRequired: normalizeWhitespace(match[6]),
      summary: normalizeWhitespace(match[7]),
      applyUrl: toAbsoluteUrl(match[8]),
    })
  }

  return jobs
}

export const extractJobDetail = (html) => {
  const source = String(html ?? '')
  const title = normalizeWhitespace((source.match(/<h1><span>([\s\S]*?)<\/span>/i) || [])[1])
  const country = normalizeWhitespace((source.match(/<div class="job-locaiton[^"]*">([\s\S]*?)<\/div>/i) || [])[1])
  const jobId = normalizeWhitespace((source.match(/<div class="job-id[^"]*">\s*ID\s*([\s\S]*?)<\/div>/i) || [])[1])
  const employmentType = normalizeWhitespace((source.match(/<div class="job-type[^"]*">[\s\S]*?<div>([\s\S]*?)<\/div>[\s\S]*?<\/div>/i) || [])[1])
  const postingDate = toIsoDate((source.match(/<div class="job-submit-date[^"]*">([\d/]+)<\/div>/i) || [])[1])
  const jobDescription = normalizeWhitespace(
    (source.match(/<div class="row">\s*<div>([\s\S]*?)<\/div>\s*<\/div>\s*<div class="row opening-details-submit-section">/i) || [])[1],
  )
  const applyUrl = toAbsoluteUrl((source.match(/<div class="row opening-details-submit-section">\s*<a href="([^"]+)">/i) || [])[1])

  return {
    title,
    country,
    jobId,
    employmentType,
    postingDate,
    jobDescription,
    applyUrl,
  }
}

export const extractSearchResults = ({
  listingHtmlByUrl = {},
  detailHtmlByUrl = {},
} = {}) => {
  const deduped = new Map()

  for (const html of Object.values(listingHtmlByUrl)) {
    for (const listing of extractListingJobs(html)) {
      if (!listing.detailUrl || deduped.has(listing.detailUrl)) continue

      const detail = extractJobDetail(detailHtmlByUrl[listing.detailUrl] || '')
      const location = listing.country === 'India'
        ? `${listing.cities}, India`
        : normalizeWhitespace([listing.cities, listing.country].filter(Boolean).join(', '))

      deduped.set(listing.detailUrl, {
        title: detail.title || listing.title,
        company: 'Aspire Systems',
        department: null,
        location,
        city: normalizeWhitespace(listing.cities)?.split(',')[0]?.trim() || null,
        country: 'India',
        jobId: detail.jobId || listing.detailUrl.split('/').pop(),
        requisitionId: detail.jobId || listing.detailUrl.split('/').pop(),
        sourceUrl: listing.detailUrl,
        applyUrl: detail.applyUrl || listing.applyUrl,
        employmentType: detail.employmentType || listing.employmentType,
        experienceRequired: listing.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: detail.postingDate,
        closingDate: null,
        jobDescription: detail.jobDescription || listing.summary,
        remoteStatus: inferRemoteStatus(
          [detail.jobDescription, listing.summary].filter(Boolean).join(' '),
        ),
      })
    }
  }

  return [...deduped.values()]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'aspiresystems',
  timeoutMs: 15000,
})

export const createAspireSystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const listingHtmlByUrl = {}

    for (const url of buildSearchUrls()) {
      listingHtmlByUrl[url] = await fetchText(url)
    }

    const detailHtmlByUrl = {}
    const detailUrls = new Set(
      Object.values(listingHtmlByUrl).flatMap((html) =>
        extractListingJobs(html).map((job) => job.detailUrl),
      ),
    )

    await Promise.all([...detailUrls].map(async (url) => {
      detailHtmlByUrl[url] = await fetchText(url)
    }))

    const jobs = extractSearchResults({ listingHtmlByUrl, detailHtmlByUrl })
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'aspiresystems',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAspireSystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Aspire Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aspiresystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
