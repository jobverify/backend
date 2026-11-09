import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { AXIO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = AXIO_CATALOG.companyName
export const SOURCE = AXIO_CATALOG.source
export const DARWINBOX_COMPANY_ID = AXIO_CATALOG.darwinboxCompanyId
export const DARWINBOX_ORIGIN = AXIO_CATALOG.darwinboxOrigin
export const OFFICIAL_CAREERS_URL = AXIO_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = AXIO_CATALOG.officialCareersHandoffUrl
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = AXIO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AXIO_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AXIO_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/axiofinance\.darwinbox\.in\/ms\/candidate\/careers/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialAxioCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return extractTitle(page) === 'axio - Revolutionizing Finance Through Technology and Innovation'
    && text.includes('our vision')
    && text.includes('a tech-first financial platform for the next 100 million indian customers')
    && text.includes('join our team')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'axio-official',
  timeoutMs: 15000,
  signal,
})

export const createAxioScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
    ...darwinboxOptions
  } = {}) {
    const { signal } = darwinboxOptions
    signal?.throwIfAborted()
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (!hasOfficialAxioCareersSignals(careersHtml)) {
      throw new Error('Axio verified official careers page no longer matches the verified public surface')
    }

    const jobs = await darwinboxScraper.run({
      ...darwinboxOptions,
      maxPages,
      maxJobs,
      fetchListingPage,
    })
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createAxioScraper().run(options)

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
