import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AMNET_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMNET_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_CURRENT_OPENINGS_URL = PROVIDER_METADATA.legacyCurrentOpeningsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalizedPage = normalizeWhitespace(page)

  return /Life at Amnet/i.test(page)
    && /Current Openings/i.test(page)
    && (/careers@amnet\.com/i.test(page) || /Email your resume to/i.test(normalizedPage))
}

export const hasEmailOnlyCurrentOpenings = (html = '') => {
  const normalizedPage = normalizeWhitespace(html)

  return /Email your resume to/i.test(normalizedPage)
    && !/apply now|current roles|job-card|job posting/i.test(normalizedPage)
}

export const hasPublicJobListingSignal = (html = '') => {
  const page = String(html ?? '')

  return /<a[^>]+href="[^"]*(?:\/jobs?\/|greenhouse|lever|ashbyhq|smartrecruiters|workdayjobs|myworkdayjobs|zohorecruit)[^"]*"[^>]*>/i.test(page)
    || /\bapply now\b/i.test(page)
  }

export const isVerifiedMissingLegacyOpeningsRoute = ({ status, html } = {}) =>
  status === 404
  && /Page not found(?:\s*-\s*Amnet)?/i.test(String(html ?? ''))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url,
    finalUrl: response.url || url,
    html: await response.text(),
  }
}

export const createAmnetSystemsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersPage.html) || !hasEmailOnlyCurrentOpenings(careersPage.html)) {
      throw new Error('Amnet Systems careers page no longer matches the verified email-only first-party surface')
    }

    if (hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('Amnet Systems careers page no longer matches the verified email-only first-party surface')
    }

    const legacyPage = await fetchPage(LEGACY_CURRENT_OPENINGS_URL)
    if (!isVerifiedMissingLegacyOpeningsRoute(legacyPage)) {
      throw new Error('Amnet Systems legacy current openings route no longer matches the verified first-party 404 contract')
    }

    return []
  },
})

export const run = async (options = {}) => createAmnetSystemsScraper().run(options)

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
