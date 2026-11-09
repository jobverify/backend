import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import { HFCL_CATALOG } from './catalog.js'

export const PROVIDER_METADATA = HFCL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HFCL_OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const HFCL_DARWINBOX_HOME_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const HFCL_DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const HFCL_DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

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

export const extractOfficialDarwinboxUrl = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/https:\/\/hifi\.darwinbox\.in\/ms\/candidatev2\/604761d854807\/careers\/home/i)?.[0],
)

export const hasOfficialHfclCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()

  return normalized.includes('hfcl')
    && normalized.includes('careers')
    && extractOfficialDarwinboxUrl(page) === HFCL_DARWINBOX_HOME_URL
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'hfcl-official',
  timeoutMs: 15000,
})

const createConfiguredScraper = () => {
  const darwinboxScraper = createDarwinboxScraper({
    companyName: COMPANY,
    source: SOURCE,
    companyId: HFCL_DARWINBOX_COMPANY_ID,
    origin: HFCL_DARWINBOX_ORIGIN,
  })

  return {
    ...darwinboxScraper,
    async run({
      fetchText = defaultFetchText,
      ...options
    } = {}) {
      const careersHtml = await fetchText(HFCL_OFFICIAL_CAREERS_URL)

      if (!hasOfficialHfclCareersSignals(careersHtml)) {
        throw new Error('HFCL verified official careers page no longer matches the verified public surface')
      }

      return darwinboxScraper.run(options)
    },
  }
}

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createHFCLScraper = createConfiguredScraper
