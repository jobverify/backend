import {createPublicWorkableSource,PUBLIC_WORKABLE_PROFILES} from '../../scraper-support/native-sources/publicWorkableSources/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { SEEQ_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKABLE_BOARD_URL = PROVIDER_METADATA.workableBoardUrl
export const JOBS_FEED_URL = PROVIDER_METADATA.jobsFeedUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^[-—]+$/.test(normalized)) return null
  return normalized
}

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/markdown,text/plain;q=0.8,*/*;q=0.7',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const parseLocation = (value) => {
  const location = normalizeOptionalValue(value)
  const cleanLocation = location
    ? location.replace(/\s+\(([^)]+)\)\s*$/, '')
    : null
  const parts = String(cleanLocation ?? '')
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  const isCountryOnly = parts.length === 1 && /india/i.test(parts[0] || '')

  return {
    location,
    city: isCountryOnly ? null : (parts[0] || null),
    state: parts.length >= 3 ? parts[1] : null,
    country: parts.at(-1) || null,
  }
}

const isIndiaLocation = (value) => /(^|[\s,(])india($|[\s,).])/i.test(String(value ?? ''))

const ensureTrailingSlash = (value) => {
  const normalized = String(value ?? '').trim()
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const extractJobId = (url) => {
  const viewMatch = String(url ?? '').match(/\/jobs\/view\/([A-Z0-9]+)(?:\.md)?(?:[?#].*)?$/i)
  if (viewMatch?.[1]) return viewMatch[1].toUpperCase()

  const publicMatch = String(url ?? '').match(/\/j\/([A-Z0-9]+)\/?(?:apply)?(?:[?#].*)?$/i)
  return publicMatch?.[1]?.toUpperCase() || null
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Seeq scraper')
  }

  return parsed.toISOString()
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers: Join our Team \| Seeq\s*<\/title>/i.test(page)
    && /Help change manufacturing for the better/i.test(page)
    && page.includes(WORKABLE_BOARD_URL)
    && /See Openings/i.test(page)
}

export const hasOfficialWorkableBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Seeq\s*-\s*Current Openings\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/apply\.workable\.com\/seeq\/["'][^>]*>/i.test(page)
    && /<meta[^>]+name=["']subdomain["'][^>]+content=["']seeq["'][^>]*>/i.test(page)
    && /window\.careers\s*=/i.test(page)
}

export const hasOfficialJobsFeedSignal = (markdown = '') => {
  const value = String(markdown ?? '')

  return /^#\s*Seeq\s*[—-]\s*(?:All Open Positions|Current Openings)/im.test(value)
    && (
      (
        /^>\s*Last updated:/im.test(value)
        && /^\|\s*Title\s*\|\s*Department\s*\|\s*Location\s*\|\s*Type\s*\|\s*Salary\s*\|\s*Posted\s*\|\s*Details\s*\|/im.test(value)
      )
      || /^\d+\s+current openings?/im.test(value)
    )
    && /Powered by\s+\[Workable\]\(https:\/\/www\.workable\.com\)/i.test(value)
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

const normalizeEmploymentType = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (/full[\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[\s-]?time/i.test(normalized)) return 'Part-time'
  if (/intern/i.test(normalized)) return 'Internship'
  if (/contract/i.test(normalized)) return 'Contract'
  return normalized
}

const buildPublicJobUrl = (jobId, rawUrl) => {
  if (/\/j\/[A-Z0-9]+\/?$/i.test(String(rawUrl ?? ''))) {
    return ensureTrailingSlash(rawUrl)
  }

  return `${WORKABLE_BOARD_URL}j/${jobId}/`
}

const buildApplyUrl = (sourceUrl) => `${ensureTrailingSlash(sourceUrl)}apply`

const parseMarkdownJobLine = (line) => {
  const bulletMatch = /^-\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*-\s*(.+)$/i.exec(line)
  if (bulletMatch) {
    const [, rawTitle, rawUrl, rawLocation] = bulletMatch
    return {
      rawTitle,
      rawUrl,
      rawLocation,
      department: null,
      employmentType: null,
      postingDate: null,
    }
  }

  const trimmed = String(line ?? '').trim()
  if (!trimmed.startsWith('|')) return null
  if (/^\|\s*Title\s*\|/i.test(trimmed)) return null
  if (/^\|\s*:?-{2,}/.test(trimmed)) return null

  const cells = splitMarkdownRow(trimmed)
  if (cells.length < 7) return null

  const detailsCell = cells.at(-1)
  const postedCell = cells.at(-2)
  const typeCell = cells.at(-4)
  const locationCell = cells.at(-5)
  const departmentCell = cells.at(-6)
  const titleCell = cells.slice(0, -6).join(' | ')

  return {
    rawTitle: titleCell,
    rawUrl: extractMarkdownLink(detailsCell),
    rawLocation: locationCell,
    department: normalizeOptionalValue(departmentCell),
    employmentType: normalizeEmploymentType(typeCell),
    postingDate: normalizeOptionalValue(postedCell),
  }
}

export const extractJobsFromMarkdown = (markdown = '') => {
  const jobs = []
  const seenJobIds = new Set()

  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const parsed = parseMarkdownJobLine(line)
    if (!parsed) continue

    const locationBits = parseLocation(parsed.rawLocation)
    const jobId = extractJobId(parsed.rawUrl)
    if (!parsed.rawTitle || !jobId || !isIndiaLocation(locationBits.location)) continue
    if (seenJobIds.has(jobId)) continue

    const sourceUrl = buildPublicJobUrl(jobId, parsed.rawUrl)
    seenJobIds.add(jobId)
    jobs.push({
      title: normalizeWhitespace(parsed.rawTitle),
      company: COMPANY,
      location: locationBits.location,
      city: locationBits.city,
      state: locationBits.state,
      country: locationBits.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: buildApplyUrl(sourceUrl),
      department: parsed.department,
      employmentType: parsed.employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: parsed.postingDate,
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs
}

export const createSeeqScraper = (options = {}) => createPublicWorkableSource(PUBLIC_WORKABLE_PROFILES.find(p => p.source === 'seeq'), options)

export const run = async (options = {}) => createSeeqScraper(options).run(options)

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
