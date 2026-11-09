import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SAP_ARIBA_CATALOG from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SAP_ARIBA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.careersUrl
export const PARENT_BRAND_NAME = PROVIDER_METADATA.parentBrandName

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const sameUrl = (left, right) => String(left ?? '').replace(/\/$/, '') === String(right ?? '').replace(/\/$/, '')

const isTrustedSapCareersRedirect = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.hostname === 'jobs.sap.com' && url.pathname === '/'
  } catch {
    return false
  }
}

export const hasGenericSapCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const title = (extractTitle(html) || '').toLowerCase()

  return title.includes('jobs at sap')
    && title.includes('sap careers')
    && normalized.includes('search by keyword')
    && normalized.includes('search by location')
}

export const hasExactSapAribaCareersSignal = (html = '') =>
  /(careers? at sap ariba|jobs? at sap ariba|join sap ariba|work at sap ariba)/i.test(String(html ?? ''))

export const createSapAribaScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString(), signal } = {}) {
    signal?.throwIfAborted()
    const careersPage = await fetchPage(CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (Number.isInteger(careersPage.status) && careersPage.status !== 200) {
      const error = new Error('SAP Ariba public careers HTTP ' + careersPage.status + ' for ' + careersPage.url)
      error.code = 'UPSTREAM_HTTP_ERROR'
      error.status = careersPage.status
      error.statusCode = careersPage.status
      error.url = careersPage.url
      throw error
    }
    if (
      careersPage.status !== 200
      || (!sameUrl(careersPage.url, CAREERS_URL) && !isTrustedSapCareersRedirect(careersPage.url))
      || !hasGenericSapCareersSignal(careersPage.html)
    ) {
      throw new Error('SAP generic careers surface no longer matches the trusted first-party baseline')
    }

    if (hasExactSapAribaCareersSignal(careersPage.html)) {
      throw new Error('SAP careers now exposes an exact-name SAP Ariba public jobs surface and needs a real scraper')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false,
      pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'Generic SAP parent careers discovery does not establish an exact-brand SAP Ariba global or India job inventory. An empty discovery result cannot authorize expiry.',
    })
  },
})

export const run = async (options = {}) => createSapAribaScraper().run(options)

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
