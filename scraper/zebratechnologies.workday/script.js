import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runZebraNativeRecruitment } from './nativeRun.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { ZEBRA_TECHNOLOGIES_CATALOG } from './catalog.js'

export const SCRAPER_DIR = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ZEBRA_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BASE_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const INDIA_LOCATION_COUNTRY = PROVIDER_METADATA.verifiedIndiaCountryFacetId
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: SCRAPER_DIR,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasHeroSignals =
    normalized.includes('Welcome to Zebra, where we make the world Better Every Day')
    && normalized.includes('Join the Herd and increase our impact')
  const hasCareerAreaSignals =
    normalized.includes('Search AI, Engineering & Technology Solutions Jobs')
    || normalized.includes('Search Corporate Jobs')

  return /<title>\s*Careers\s*\|\s*Zebra\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Explore careers at Zebra/i.test(page)
    && hasHeroSignals
    && hasCareerAreaSignals
    && page.includes(WORKDAY_BASE_URL)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://zebra.wd501.myworkdayjobs.com'
      && url.pathname.replace(/\/+$/, '') === '/Zebra_careers'
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayHandoffUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isVerifiedWorkdayHandoffUrl(match[1])) {
      return new URL(match[1]).toString()
    }
  }

  return null
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const createZebraTechnologiesScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runZebraNativeRecruitment,
} = {}) => ({
  async run({ signal } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await (
      signal === undefined
        ? fetchText(CAREERS_URL)
        : fetchText(CAREERS_URL, { signal })
    )
    signal?.throwIfAborted()

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Zebra Technologies verified first-party careers page no longer matches the trusted surface')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Zebra Technologies verified Workday handoff changed; refusing to guess the public jobs source')
    }

    const jobs = await workdayRunner({
      ...buildScraperOptions(),
      ...(signal === undefined ? {} : { signal }),
    })
    signal?.throwIfAborted()
    return jobs
  },
})

export const run = async ({
  fetchText = defaultFetchText,
  workdayRunner = runZebraNativeRecruitment,
  signal,
} = {}) => createZebraTechnologiesScraper({ fetchText, workdayRunner }).run({ signal })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(SCRAPER_DIR, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
