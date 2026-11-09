import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import DELPHIX_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DELPHIX_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const RESOLVED_HOMEPAGE_URL = PROVIDER_METADATA.resolvedHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEVER_BOARD_URL = PROVIDER_METADATA.officialLeverBoardUrl
export const LEVER_API_URL = PROVIDER_METADATA.leverApiUrl
export const BRAND_KEYWORD = String(PROVIDER_METADATA.brandKeyword || '').toLowerCase()
export const VERIFIED_INDIA_LOCATION_NAME = PROVIDER_METADATA.verifiedIndiaLocationName

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
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

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_JSON_HEADERS,
  label: SOURCE,
})

const extractCity = (location) => {
  const firstSegment = normalizeWhitespace(location)?.split(',')[0] || null
  return firstSegment ? (normalizeCity(firstSegment) || firstSegment) : null
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const isIndiaLocation = (value) => {
  const normalized = normalizeText(value)

  return normalized.includes('india')
    || normalized === normalizeText(VERIFIED_INDIA_LOCATION_NAME)
}

const isDelphixBrandedJob = (job = {}) => {
  const combined = normalizeText([
    job?.text,
    job?.categories?.team,
    job?.categories?.department,
  ].filter(Boolean).join(' '))

  return new RegExp(`\\b${BRAND_KEYWORD}\\b`, 'i').test(combined)
}

const isIndiaJob = (job = {}) => {
  const locations = [
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]

  return locations.some((location) => isIndiaLocation(location))
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Perforce Delphix \| Intelligent Data Automation Platform\s*<\/title>/i.test(page)
    && text.includes('perforce delphix')
    && (text.includes('make data fast, trusted, and ai-ready')
      || (text.includes('perforce delphix: trusted test data for ai-driven software delivery')
        && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.perforce\.com\/products\/delphix["']/i.test(page)))
    && text.includes('intelligent data automation platform')
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Careers \| Perforce Software\s*<\/title>/i.test(page)
    && text.includes('perforce, powered by people')
    && text.includes('work that matters. people who care. a place to grow.')
    && text.includes('browse open positions')
}

export const extractLeverBoardUrl = (html = '') => {
  const match = String(html ?? '').match(/href=["'](https:\/\/jobs\.lever\.co\/perforce\/?)["']/i)
  return match?.[1] ? match[1].replace(/\/$/, '') : null
}

export const hasOfficialLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return text.includes('perforce')
    && text.includes('location type')
    && text.includes('location')
    && text.includes('team')
    && text.includes('work type')
    && text.includes('pune, maharashtra')
    && text.includes('jobs powered by')
    && /https:\/\/jobs\.lever\.co\/perforce\/[a-z0-9-]+/i.test(page)
}

export const extractDelphixIndiaJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Delphix India Lever postings payload no longer returns an array')
  }

  return leverJobs
    .filter((job) => isDelphixBrandedJob(job) && isIndiaJob(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl)
      const id = normalizeWhitespace(job?.id)
      const city = extractCity(location)

      if (!title || !location || !sourceUrl || !id || !city) {
        throw new Error('Delphix India Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location,
        city,
        country: 'India',
        jobId: id,
        requisitionId: id,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.descriptionPlain),
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
}

export const createDelphixIndiaScraper = (options = {}) => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.delphixindia, options)

export const run = async (options = {}) => createDelphixIndiaScraper(options).run(options)

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
