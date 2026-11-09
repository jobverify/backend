import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { APNA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = APNA_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_ENTRY_URL = PROVIDER_METADATA.careersEntryUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_FEED_URL = PROVIDER_METADATA.jobsFeedUrl
export const VERIFIED_JOB_URL = PROVIDER_METADATA.verifiedJobUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DETAIL_FETCH_CONCURRENCY = 4

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\r/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^[-—–]+$/.test(normalized)) return null
  return normalized
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

const extractAttributeValue = (tag, attributeName) => {
  const escapedName = escapeRegex(attributeName)
  const doubleQuoted = extractFirst(new RegExp(`${escapedName}\\s*=\\s*"([^"]*)"`, 'i'), tag)
  if (doubleQuoted != null) return normalizeOptionalValue(doubleQuoted)

  const singleQuoted = extractFirst(new RegExp(`${escapedName}\\s*=\\s*'([^']*)'`, 'i'), tag)
  if (singleQuoted != null) return normalizeOptionalValue(singleQuoted)

  return null
}

const extractMetaContent = (key, html = '') => {
  for (const match of String(html ?? '').matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    const property = extractAttributeValue(tag, 'property')
    const name = extractAttributeValue(tag, 'name')

    if (property !== key && name !== key) {
      continue
    }

    const content = extractAttributeValue(tag, 'content')
    if (content) {
      return content
    }
  }

  return null
}

const normalizeDetailSummary = (value) => normalizeOptionalValue(
  String(value ?? '')
    .replace(/(?<!^)(Company:|Role:|Team:|Requirement:|Location:|Experience:|Why Join Apna|About Company|Description)/g, ' $1')
    .replace(/([a-z0-9)])(Why Join Apna|About Company|Description)/g, '$1 $2'),
)

const formatExperienceNumber = (value) => {
  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return null

  return Number.isInteger(numeric)
    ? String(numeric)
    : String(numeric).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1')
}

const extractExperienceFromSummary = (summary = '') => {
  const normalized = normalizeOptionalValue(summary)
  if (!normalized) return null

  const boundedMatch = normalized.match(
    /\bExperience\s*:?\s*(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*Years?\s+of\s+Experience\b/i,
  )
  if (boundedMatch) {
    return `${formatExperienceNumber(boundedMatch[1])}-${formatExperienceNumber(boundedMatch[2])} years`
  }

  const openEndedMatch = normalized.match(
    /\bExperience\s*:?\s*(\d+(?:\.\d+)?)\s*(\+|plus)\s*Years?\s+of\s+Experience\b/i,
  )
  if (openEndedMatch) {
    return `${formatExperienceNumber(openEndedMatch[1])}+ years`
  }

  const exactMatch = normalized.match(
    /\bExperience\s*:?\s*(\d+(?:\.\d+)?)\s*Years?\s+of\s+Experience\b/i,
  )
  if (exactMatch) {
    const formattedValue = formatExperienceNumber(exactMatch[1])
    return formattedValue === '1' ? '1 year' : `${formattedValue} years`
  }

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile

  if (!experienceProfile || experienceProfile.confidence !== 'high') {
    return null
  }

  if (experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0) {
    return 'No experience required'
  }

  return normalizeOptionalValue(experienceProfile.evidence)
}

const extractPublicJobMetadata = (html = '') => {
  const summary = normalizeDetailSummary(
    extractMetaContent('description', html) || extractMetaContent('og:description', html),
  )

  return {
    jobDescription: summary,
    experienceRequired: extractExperienceFromSummary(summary),
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.8',
  },
  label: 'apna jobs feed',
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(getFinalUrl(page, CAREERS_ENTRY_URL))
  const rawHtml = String(html ?? '')

  return status === 200
    && finalUrl === normalizeUrl(CAREERS_URL)
    && /<title[^>]*>\s*Apna - Current Openings\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/careers\.apna\.co["']/i.test(rawHtml)
    && /window\.careers\s*=/i.test(rawHtml)
    && /hasCustomDomain/i.test(rawHtml)
    && /apply\.workable\.com\/apna/i.test(rawHtml)
}

export const hasOfficialJobsFeedSignal = (markdown) => {
  const value = String(markdown ?? '')

  return /^#\s*Apna\s*[—-]\s*(?:All\s+)?Open Positions/im.test(value)
    && /^>\s*Last updated:/im.test(value)
    && /^\|\s*Title\s*\|\s*Department\s*\|\s*Location\s*\|\s*Type\s*\|\s*Salary\s*\|\s*Posted\s*\|\s*Details\s*\|/im.test(value)
}

const splitMarkdownRow = (line) => {
  const cells = []
  let current = ''
  let escaping = false

  for (const char of String(line ?? '')) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (char === '|') {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  if (escaping) current += '\\'
  cells.push(current)

  if (cells[0]?.trim() === '') cells.shift()
  if (cells.at(-1)?.trim() === '') cells.pop()

  return cells.map((cell) => normalizeWhitespace(cell))
}

const extractMarkdownLink = (value) => {
  const match = String(value ?? '').match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i)
  if (match?.[1]) return match[1]

  const fallback = String(value ?? '').match(/https?:\/\/\S+/i)
  return fallback?.[0] || null
}

const stripTrailingWorkMode = (value) => normalizeWhitespace(value).replace(/\s+\(([^)]+)\)\s*$/, '')

const parseLocation = (value) => {
  const location = normalizeOptionalValue(value)
  const cleanLocation = location ? stripTrailingWorkMode(location) : null
  const parts = cleanLocation
    ? cleanLocation.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
    : []

  return {
    location,
    city: parts[0] || null,
    state: parts.length >= 3 ? parts[1] : null,
    country: parts.at(-1) || null,
  }
}

const isIndiaLocation = (value) => /\bIndia\b/i.test(String(value ?? ''))

export const extractJobIdFromDetailsUrl = (value) => {
  const match = String(value ?? '').match(/\/view\/([A-Z0-9]+)(?:\.md)?$/i)
  return match?.[1]?.toUpperCase() || null
}

const buildJobUrl = (jobId) => `https://careers.apna.co/_/j/${jobId}`
const buildApplyUrl = (jobId) => `${buildJobUrl(jobId)}/apply`

const normalizeEmploymentType = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (/full[\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[\s-]?time/i.test(normalized)) return 'Part-time'
  if (/intern/i.test(normalized)) return 'Internship'
  if (/contract/i.test(normalized)) return 'Contract'
  return normalized
}

const normalizePostingDate = (value) => {
  const normalized = normalizeOptionalValue(value)
  return normalized || null
}

export const extractJobsFromMarkdown = (markdown) => {
  const jobs = []
  const seenJobIds = new Set()

  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine.startsWith('|')) continue
    if (/^\|\s*Title\s*\|/i.test(trimmedLine)) continue
    if (/^\|\s*:?-{2,}/.test(trimmedLine)) continue

    const cells = splitMarkdownRow(trimmedLine)
    if (cells.length < 7) continue

    const detailsCell = cells.at(-1)
    const postedCell = cells.at(-2)
    const typeCell = cells.at(-4)
    const locationCell = cells.at(-5)
    const departmentCell = cells.at(-6)
    const titleCell = cells.slice(0, -6).join(' | ')
    const detailsUrl = extractMarkdownLink(detailsCell)
    const jobId = extractJobIdFromDetailsUrl(detailsUrl)
    const locationBits = parseLocation(locationCell)

    if (!titleCell || !detailsUrl || !jobId || !isIndiaLocation(locationBits.location)) continue
    if (seenJobIds.has(jobId)) continue

    seenJobIds.add(jobId)
    jobs.push({
      title: normalizeWhitespace(titleCell),
      company: COMPANY_NAME,
      department: normalizeOptionalValue(departmentCell),
      location: locationBits.location,
      city: locationBits.city,
      state: locationBits.state,
      country: locationBits.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: buildJobUrl(jobId),
      applyUrl: buildApplyUrl(jobId),
      employmentType: normalizeEmploymentType(typeCell),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizePostingDate(postedCell),
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Apna scraper')
  }

  return parsed.toISOString()
}

export const createApnaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const fetchText = options.fetchText || defaultFetchText
    const careersPage = await fetchPage(CAREERS_ENTRY_URL)

    if (!hasOfficialCareersSignal(careersPage)) {
      throw new Error('Apna verified official careers handoff no longer matches the trusted public surface')
    }

    const jobsMarkdown = await fetchText(JOBS_FEED_URL)
    if (!hasOfficialJobsFeedSignal(jobsMarkdown)) {
      throw new Error('Apna verified jobs feed no longer matches the trusted public surface')
    }

    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    const jobs = extractJobsFromMarkdown(jobsMarkdown)
    const selectedJobs = limit ? jobs.slice(0, limit) : jobs
    const scrapedAt = normalizeScrapedAt((options.now || now)())

    const decoratedJobs = selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))

    return mapWithConcurrency(
      decoratedJobs,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          const detailPage = await fetchPage(job.sourceUrl)
          if (Number(detailPage?.status) !== 200 || !detailPage?.html) {
            return job
          }

          const detail = extractPublicJobMetadata(detailPage.html)
          return {
            ...job,
            jobDescription: detail.jobDescription || job.jobDescription,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
            publicExperienceChecked: true,
          }
        } catch {
          return job
        }
      },
    )
  },
})

export const run = async (options = {}) => createApnaScraper().run(options)

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
