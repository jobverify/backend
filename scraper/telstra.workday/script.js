import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { TELSTRA_CATALOG } from './catalog.js'
import {runTelstraNativeRecruitment} from './nativeRun.js'

export const SCRAPER_DIR = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TELSTRA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BASE_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const CAREERS_TITLE_PATTERN = /<title>\s*(?:Telstra India Careers|Careers at Telstra - Telstra)\s*<\/title>/i

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: SCRAPER_DIR,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasLegacyHero =
    normalized.includes('Discover rewarding career opportunities at Telstra.')
    && normalized.includes('shape tomorrow through technology.')
  const hasCurrentHero =
    normalized.includes('Define Your Possible at Telstra')
    && normalized.includes('engineering the possibilities of tomorrow.')

  return CAREERS_TITLE_PATTERN.test(page)
    && (hasLegacyHero || hasCurrentHero)
    && /Find a career/i.test(page)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://telstra.wd3.myworkdayjobs.com'
      && url.pathname === '/Telstra_Careers'
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayHandoffUrl = (html) => {
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

const createLegacyTelstraScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const careersHtml = await (
      signal === undefined
        ? fetchText(CAREERS_URL)
        : fetchText(CAREERS_URL, { signal })
    )

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Telstra verified first-party careers page no longer matches the trusted surface')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Telstra verified Workday handoff changed; refusing to guess the public jobs source')
    }

    return workdayRunner({
      ...buildScraperOptions(),
      ...(signal === undefined ? {} : { signal }),
    })
  },
})

export const createTelstraScraper = (options={}) => options.fetchText||options.workdayRunner
  ?createLegacyTelstraScraper(options)
  :{run:(passed={})=>runTelstraNativeRecruitment({...options,...passed})}
export const run = (options={}) => createTelstraScraper(options).run(options)

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
