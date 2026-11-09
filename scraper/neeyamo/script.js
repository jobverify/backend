import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const LISTING_URL = 'https://www.neeyamo.com/careers'
export const COMPANY_NAME = 'Neeyamo'
export const COUNTRY_FILTER = 'India'
export const DETAIL_URL_PATTERN = 'https://www.neeyamo.com/job-postings/{slug}'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null
  return new URL(value, LISTING_URL).toString()
}

const getSlugFromUrl = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    return pathname.split('/').pop() || null
  } catch {
    return null
  }
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const extractPaneHtml = (html, paneId) => {
  const match = String(html ?? '').match(
    new RegExp(`<div class="careers-tab-pane"[^>]*id="${paneId}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
  )
  return match ? match[1] : ''
}

const extractPaneTexts = (html) => (
  [...String(html ?? '').matchAll(/<div class="careers-tab-pane"[^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
)

export const extractListingJobs = (html) => {
  const jobs = []
  let currentDepartment = null
  const tokenPattern = /<h3>([\s\S]*?)<\/h3>|<article role="article" about="([^"]+)" class="node node--type-careers[^"]*">[\s\S]*?<a href="([^"]+)">[\s\S]*?<div class="field-careers-title">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div class="field field--name-field-careers-location[^"]*">\s*([\s\S]*?)\s*<\/div>/gi

  for (const match of String(html ?? '').matchAll(tokenPattern)) {
    if (match[1]) {
      currentDepartment = normalizeWhitespace(match[1])
      continue
    }

    const detailPath = match[3] || match[2]
    jobs.push({
      title: normalizeWhitespace(match[4]),
      department: currentDepartment,
      country: normalizeWhitespace(match[5]),
      detailUrl: toAbsoluteUrl(detailPath),
    })
  }

  return jobs
}

export const extractJobDetail = (html, detailUrl) => {
  const source = String(html ?? '')
  const title = normalizeWhitespace((source.match(/<h1>([\s\S]*?)<\/h1>/i) || [])[1])
  const department = normalizeWhitespace((source.match(/field--name-field-careers-department[^>]*>\s*([\s\S]*?)\s*<\/div>/i) || [])[1])
  const city = normalizeWhitespace((source.match(/field--name-field-careers-city[^>]*>\s*([\s\S]*?)\s*<\/div>/i) || [])[1])
  const applyAnchor = normalizeWhitespace((source.match(/<a[^>]+href="(#apply-now)"[^>]*class="apply-now-button/i) || [])[1])
  const paneTexts = extractPaneTexts(source)
  const jobDescription = normalizeWhitespace(paneTexts.join(' '))
  const experienceSection = normalizeWhitespace(extractPaneHtml(source, 'tab-2'))
  const experienceRequired = normalizeWhitespace(
    (experienceSection?.match(/\b\d+\s*-\s*\d+\s+years[^.]*\./i) || [])[0],
  )

  return {
    title,
    department,
    city,
    experienceRequired,
    jobDescription,
    applyUrl: applyAnchor ? `${detailUrl}${applyAnchor}` : `${detailUrl}#apply-now`,
  }
}

export const extractSearchResults = ({
  listingHtml = '',
  detailHtmlByUrl = {},
} = {}) => {
  const listings = extractListingJobs(listingHtml)
    .filter((job) => job.country === COUNTRY_FILTER)

  return listings.map((listing) => {
    const detail = extractJobDetail(detailHtmlByUrl[listing.detailUrl] || '', listing.detailUrl)
    const slug = getSlugFromUrl(listing.detailUrl)
    const jobDescription = detail.jobDescription
      || normalizeWhitespace((detailHtmlByUrl[listing.detailUrl] || '').match(/<meta name="description" content="([^"]+)"/i)?.[1])

    return {
      title: detail.title || listing.title,
      company: COMPANY_NAME,
      department: detail.department || listing.department,
      location: detail.city ? `${detail.city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: detail.city || null,
      country: COUNTRY_FILTER,
      jobId: slug,
      requisitionId: slug,
      sourceUrl: listing.detailUrl,
      applyUrl: detail.applyUrl || `${listing.detailUrl}#apply-now`,
      employmentType: null,
      experienceRequired: detail.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: inferRemoteStatus(jobDescription),
    }
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'neeyamo',
  timeoutMs: 15000,
})

export const createNeeyamoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const listingHtml = await fetchText(LISTING_URL)
    const listingJobs = extractListingJobs(listingHtml)
      .filter((job) => job.country === COUNTRY_FILTER)

    const detailHtmlByUrl = {}
    await Promise.all(listingJobs.map(async (job) => {
      detailHtmlByUrl[job.detailUrl] = await fetchText(job.detailUrl)
    }))

    const jobs = extractSearchResults({ listingHtml, detailHtmlByUrl })
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'neeyamo',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createNeeyamoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Neeyamo scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'neeyamo')
    console.log('DB result:', result)
    process.exit(0)
  }
}
