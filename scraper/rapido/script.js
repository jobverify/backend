import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { RAPIDO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const SOURCE = RAPIDO_CATALOG.source
export const COMPANY_NAME = RAPIDO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = RAPIDO_CATALOG.officialBrandName
export const OFFICIAL_CAREERS_URL = RAPIDO_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = RAPIDO_CATALOG.officialCareersHandoffUrl
export const DARWINBOX_ORIGIN = RAPIDO_CATALOG.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = RAPIDO_CATALOG.darwinboxCompanyId
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = RAPIDO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = RAPIDO_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = RAPIDO_CATALOG

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
    /<a[^>]+href=["'](https:\/\/rapido\.darwinbox\.in\/ms\/candidate\/careers)["'][^>]*>[\s\S]*?View Jobs/i,
  )
  return normalizeWhitespace(match?.[0])
    ? OFFICIAL_CAREERS_HANDOFF_URL
    : null
}

export const hasOfficialRapidoCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title.includes('rapido')
    && text.includes('be a part of our team.')
    && text.includes('view jobs')
    && text.includes('why work with us')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'rapido-official',
  timeoutMs: 15000,
})

export const createRapidoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialRapidoCareersSignals(careersHtml)) {
      throw new Error('Rapido verified official careers page no longer matches the verified public surface')
    }

    const jobs = await darwinboxScraper.run({
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

export const run = async (options = {}) => createRapidoScraper(options).run(options)

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
