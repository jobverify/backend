import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import MERU_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MERU_CATALOG.source
export const COMPANY = MERU_CATALOG.companyName
export const HOMEPAGE_URL = MERU_CATALOG.homepageUrl
export const CAREERS_URL = MERU_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = MERU_CATALOG.officialLeverBoardUrl
export const LEVER_API_URL = MERU_CATALOG.leverApiUrl

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

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s+-\s+|,/)[0] || null

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

const isIndiaJob = (job) => [
  job?.categories?.location,
  ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
].some((location) => /(^|[\s,-])india\b/i.test(normalizeWhitespace(location) || ''))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const text = normalizeText(rawHtml)

  return /<title>\s*MERU\s*-\s*Leading Organizations Through Change\s*<\/title>/i.test(rawHtml)
    && text.includes('powered by people. driven by values.')
    && /https:\/\/wearemeru\.com\/careers\//i.test(rawHtml)
    && /copyright\s+2026\s+meru,\s*llc\.\s+all rights reserved\./i.test(rawHtml)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const text = normalizeText(rawHtml)

  return /<title>\s*Careers\s*-\s*MERU\s*<\/title>/i.test(rawHtml)
    && text.includes('join our team')
    && text.includes('apply here')
    && /jobs\.lever\.co\/wearemeru/i.test(rawHtml)
}

export const extractLeverBoardUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/jobs\.lever\.co\/wearemeru\/?)["']/i)
  return match?.[1] ? match[1].replace(/\/$/, '') : null
}

export const hasOfficialLeverBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const hasLeverFooterBranding =
    text.includes('jobs powered by')
    && /alt=["']Lever logo["']|lever-logo-/i.test(page)

  return text.includes('meru')
    && text.includes('location type')
    && text.includes('location')
    && text.includes('team')
    && text.includes('work type')
    && hasLeverFooterBranding
    && /https:\/\/jobs\.lever\.co\/wearemeru\/[a-z0-9-]+/i.test(page)
}

export const extractLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Meru Lever postings payload no longer returns an array')
  }

  return leverJobs
    .filter(isIndiaJob)
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl)
      const id = normalizeWhitespace(job?.id)

      if (!title || !location || !sourceUrl || !id) {
        throw new Error('Meru Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location,
        city: extractCity(location),
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

export const createMeruScraper = ({
  fetchPage = defaultFetchPage,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !sameUrl(homepage.url, HOMEPAGE_URL) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Meru verified official homepage changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !sameUrl(careersPage.url, CAREERS_URL) || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Meru verified official careers page changed materially')
    }

    const leverBoardUrl = extractLeverBoardUrl(careersPage.html)
    if (!sameUrl(leverBoardUrl, LEVER_BOARD_URL)) {
      throw new Error('Meru verified official careers page no longer links to the verified public Lever board')
    }

    const leverBoardPage = await fetchPage(LEVER_BOARD_URL)
    if (
      leverBoardPage.status !== 200
      || !sameUrl(leverBoardPage.url, LEVER_BOARD_URL)
      || !hasOfficialLeverBoardSignal(leverBoardPage.html)
    ) {
      throw new Error('Meru verified public Lever board changed materially')
    }

    const scrapedAt = now()

    return extractLeverJobs(await fetchJson(LEVER_API_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: MERU_CATALOG.companyDomain,
      atsPlatform: MERU_CATALOG.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createMeruScraper(options).run()

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
