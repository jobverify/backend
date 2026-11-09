import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.amrita.edu/jobs/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|span|a)>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#8211;|&#x2013;/gi, '–')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const toIsoDateOnly = (value) => {
  const match = String(value ?? '').match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (!match) return null

  const monthLookup = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  }

  const month = monthLookup[match[1]]
  if (month == null) return null

  return new Date(Date.UTC(Number(match[3]), month, Number(match[2]))).toISOString()
}

const extractUpdatedAt = (html) => {
  const match = String(html ?? '').match(/<meta[^>]+property="og:updated_time"[^>]+content="([^"]+)"/i)
  return toIsoDate(match?.[1])
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const ensureIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/india/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractSlug = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const extractRequisitionId = (url, fallback) => {
  try {
    return new URL(url).searchParams.get('jid') || fallback
  } catch {
    return fallback
  }
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractSearchResults = (html) => {
  const postingDate = extractUpdatedAt(html)
  const jobs = []
  const pattern = /<li>\s*<div class="position"><a href="([^"]+)">([\s\S]*?)<\/a><\/div>\s*<div class="place"><span>([\s\S]*?)<\/span>([\s\S]*?)<\/div>\s*<div class="aply-bnt">([\s\S]*?)<\/div>\s*<\/li>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const sourceUrl = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const department = normalizeWhitespace(match[3])
    const city = normalizeWhitespace(match[4])
    const actionsHtml = match[5]
    const applyUrl = normalizeWhitespace(actionsHtml.match(/<a href="([^"]+)" class="btn btn-bordered">\s*Apply now\s*<\/a>/i)?.[1]) || sourceUrl
    const closingDate = toIsoDateOnly(normalizeWhitespace(actionsHtml.match(/Closing date\s*:\s*<span>([^<]+)<\/span>/i)?.[1]))
    const jobId = extractSlug(sourceUrl)

    if (!sourceUrl || !title || !city || !jobId) continue

    jobs.push({
      title,
      company: 'Amrita Vishwa Vidyapeetham',
      department,
      location: ensureIndiaLocation(city),
      city,
      country: 'India',
      jobId,
      requisitionId: extractRequisitionId(applyUrl, jobId),
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate,
      jobDescription: normalizeWhitespace(`Campus: ${city}${department ? ` | Unit: ${department}` : ''}`),
      remoteStatus: inferRemoteStatus(city),
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'amrita',
  timeoutMs: 15000,
})

export const createAmritaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'amrita',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAmritaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Amrita scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'amrita')
    console.log('DB result:', result)
    process.exit(0)
  }
}
