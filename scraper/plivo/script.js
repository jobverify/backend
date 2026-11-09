import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence, mapJobsWithInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

import { PLIVO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = PLIVO_CATALOG.source
export const COMPANY = PLIVO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PLIVO_CATALOG.officialBrandName
export const HOMEPAGE_URL = PLIVO_CATALOG.homepageUrl
export const CAREERS_URL = PLIVO_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = PLIVO_CATALOG.officialLeverBoardUrl
export const LEVER_API_URL = 'https://api.lever.co/v0/postings/plivo?mode=json'
export const VERIFIED_ON = PLIVO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PLIVO_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = PLIVO_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'),
)?.toLowerCase() || ''

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const toRemoteStatus = (workplaceType, location) => {
  const normalizedType = normalizeWhitespace(workplaceType)?.toLowerCase()
  if (normalizedType === 'remote') return 'Remote'
  if (normalizedType === 'hybrid') return 'Hybrid'
  if (normalizedType === 'onsite' || normalizedType === 'on-site') return 'On-site'

  const normalizedLocation = normalizeWhitespace(location)?.toLowerCase()
  if (normalizedLocation?.includes('remote')) return 'Remote'
  return null
}

const regionNames = typeof Intl?.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

const toCountryName = (code, location) => {
  const normalizedCode = normalizeWhitespace(code)?.toUpperCase()
  if (normalizedCode && /^[A-Z]{2}$/.test(normalizedCode)) {
    const display = regionNames?.of(normalizedCode)
    if (display) return display
  }

  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return null
  if (/remote/i.test(normalizedLocation) && /\(([^)]+)\)/.test(normalizedLocation)) {
    return normalizeWhitespace(normalizedLocation.match(/\(([^)]+)\)/)?.[1])
  }

  const parts = normalizedLocation.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return parts.at(-1) || null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /remote/i.test(normalized)) return null
  return normalized.split(/\s*,\s*/)[0] || null
}

export const hasOfficialPlivoJobsSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeText(rawHtml)

  return extractTitle(rawHtml) === 'Jobs | Plivo'
    && text.includes('come build the future of agentic ai with us')
    && text.includes('open positions')
    && text.includes('loading positions')
    && /component-url=["'][^"']*JobsPage[^"']*["']/i.test(rawHtml)
}

export const extractJobsBundleUrl = (html = '') => {
  const bundlePath = String(html ?? '').match(/component-url=["']([^"']*JobsPage[^"']+)["']/i)?.[1]
  return bundlePath ? new URL(bundlePath, CAREERS_URL).toString() : null
}

export const extractLeverApiUrl = (bundleJs = '') =>
  normalizeWhitespace(String(bundleJs ?? '').match(/https:\/\/api\.lever\.co\/v0\/postings\/plivo\?mode=json/i)?.[0])

export const hasOfficialLeverBoardSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeText(rawHtml)

  const hasVerifiedTitle = extractTitle(rawHtml) === 'Plivo'
  const hasVerifiedBranding = /Job openings at Plivo/i.test(rawHtml)
  const hasLegacyLayout = text.includes('location type')
    && text.includes('team')
    && text.includes('work type')
  const hasCurrentEmptyLayout = hasEmptyLeverBoardSignal(rawHtml)
    && text.includes('plivo home page')
    && text.includes('privacy notice')
    && text.includes('artificial intelligence (ai) tools')
    && text.includes('jobs powered by')

  return hasVerifiedTitle
    && hasVerifiedBranding
    && (hasLegacyLayout || hasCurrentEmptyLayout)
}

export const hasEmptyLeverBoardSignal = (html = '') => {
  const document = readNativeDocument(html)
  const root = document.nodes(node => node.tag === 'root')[0]
  return /No job postings currently open\.\s*Check back later!/i.test(document.text(root))
}

export const hasMissingLeverBoardSignal = ({ status, html = '', url = LEVER_BOARD_URL } = {}) => {
  const rawHtml = String(html ?? '')

  return Number(status) === 404
    && extractTitle(rawHtml) === 'Not found - 404 error'
    && normalizeWhitespace(url) === LEVER_BOARD_URL
}

const defaultFetchText = (url, options) => fetchTextWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, options) => fetchJsonWithRetry(url, {
  ...options,
  headers: DEFAULT_JSON_HEADERS,
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Plivo Lever postings payload no longer returns an array')
  }

  return leverJobs.map((job) => {
    const title = normalizeWhitespace(job?.text)
    const jobId = normalizeWhitespace(job?.id)
    const sourceUrl = normalizeWhitespace(job?.hostedUrl)
    const applyUrl = normalizeWhitespace(job?.applyUrl) || sourceUrl
    const location = normalizeWhitespace(job?.categories?.location)
    const country = toCountryName(job?.country, location)

    if (!title || !jobId || !sourceUrl || !applyUrl || !location || !country) {
      throw new Error('Plivo Lever postings payload no longer exposes the verified public job fields')
    }

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
      location,
      city: extractCity(location),
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      employmentType: normalizeWhitespace(job?.categories?.commitment),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(job?.createdAt),
      closingDate: null,
      jobDescription: normalizeWhitespace(job?.descriptionBodyPlain || job?.descriptionPlain),
      remoteStatus: toRemoteStatus(job?.workplaceType, location),
    }
  })
}

export const createPlivoScraper = (options = {}) => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.plivo, options)

export const run = async (options = {}) => createPlivoScraper(options).run(options)

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
