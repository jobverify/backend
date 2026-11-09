import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DAGSTER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const PROVIDER_METADATA = DAGSTER_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Modern Data Orchestrator Platform\s*\|\s*Dagster\s*<\/title>/i.test(page)
    && normalized.includes('AI-native DataOps platform')
    && normalized.includes('Data your team trusts. AI that runs on it.')
    && normalized.includes('Dagster is the operational layer that structures how data is built, observed, and delivered')
    && /dagster\.plus/i.test(page)
}

export const isVerifiedPrefectCareersRedirect = (page = {}, expectedUrl = CAREERS_URL) => {
  const finalUrl = String(page.url || expectedUrl)
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html) || ''

  return /^https:\/\/www\.prefect\.io\/careers\/?$/i.test(finalUrl)
    && /<title>\s*Careers at Prefect\s*-\s*Open Roles\s*<\/title>/i.test(html)
    && normalized.includes('Careers at Prefect - Open Roles')
}

export const hasEmptyGreenhouseBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Jobs at Dagster Labs\s*<\/title>/i.test(page)
    && normalized.includes('Current openings at Dagster Labs')
    && normalized.includes('There are no current openings.')
    && normalized.includes('Powered by Greenhouse')
    && !/\/dagsterlabs\/jobs\/\d+/i.test(page)
}

export const createDagsterScraper = (options = {}) => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.dagster, options)

export const run = async (options = {}) => createDagsterScraper().run(options)

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
