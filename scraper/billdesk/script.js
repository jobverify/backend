import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'billdesk'
export const COMPANY = 'BillDesk'
export const CAREERS_URL = 'https://www.billdesk.com/web/careers'
export const DETAIL_URL_PREFIX = 'https://www.billdesk.com/web/job_description/jd='

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (value) =>
  normalizeCity(normalizeWhitespace(String(value ?? '').split(',')[0])) || null

const createDetailUrl = (jobId) => `${DETAIL_URL_PREFIX}${jobId}`

export const pageIndicatesCareersShell = (html) => {
  const page = String(html ?? '')

  return (
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.billdesk\.com\/web\/careers["']/i.test(page)
    || /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.billdesk\.com["']/i.test(page)
  )
    && /billdesk/i.test(page)
    && /\/web\/assets\/index-[^"']+\.js/i.test(page)
}

export const extractBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/web\/assets\/index-[^"']+\.js)["']/i,
  )
  if (!match) return null

  return new URL(match[1], `${new URL(CAREERS_URL).origin}/`).toString()
}

export const bundleIndicatesCareerContent = (bundle) => {
  const page = String(bundle ?? '')

  return page.includes('"currentOpenings":[')
    && page.includes('careers@billdesk.com')
    && page.includes('/web/job_description/:job_id')
}

const extractJsonArrayLiteral = (bundle, marker) => {
  const text = String(bundle ?? '')
  const markerIndex = text.indexOf(marker)
  if (markerIndex === -1) return null

  const arrayStart = text.indexOf('[', markerIndex + marker.length)
  if (arrayStart === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = arrayStart; index < text.length; index += 1) {
    const character = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }

      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === '[') {
      depth += 1
      continue
    }

    if (character === ']') {
      depth -= 1
      if (depth === 0) {
        return text.slice(arrayStart, index + 1)
      }
    }
  }

  return null
}

const extractOpenings = (bundle) => {
  const arrayLiteral = extractJsonArrayLiteral(bundle, '"currentOpenings":')
  if (!arrayLiteral) return []

  try {
    const openings = JSON.parse(arrayLiteral)
    return Array.isArray(openings) ? openings : []
  } catch {
    return []
  }
}

const normalizeStringArray = (values) => {
  if (!Array.isArray(values)) return []

  return values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
}

export const extractJobsFromBundle = (bundle) => extractOpenings(bundle)
  .map((opening) => {
    const title = normalizeWhitespace(opening?.jobHeader || opening?.jobName)
    const jobId = normalizeWhitespace(opening?.jobId)
    const location = normalizeLocation(opening?.location)

    if (!title || !jobId) return null

    const requiredSkills = [
      ...normalizeStringArray(opening?.skills),
      ...normalizeStringArray(opening?.technology),
    ].filter((value, index, values) => values.indexOf(value) === index)

    const qualifications = normalizeStringArray(opening?.qualifications)
    const sourceUrl = createDetailUrl(jobId)

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(opening?.department),
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: normalizeWhitespace(opening?.experience),
      minimumQualification: qualifications.length > 0 ? qualifications.join(', ') : null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(opening?.description),
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)
  .sort((left, right) => Number.parseInt(right.jobId.slice(2), 10) - Number.parseInt(left.jobId.slice(2), 10))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createBillDeskScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!pageIndicatesCareersShell(careersHtml)) {
      throw new Error('BillDesk careers page no longer exposes the verified first-party careers shell')
    }

    const bundleUrl = extractBundleUrl(careersHtml)
    if (!bundleUrl) {
      throw new Error('BillDesk careers page no longer exposes the verified bundle URL')
    }

    const bundle = await fetchText(bundleUrl)
    if (!bundleIndicatesCareerContent(bundle)) {
      throw new Error('BillDesk careers bundle no longer exposes the verified embedded openings content')
    }

    const jobs = extractJobsFromBundle(bundle)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createBillDeskScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
