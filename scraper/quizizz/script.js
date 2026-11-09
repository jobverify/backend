import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

import QUIZIZZ_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = QUIZIZZ_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const RESOLVED_CAREERS_URL = PROVIDER_METADATA.resolvedCareerPageUrl
export const LEVER_BOARD_URL = PROVIDER_METADATA.officialLeverBoardUrl
export const LEVER_API_URL = PROVIDER_METADATA.leverApiUrl
export const VERIFIED_INDIA_COUNTRY_CODE = PROVIDER_METADATA.verifiedIndiaCountryCode

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

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

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
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
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

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s*,\s*/)[0] || null

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

const collectRichDescriptionSections = (job = {}) => {
  const sections = [
    job?.openingPlain,
    job?.opening,
    job?.descriptionPlain,
    job?.descriptionBodyPlain,
    job?.description,
    job?.additionalPlain,
    job?.additional,
    ...(Array.isArray(job?.lists)
      ? job.lists.flatMap((section) => [section?.text, section?.content])
      : []),
  ]

  return [...new Set(
    sections
      .map((section) => stripTags(section))
      .filter(Boolean),
  )]
}

const buildJobDescription = (job = {}) => {
  const sections = collectRichDescriptionSections(job)
  return sections.length > 0 ? sections.join(' ') : null
}

const extractExperienceRequired = ({ title, jobDescription }) => (
  extractJobFilterSignals({
    title,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || null
)

const buildIndiaLocation = (rawLocation) => {
  const city = extractCity(rawLocation)
  if (city) return `${city}, India`

  const normalized = normalizeWhitespace(rawLocation)
  if (normalized && /india/i.test(normalized)) return normalized

  return 'India'
}

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job?.country)?.toUpperCase()
  const locations = [
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]

  return country === VERIFIED_INDIA_COUNTRY_CODE
    || locations.some((location) => /(?:^|[\s,-])india\b/i.test(normalizeWhitespace(location) || ''))
}

export const buildPublicJobUrl = (jobId) =>
  `https://jobs.lever.co/Wayground/${encodeURIComponent(String(jobId ?? ''))}`

export const hasResolvedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Browse our Careers \| Wayground \(formerly Quizizz\)\s*<\/title>/i.test(page)
    && text.includes('reimagine how the world learns')
    && text.includes('formerly quizizz')
    && text.includes('quizizz inc. (dba wayground)')
}

export const extractLeverBoardUrl = (html = '') => {
  const match = String(html ?? '').match(/href=["'](https:\/\/jobs\.lever\.co\/Wayground\/?)["']/i)
  if (match?.[1]) {
    return match[1].replace(/\/$/, '')
  }

  return hasResolvedCareersSignal(html) ? LEVER_BOARD_URL : null
}

export const hasOfficialLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Wayground \(formerly Quizizz\)\s*<\/title>/i.test(page)
    && /job openings at wayground \(formerly quizizz\)/i.test(page)
    && text.includes('location type')
    && text.includes('location')
    && text.includes('team')
    && text.includes('work type')
    && /https:\/\/jobs\.lever\.co\/Wayground\/[a-z0-9-]+/i.test(page)
}

export const extractIndiaLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Quizizz Lever postings payload no longer returns an array')
  }

  return leverJobs
    .filter((job) => isIndiaJob(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const city = extractCity(location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl) || buildPublicJobUrl(job?.id)
      const id = normalizeWhitespace(job?.id)
      const jobDescription = buildJobDescription(job)

      if (!title || !id || !sourceUrl || !city) {
        throw new Error('Quizizz Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location: buildIndiaLocation(location),
        city,
        country: 'India',
        jobId: id,
        requisitionId: id,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: extractExperienceRequired({ title, jobDescription }),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription,
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
    .sort((left, right) => String(right.postingDate || '').localeCompare(String(left.postingDate || '')))
}

export const createQuizizzScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, RESOLVED_CAREERS_URL)
      || !hasResolvedCareersSignal(careersPage.html)
    ) {
      throw new Error('Quizizz exact-name careers redirect changed materially')
    }

    const leverBoardUrl = extractLeverBoardUrl(careersPage.html)
    if (!sameUrl(leverBoardUrl, LEVER_BOARD_URL)) {
      throw new Error('Quizizz verified exact-name careers page no longer links to the verified public Lever board')
    }

    const leverBoardPage = await fetchPage(LEVER_BOARD_URL)
    if (
      leverBoardPage.status !== 200
      || !sameUrl(leverBoardPage.url, LEVER_BOARD_URL)
      || !hasOfficialLeverBoardSignal(leverBoardPage.html)
    ) {
      throw new Error('Quizizz verified public Lever board changed materially')
    }

    const jobs = extractIndiaLeverJobs(await fetchJson(LEVER_API_URL))
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = now()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createQuizizzScraper(options).run(options)

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
