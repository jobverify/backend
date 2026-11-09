import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import { CLOUDMOYO_CATALOG } from './catalog.js'
import { runCloudMoyo } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CLOUDMOYO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CONTACT_URL = PROVIDER_METADATA.companyCareerPage
export const BOARD_URL = PROVIDER_METADATA.boardUrl
export const LISTINGS_API_URL = 'https://api.smartrecruiters.com/v1/companies/CloudMoyo/postings?limit=100&offset=0'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CONTACT_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialContactSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Explore Job Openings at')
    && normalized.includes('Pune, India')
    && normalized.includes('Career Opportunities')
    && normalized.includes('recruitment@cloudmoyo.com')
    && normalized.includes('View India openings')
  }

export const hasVerifiedEmptyBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('CloudMoyo')
    && normalized.includes('Current Openings - India')
    && normalized.includes('No job postings are currently available.')
  }

export const hasVerifiedZeroListingsSignal = (payload = {}) =>
  Array.isArray(payload?.content)
  && payload.content.length === 0
  && Number.isSafeInteger(payload?.totalFound)
  && payload.totalFound === 0

export const pageExposesPublicJobListings = (html = '') => {
  const normalized = normalizeWhitespace(html)
  if (normalized.includes('No job postings are currently available.')) return false
  return /Full Stack Developer|Engineer|Analyst|Manager|Consultant/i.test(normalized)
}

export const createCloudMoyoScraper = (defaults = {}) => ({
  run: (options = {}) => runCloudMoyo({ ...defaults, ...options }),
})

export const run = async (options = {}) => createCloudMoyoScraper().run(options)

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
