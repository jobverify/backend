import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { PRATILIPI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /<article[^>]+job-card/i,
  /\bjobs at pratilipi\b/i,
  /\/JobView\//i,
  /\bapply now\b/i,
  /\bjob openings\b/i,
  /\bopen positions\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: PRATILIPI_CATALOG.source,
  timeoutMs: 15000,
})

export const SOURCE = PRATILIPI_CATALOG.source
export const COMPANY = PRATILIPI_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PRATILIPI_CATALOG.officialBrandName
export const VERIFIED_ON = PRATILIPI_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PRATILIPI_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = PRATILIPI_CATALOG
export const HOMEPAGE_URL = PRATILIPI_CATALOG.homepageUrl
export const OFFICIAL_CAREERS_URL = PRATILIPI_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PRATILIPI_CATALOG.officialCareersHandoffUrl

export const extractOfficialHandoffUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/pratilipi\.talentzq\.io\/careers)["']/i)
  return match?.[1] ?? null
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Careers \| Pratilipi/i.test(page)
    && /Work with us/i.test(normalized)
    && /Nasadiya Technologies Private Limited/i.test(normalized)
    && extractOfficialHandoffUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isOpaqueTalentzqShell = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && /blazor\.webassembly\.js/i.test(page)
    && /id=["']app["']/i.test(page)
    && /An unhandled error has occurred\./i.test(normalized)
    && !hasPublicJobsSignal(page)
}

export const createPratilipiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const officialCareersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasOfficialCareersPageSignal(officialCareersHtml)) {
      throw new Error('Pratilipi official careers page no longer matches the verified public surface')
    }

    if (extractOfficialHandoffUrl(officialCareersHtml) !== OFFICIAL_CAREERS_HANDOFF_URL) {
      throw new Error('Pratilipi official careers page no longer points to the verified TalentzQ handoff')
    }

    const handoffHtml = await fetchText(OFFICIAL_CAREERS_HANDOFF_URL)
    if (hasPublicJobsSignal(handoffHtml)) {
      throw new Error('Pratilipi TalentzQ handoff now appears to expose public jobs')
    }

    if (!isOpaqueTalentzqShell(handoffHtml)) {
      throw new Error('Pratilipi verified TalentzQ shell changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPratilipiScraper().run(options)

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
