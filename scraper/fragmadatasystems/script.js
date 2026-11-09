import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FRAGMA_DATA_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FRAGMA_DATA_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => ({
  url,
  ...(await (async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  })()),
})

export const hasHomepageCareersEmailOnlySignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return /<title>\s*Fragma Data\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Transforming Your Enterprise Data into Growth Engines')
    && normalized.includes('Careers/Job Enquiry:')
    && normalized.includes('careers@fragmadata.com')
    && !pageExposesPublicJobs(html)
}

export const isExpectedMissingCareersRoute = (response = {}) =>
  response?.status === 404 && /page not found/i.test(normalizeWhitespace(response?.html ?? ''))

export const pageExposesPublicJobs = (html = '') =>
  /<a[^>]+href=["'][^"']*(?:\/jobs\/|\/careers\/|\/job\/)[^"']*["'][^>]*>[\s\S]*?<\/a>/i.test(String(html ?? ''))

export const createFragmaDataSystemsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (pageExposesPublicJobs(homepage?.html ?? '')) {
      throw new Error('The Fragma Data homepage now exposes public jobs')
    }
    if (homepage?.status !== 200 || !hasHomepageCareersEmailOnlySignal(homepage.html)) {
      throw new Error('The trusted Fragma Data homepage contract changed materially')
    }

    const careersRoute = await fetchPage(CAREERS_URL)
    if (!isExpectedMissingCareersRoute(careersRoute)) {
      throw new Error('The trusted Fragma Data exact-name careers route no longer returns the verified missing-page response')
    }

    return []
  },
})

export const run = async (options = {}) => createFragmaDataSystemsScraper().run(options)

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
