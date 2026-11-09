import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import {readParadoxPreload, paradoxIndiaRows, createParadoxPublicScraper} from '../../scraper-support/shared/paradoxPublicInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://careers.gevernova.com/jobs'

const INDIA_LOCATION_PATTERN = /\b(?:india|in)\b/i

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

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const vernovaMatch = normalized.match(/^(.+?)\s+VERNOVA\b/i)
  if (vernovaMatch) return normalizeWhitespace(vernovaMatch[1])

  return normalizeWhitespace(normalized.split(',')[0])
}

const extractJobId = (url) => url?.match(/\/job\/([^/?#]+)/i)?.[1] || null

export const buildJobsPageUrl = (page = 1) =>
  Number.isInteger(page) && page > 1 ? `${CAREERS_URL}/page/${page}` : CAREERS_URL

export const pageHasOfficialJobsListing = (html) => {
  const value = String(html ?? '')
  return /\bopen jobs\b/i.test(value)
    && (
      /showing\s+\d+\s*-\s*\d+\s+of\s+\d+\s+jobs/i.test(value)
      || /showing\s+\{start_job\}\s*-\s*\{end_job\}\s+of\s+\{total\}\s+jobs/i.test(value)
    )
}

const extractJobCards = (html) => {
  const cards = [...String(html ?? '').matchAll(/<(?:article|li)\b[^>]*>([\s\S]*?)<\/(?:article|li)>/gi)]
  return cards.map((match) => match[1])
}

const extractArchivedIndiaJobs = (html) => extractJobCards(html)
  .map((card) => {
    const linkMatch = card.match(/<a\b[^>]*href="([^"]*\/job\/[^\"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    const locationMatch = card.match(/job\s+location\s*([\s\S]*?)(?:<\/[^>]+>|<time\b|\d{4}-\d{2}-\d{2})/i)
    const sourceUrl = toAbsoluteUrl(linkMatch?.[1])
    const title = normalizeWhitespace(linkMatch?.[2])
    const location = normalizeWhitespace(locationMatch?.[1])
    const postingDate = card.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})"/i)?.[1]
      || card.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
      || null
    const jobId = extractJobId(sourceUrl)

    if (!title || !location || !sourceUrl || !jobId || !INDIA_LOCATION_PATTERN.test(location)) {
      return null
    }

    return {
      title,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      postingDate,
    }
  })
  .filter(Boolean)

export const extractIndiaJobs = html => {
  const state = readParadoxPreload(html)
  if (!state) return extractArchivedIndiaJobs(html)
  return paradoxIndiaRows(state).map(row => ({
    jobId: row.reference, requisitionId: row.requisitionID || row.reference,
    title: row.title, company: 'GE Vernova',
    country: 'India', city: row.locations[0].city || null,
    location: row.locations[0].locationText,
    sourceUrl: new URL(row.originalURL, 'https://careers.gevernova.com/').href,
    applyUrl: row.applyURL, postingDate: null,
  }))
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

export const createGeVernovaScraper = () => ({
  async run({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildJobsPageUrl(page))
      if (!pageHasOfficialJobsListing(html)) {
        throw new Error('GE Vernova official jobs listing no longer matches the expected public surface')
      }

      for (const job of extractIndiaJobs(html)) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          company: 'GE Vernova',
          department: null,
          link: job.applyUrl,
          source: 'gevernova',
          employmentType: null,
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          jobDescription: null,
          closingDate: null,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createParadoxPublicScraper('gevernova').run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running GE Vernova scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'gevernova')
    console.log('DB result:', result)
    process.exit(0)
  }
}
