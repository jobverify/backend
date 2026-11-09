import {createPublicLeverSource, PUBLIC_LEVER_PROFILES} from '../../scraper-support/native-sources/publicLeverChannels/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { NETOMI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = NETOMI_CATALOG.source
export const COMPANY = NETOMI_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = NETOMI_CATALOG.officialBrandName
export const HOMEPAGE_URL = NETOMI_CATALOG.homepageUrl
export const CAREERS_URL = NETOMI_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = NETOMI_CATALOG.officialLeverBoardUrl
export const LEVER_API_URL = NETOMI_CATALOG.leverApiUrl
export const COMPANY_DOMAIN = NETOMI_CATALOG.companyDomain
export const VERIFIED_ON = NETOMI_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = NETOMI_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = NETOMI_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

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

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/â€”|â€“/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+-\s+/g, ' - ')
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
  if (/remote\s*-\s*/i.test(normalizedLocation)) {
    return normalizedLocation.split(/\s*-\s*/)[1] || null
  }

  const parts = normalizedLocation.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return parts.at(-1) || null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^remote\b/i.test(normalized)) return null

  return normalized.split(/\s*-\s*|,/)[0] || null
}

const toRemoteStatus = (workplaceType, location) => {
  const normalizedType = normalizeWhitespace(workplaceType)?.toLowerCase()
  if (normalizedType === 'remote') return 'Remote'
  if (normalizedType === 'hybrid') return 'Hybrid'
  if (normalizedType === 'onsite' || normalizedType === 'on-site') return 'On-site'

  const normalizedLocation = normalizeWhitespace(location)?.toLowerCase()
  if (normalizedLocation?.startsWith('remote')) return 'Remote'
  return null
}

export const extractLeverApiUrl = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(/https:\/\/api\.lever\.co\/v0\/postings\/netomi\?mode=json/i)?.[0],
  )

export const hasReferralOnlyHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'netomi'
    && (
      text.includes("we power intelligent experiences for the world's most ambitious companies.")
      || text.includes("we create intelligent experiences for the world's most ambitious companies.")
    )
    && text.includes('new engagements are by referral.')
    && extractLeverApiUrl(page) == null
    && !text.includes('careers at netomi')
    && !text.includes('view open roles')
  }

export const isVerifiedReferralOnlyHomepageRedirect = (page = {}) =>
  Number(page?.status) === 200
  && String(page?.url || '') === HOMEPAGE_URL
  && hasReferralOnlyHomepageSignal(page?.html)

export const hasOfficialNetomiCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const title = normalizeWhitespace(extractTitle(page))?.toLowerCase() || ''

  return /^careers\s*-\s*netomi$/i.test(title)
    && text.includes('careers at netomi')
    && text.includes('join the team')
    && text.includes('view open roles')
    && text.includes('open roles')
    && extractLeverApiUrl(page) === LEVER_API_URL
}

const hasExpectedLeverUrl = (value) =>
  normalizeWhitespace(value)?.startsWith(`${LEVER_BOARD_URL}/`) || false

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_JSON_HEADERS,
  label: `${SOURCE}-lever`,
})

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  html: await fetchText(url),
})

export const extractLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Netomi Lever postings payload no longer returns an array')
  }

  return leverJobs.map((job) => {
    const title = normalizeWhitespace(job?.text)
    const jobId = normalizeWhitespace(job?.id)
    const sourceUrl = normalizeWhitespace(job?.hostedUrl)
    const applyUrl = normalizeWhitespace(job?.applyUrl) || sourceUrl
    const location = normalizeWhitespace(job?.categories?.location)
    const country = toCountryName(job?.country, location)

    if (!title || !jobId || !sourceUrl || !applyUrl || !location || !country) {
      throw new Error('Netomi Lever postings payload no longer exposes the verified public job fields')
    }

    if (!hasExpectedLeverUrl(sourceUrl) || !hasExpectedLeverUrl(applyUrl)) {
      throw new Error('Netomi Lever postings payload no longer exposes the verified Lever-hosted URLs')
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

export const createNetomiScraper = (options = {}) => createPublicLeverSource(PUBLIC_LEVER_PROFILES.netomi, options)

export const run = async (options = {}) => createNetomiScraper(options).run(options)

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
