import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ACCUBITS_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const TRANSIENT_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'ERR_NAME_NOT_RESOLVED',
])

export const PROVIDER_METADATA = ACCUBITS_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isTransientUpstreamError = (error) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    const code = typeof current.code === 'string' ? current.code : ''
    const message = String(current.message ?? current)

    if (
      TRANSIENT_ERROR_CODES.has(code)
      || /\bHTTP 5\d\d\b/i.test(message)
      || /\b(fetch failed|connect timeout|timed out|timeout|getaddrinfo|ENOTFOUND|EAI_AGAIN)\b/i.test(message)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

const buildDiscoveryOnlyEvidence = (now) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: OFFICIAL_CAREERS_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'Accubits Technologies verified careers page is currently unavailable; public inventory cannot be verified.',
  })

export const hasOfficialAccubitsCareersSignals = (html = '') => {
  const page = String(html ?? '')

  return hasCurrentExplicitEmptyCareersShell(page) || (/Career Archive/i.test(page)
    && /View Job Openings/i.test(page)
    && /Latest Jobs/i.test(page)
    && /Role/i.test(page)
    && /Location/i.test(page)
    && /Date of Posting/i.test(page)
    && /ROLE YOU ARE APPLYING FOR/i.test(page))
}

const hasCurrentExplicitEmptyCareersShell = (page) => (
  /<title>\s*Career\s*&ndash;\s*Accubits\s*<\/title>/i.test(page)
  && /href=["']#latest_jobs["']/i.test(page)
  && /<section\b[^>]*class=["'][^"']*latest-jobs[^"']*["'][^>]*id=["']latest_jobs["']/i.test(page)
  && /class=["']job-list-head["']/i.test(page)
  && /class=["']job-list["']/i.test(page)
  && /class=["']search-error["'][^>]*>\s*No openings are listed right now\./i.test(page)
  && /Date of Posting/i.test(page)
)

export const pageExposesStructuredJobListings = (html = '') =>
  /\bjob-card\b/i.test(String(html ?? ''))
  || /<a[^>]+href=["'][^"']*career\/[^"']+["'][^>]*>\s*Apply now\s*<\/a>/i.test(String(html ?? ''))

export const createAccubitsTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    } catch (error) {
      if (isTransientUpstreamError(error)) return buildDiscoveryOnlyEvidence(now)
      throw error
    }

    if (!hasOfficialAccubitsCareersSignals(careersHtml)) {
      throw new Error('Accubits Technologies official careers shell changed; refusing to assume no public listings')
    }

    if (pageExposesStructuredJobListings(careersHtml)) {
      throw new Error('Accubits Technologies careers shell now exposes structured public job listings and needs a dedicated scraper')
    }

    if (hasCurrentExplicitEmptyCareersShell(careersHtml)) {
      return attachInventoryEvidence([], {
        status: 'verified-empty',
        surface: OFFICIAL_CAREERS_URL,
        firstParty: true,
        listingComplete: true,
        pagesFetched: 1,
        reportedTotal: 0,
        indiaFacetCount: 0,
        verifiedAt: now(),
        reason: 'current-first-party-no-openings-message',
      })
    }

    return []
  },
})

export const run = async (options = {}) => createAccubitsTechnologiesScraper(options).run(options)

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
