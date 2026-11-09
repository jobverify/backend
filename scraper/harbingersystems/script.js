import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'

import { HARBINGER_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HARBINGER_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const DARWINBOX_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY,
  source: SOURCE,
  origin: DARWINBOX_ORIGIN,
  companyId: DARWINBOX_COMPANY_ID,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Current(?:\s+Job)?\s+Openings(?:\s*(?:\||at)\s*)Harbinger Group\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && normalized.includes('Grow With Us')
    && page.includes(DARWINBOX_HANDOFF_URL)
}

export const buildDarwinboxCareersPageUrl = () => darwinboxScraper.buildCareersPageUrl()
export const buildDarwinboxListingApiUrl = () => darwinboxScraper.buildListingApiUrl()
export const buildDarwinboxJobDetailUrl = (jobId) => darwinboxScraper.buildJobDetailUrl(jobId)

export const createHarbingerSystemsScraper = ({
  maxJobs = null,
  maxPages = undefined,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchListingPage,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    try {
      const careersHtml = await fetchText(CAREERS_URL, { signal })
      signal?.throwIfAborted()
      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('The verified Harbinger Systems careers page no longer matches the trusted first-party handoff')
      }

      const jobs = await darwinboxScraper.run({
        fetchListingPage,
        maxJobs,
        maxPages,
        signal,
      })
      signal?.throwIfAborted()
      return jobs
    } catch (error) {
      signal?.throwIfAborted()
      throw error
    }
  },
})

export const run = async (options = {}) => createHarbingerSystemsScraper().run(options)

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
