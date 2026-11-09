import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ENTRUST_SOFTWARE_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ENTRUST_SOFTWARE_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
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
  const normalized = normalizeWhitespace(page)

  return /<title>\s*eNTrust Software Services\s*<\/title>/i.test(page)
    && normalized.includes('eNTrust is a global business process outsourcing (KPO) company')
    && normalized.includes('Get in touch')
    && normalized.includes('Quick Links About eNTrust Terms of Use')
    && normalized.includes('info@ntrustinfotech.com')
}

export const hasCareerNavigationSignal = (html = '') => /\bCareers\b/i.test(normalizeWhitespace(html))

export const hasPublicJobListingSignal = (html = '') => /data-job-id=|Apply now|Open Roles|Current Openings/i.test(
  String(html ?? ''),
)

export const createEntrustSoftwareServicesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (hasCareerNavigationSignal(homepageHtml) || hasPublicJobListingSignal(homepageHtml)) {
      throw new Error('The verified eNTrust homepage now exposes public jobs')
    }

    if (!hasVerifiedHomepageSignal(homepageHtml)) {
      throw new Error('The verified eNTrust homepage no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEntrustSoftwareServicesScraper().run(options)

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
