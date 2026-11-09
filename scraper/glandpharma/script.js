import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { GLAND_PHARMA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GLAND_PHARMA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ADJACENT_CAREERS_ROUTE_URLS = [
  'https://glandpharma.com/career',
  'https://glandpharma.com/jobs',
]
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Injectable Manufacturer\s*&\s*Supplier\s*\|\s*CDMO Company\s*\|\s*Gland Pharma Limited\s*<\/title>/i.test(page)
    && /"name"\s*:\s*"Gland Pharma Limited"/i.test(page)
    && /"alternateName"\s*:\s*"Gland Pharma"/i.test(page)
    && /https:\/\/glandpharma\.com\/images\/(?:logo|header_logo)\.(?:png|webp)/i.test(page)
}

export const hasVerifiedCareerShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Gland Pharma\s*<\/title>/i.test(page)
    && /"name"\s*:\s*"Gland Pharma Limited"/i.test(page)
    && /"alternateName"\s*:\s*"Gland Pharma"/i.test(page)
    && /https:\/\/glandpharma\.com\/images\/header_logo\.webp/i.test(page)
    && /gland@glandpharma\.com/i.test(page)
}

export const hasPublicJobSignals = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

export const createGlandPharmaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasVerifiedHomepageSignal(homepageHtml)) {
      throw new Error('Gland Pharma verified homepage no longer matches the known first-party surface')
    }

    const routeUrls = [CAREERS_URL, ...ADJACENT_CAREERS_ROUTE_URLS]

    for (const routeUrl of routeUrls) {
      const routeHtml = await fetchText(routeUrl)
      if (hasPublicJobSignals(routeHtml)) {
        throw new Error(`Gland Pharma route now appears to expose a public jobs surface: ${routeUrl}`)
      }
      if (!hasVerifiedCareerShellSignal(routeHtml)) {
        throw new Error('Gland Pharma verified careers shell no longer matches the known first-party surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createGlandPharmaScraper().run(options)

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
