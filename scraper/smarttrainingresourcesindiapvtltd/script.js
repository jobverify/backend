import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'smarttrainingresourcesindiapvtltd'
export const COMPANY = 'SMART Training Resources India Pvt Ltd'
export const HOMEPAGE_URL = 'https://smartica.co.in/'
export const CAREERS_URL = 'https://smartica.co.in/careers'
export const CAREERS_API_URL = 'https://admin.smartica.co.in/api/careers-pages?_sort=id:DESC'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => normalizeString(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|strong|section|article|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const buildJobDescription = (...parts) => {
  const uniqueParts = []
  const seen = new Set()

  for (const part of parts.map(stripTags).filter(Boolean)) {
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    uniqueParts.push(part)
  }

  return uniqueParts.join(' ') || null
}

const extractCity = (location) => {
  const normalized = normalizeString(location)
  if (!normalized) return null

  return normalizeString(normalized.split(',')[0]?.replace(/\s*\(.+?\)\s*$/, ''))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/javascript,text/javascript;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialSiteShell = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Best Career Development Centre in Chennai \| Smart Resources India Pvt Ltd\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/smartica\.co\.in\/["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Smart Resources India Pvt Ltd["']/i.test(page)
    && /<meta[^>]+property=["']og:image:alt["'][^>]+content=["']SMART Training Resources India Pvt Ltd["']/i.test(page)
}

export const extractBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1], HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasVerifiedCareersBundle = (bundleText) => {
  const bundle = String(bundleText ?? '')

  return /path:\s*["']\/careers["']/i.test(bundle)
    && /https:\/\/admin\.smartica\.co\.in\/api\/careers-pages\?_sort=id:DESC/i.test(bundle)
    && /Apply Now/i.test(bundle)
}

const mapCareerRecord = (record = {}) => {
  const attributes = record?.attributes || {}
  const title = normalizeString(attributes.jobRole)
  const jobId = normalizeString(record?.id)
  const location = normalizeString(attributes.location)
  const city = extractCity(location)

  if (!title || !jobId || !location) return null

  return {
    title,
    company: COMPANY,
    department: normalizeString(attributes.department),
    location,
    city,
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: normalizeString(attributes.workType),
    experienceRequired: normalizeString(attributes.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeString(attributes.publishedAt),
    closingDate: null,
    jobDescription: buildJobDescription(attributes.shortDescription, attributes.description),
    salary: normalizeString(attributes.compensation),
  }
}

export const extractJobsFromPayload = (payload = {}) => {
  const records = payload?.data
  if (!Array.isArray(records)) {
    throw new Error('SMART Training Resources careers API no longer returns the verified public data array')
  }

  return records.map(mapCareerRecord).filter(Boolean)
}

export const createSmartTrainingResourcesIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialSiteShell(homepageHtml)) {
      throw new Error('SMART Training Resources verified official smartica site shell changed')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialSiteShell(careersHtml)) {
      throw new Error('SMART Training Resources careers route no longer matches the verified official smartica site shell')
    }

    const bundleUrl = extractBundleUrl(careersHtml)
    if (!bundleUrl) {
      throw new Error('SMART Training Resources careers route no longer exposes the verified first-party bundle')
    }

    const bundleText = await fetchText(bundleUrl)
    if (!hasVerifiedCareersBundle(bundleText)) {
      throw new Error('SMART Training Resources verified first-party careers bundle changed')
    }

    return extractJobsFromPayload(await fetchJson(CAREERS_API_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSmartTrainingResourcesIndiaScraper().run(options)

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
