import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PROPTIGER_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROPTIGER_CATALOG.source
export const COMPANY = PROPTIGER_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PROPTIGER_CATALOG.officialBrandName
export const VERIFIED_ON = PROPTIGER_CATALOG.verifiedOn
export const PROVIDER_METADATA = PROPTIGER_CATALOG
export const HOMEPAGE_URL = PROPTIGER_CATALOG.homepageUrl
export const CAREERS_URL = PROPTIGER_CATALOG.companyCareerPage
export const RIGHT_OPPORTUNITY_URL = PROPTIGER_CATALOG.officialReachOutFormAction

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''), HOMEPAGE_URL)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractReachOutFormAction = (html = '') => {
  const match = String(html ?? '').match(
    /<form[^>]+action=["']([^"']*right-opportunity)["']/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1], HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Proptiger\.com\s*<\/title>/i.test(page)
    && /Build your Career at PropTiger/i.test(page)
    && /<h2>\s*Open Roles\s*<\/h2>/i.test(page)
    && /Find your next career oppurtunity with PropTiger/i.test(page)
    && /PropTiger Marketing Services Private Limited\./i.test(page)
    && /responsive\/jhr\/careers\/right-opportunity/i.test(page)
}

export const hasEmptyRolesSignal = (html = '') => {
  const page = String(html ?? '')

  return /<div class=["']jobs["']><\/div>/i.test(page)
    && /There are currently no jobs available/i.test(page)
    && /Reach out to us/i.test(page)
}

export const createPropTigerScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('Verified careers page changed materially')
    }

    if (!hasEmptyRolesSignal(careersHtml)) {
      throw new Error('Verified empty open roles state changed materially')
    }

    const formAction = extractReachOutFormAction(careersHtml)
    if (normalizeComparableUrl(formAction) !== normalizeComparableUrl(RIGHT_OPPORTUNITY_URL)) {
      throw new Error('Verified careers page reach-out form changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPropTigerScraper(options).run(options)

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
