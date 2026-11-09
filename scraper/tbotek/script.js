import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { TBOTEK_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COMPANY_LEGAL_NAME = PROVIDER_METADATA.companyLegalName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXACT_NAME_EVIDENCE_URL = PROVIDER_METADATA.exactNameEvidenceUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

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

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a[^>]+href=["'](https:\/\/tbo\.darwinbox\.in\/ms\/candidate\/careers)["'][^>]*>\s*Apply Now/i,
  )
  return normalizeWhitespace(match?.[0])
    ? OFFICIAL_CAREERS_HANDOFF_URL
    : null
}

export const hasOfficialTboCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'careers - tbo.com'
    && text.includes('where travel meets technology, you’ll find us.')
    && text.includes('be part of a dynamic team driven by passion')
    && text.includes('employees speak')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const hasExactNameLegalSignals = (html = '') => {
  const text = normalizeWhitespace(html) || ''
  return /Terms and Conditions/i.test(text)
    && /TBO Tek Ltd/i.test(text)
    && /TBO\.com/i.test(text)
  }

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'tbo-tek-official',
  timeoutMs: 15000,
})

export const createTboTekScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasOfficialTboCareersSignals(careersHtml)) {
      throw new Error('TBO Tek verified official careers page no longer matches the verified public surface')
    }

    const legalHtml = await fetchText(EXACT_NAME_EVIDENCE_URL)
    if (!hasExactNameLegalSignals(legalHtml)) {
      throw new Error('TBO Tek exact-name legal page no longer matches the verified public surface')
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

export const run = async (options = {}) => createTboTekScraper(options).run(options)

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
