import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://axelor.com/job-offers/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[â€“â€”]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREER_PAGE_URL).toString()
  } catch {
    return null
  }
}

const toJobId = (url) => {
  const normalized = toAbsoluteUrl(url)
  if (!normalized) return null

  try {
    const pathname = new URL(normalized).pathname.replace(/\/+$/, '')
    return pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

export const buildSearchUrl = (page = 1) =>
  Number(page) > 1
    ? `${CAREER_PAGE_URL}?_job_offers_pagination=${Number(page)}`
    : CAREER_PAGE_URL

export const extractTotalPages = (html) => {
  const pageNumbers = [...String(html ?? '').matchAll(/data-page="(\d+)"/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isInteger)

  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1
}

export const extractSearchResults = (html) => {
  const pattern = /<article class="wpgb-card[\s\S]*?<div class="wpgb-block-1">\s*<span class="wpgb-block-term"[^>]*>([^<]+)<\/span>\s*<span>\s*-\s*<\/span>\s*<span class="wpgb-block-term"[^>]*>([^<]+)<\/span>[\s\S]*?<a class="wpgb-block-2" href="([^"]+)">([\s\S]*?)<\/a>/gi

  return [...String(html ?? '').matchAll(pattern)]
    .map((match) => {
      const city = normalizeWhitespace(match[1])
      const country = normalizeWhitespace(match[2])
      const sourceUrl = toAbsoluteUrl(match[3])
      const title = normalizeWhitespace(match[4])
      const jobId = toJobId(sourceUrl)

      if (!city || !country || !sourceUrl || !title || !jobId) return null
      if (!/^india$/i.test(country)) return null

      return {
        title,
        company: 'Axelor',
        department: null,
        location: `${city}, India`,
        city,
        country: 'India',
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
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'axelor',
  timeoutMs: 15000,
})

export const createAxelorScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const firstPageHtml = await fetchText(CAREER_PAGE_URL)
    const totalPages = extractTotalPages(firstPageHtml)
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= totalPages; page += 1) {
      const pageHtml = page === 1 ? firstPageHtml : await fetchText(buildSearchUrl(page))
      const pageJobs = extractSearchResults(pageHtml)

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'axelor',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAxelorScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Axelor scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'axelor')
    console.log('DB result:', result)
    process.exit(0)
  }
}
