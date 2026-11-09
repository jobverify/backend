import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { KHEYTI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = KHEYTI_CATALOG.source
export const COMPANY = KHEYTI_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = KHEYTI_CATALOG.officialBrandName
export const VERIFIED_ON = KHEYTI_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = KHEYTI_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = KHEYTI_CATALOG
export const HOMEPAGE_URL = KHEYTI_CATALOG.homepageUrl
export const JOIN_PAGE_URL = KHEYTI_CATALOG.officialJoinPageUrl
export const JOBS_PAGE_URL = KHEYTI_CATALOG.officialJobsPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTML_ENTITY_REPLACEMENTS = [
  [/&amp;/gi, '&'],
  [/&nbsp;/gi, ' '],
  [/&#39;|&apos;/gi, '\''],
  [/&#34;|&quot;/gi, '"'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
]

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    decoded = decoded.replace(pattern, replacement)
  }

  return decoded
}

const stripTags = (value) => decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeWhitespace = (value) => {
  const normalized = stripTags(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (!/^[a-z][a-z\s-]*$/.test(normalized)) return normalized

  return normalized.replace(/\b[a-z]/g, (match) => match.toUpperCase())
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

const buildAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return new URL(normalized, JOBS_PAGE_URL).toString()
}

const extractField = (text, label) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const match = normalized.match(
    new RegExp(`${label}:\\s*(.+?)(?=\\s+(?:Location|Reporting to|Level|Key Responsibilities|Must-Haves|Nice-to-Haves|Hiring Process|Ideal Candidate)\\b|$)`, 'i'),
  )

  return normalizeWhitespace(match?.[1])
}

const extractLocationPartsFromDescription = (description) => {
  const locationText = extractField(description, 'Location')
  if (!locationText) return { city: null, state: null }

  const cleaned = locationText.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = cleaned.split(',').map((part) => normalizeTitleCase(part)).filter(Boolean)

  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1],
    }
  }

  return {
    city: parts[0] || null,
    state: null,
  }
}

const extractExperienceRequired = (description) => {
  const normalized = normalizeWhitespace(description)
  if (!normalized) return null

  const match = normalized.match(/(\d+\+?(?:\s*-\s*\d+\+?)?\s+Years?)(?:\s+of\s+experience)?/i)
  if (!match) return null

  return normalizeWhitespace(match[1])?.replace(/\bYears?\b/i, 'years') || null
}

export const hasOfficialJoinPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*We bring innovation in Indian agriculture\s*\|\s*Join Kheyti\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.kheyti\.com\/join-us["']/i.test(page)
    && /Employee testimonials/i.test(page)
    && /href=["']\/join-us["']/i.test(page)
    && /Apply now/i.test(page)
    && /1 million farmers/i.test(page)
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Kheyti Job Openings\s*<\/title>/i.test(page)
    && /Check out the latest job openings at Kheyti!/i.test(page)
    && /Current Job Openings/i.test(page)
    && /PortalDetail\.na/i.test(page)
    && /Apply Now/i.test(page)
}

export const extractJobsFromCareersPage = (html) => {
  const page = String(html ?? '')
  const jobs = []

  for (const rowMatch of page.matchAll(/<tr\b[^>]*id=["']zr-joblist-detail_(\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi)) {
    const [, rowId, rowHtml] = rowMatch
    const cells = [...rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
    const anchorMatch = rowHtml.match(/<a\b[^>]*class=["']jobdetail["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)

    const sourceUrl = buildAbsoluteUrl(anchorMatch?.[1])
    const title = normalizeWhitespace(anchorMatch?.[2])
    const cityFromRow = normalizeTitleCase(cells[1]?.[2])
    const descriptionAttr = cells[3]?.[1]?.match(/\btitle=(['"])([\s\S]*?)\1/i)?.[2]
    const jobDescription = normalizeWhitespace(descriptionAttr || cells[3]?.[2])
    const locationParts = extractLocationPartsFromDescription(jobDescription)
    const city = cityFromRow || locationParts.city
    const state = locationParts.state
    const country = city ? 'India' : null
    const location = [city, state, country].filter(Boolean).join(', ') || null

    if (!rowId || !title || !sourceUrl || !location) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId: rowId,
      requisitionId: rowId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(extractField(jobDescription, 'Job Type')),
      experienceRequired: extractExperienceRequired(jobDescription),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'kheyti',
  timeoutMs: 15000,
})

export const createKheytiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const joinPageHtml = await fetchText(JOIN_PAGE_URL)
    if (!hasOfficialJoinPageSignal(joinPageHtml)) {
      throw new Error('Response is not the verified official Kheyti join page')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsPageHtml)) {
      throw new Error('Response is not the verified public Kheyti jobs page')
    }

    const jobs = extractJobsFromCareersPage(jobsPageHtml)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createKheytiScraper().run(options)

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
