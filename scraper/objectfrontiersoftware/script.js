import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { OBJECT_FRONTIER_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = OBJECT_FRONTIER_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PARKED_LANDER_URL = PROVIDER_METADATA.parkedLanderUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => ({
  status: 200,
  url,
  html: await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  }),
})

export const isRedirectToLanderShell = (html = '') =>
  /window\.location\.href\s*=\s*["']\/lander["']/i.test(String(html ?? ''))

export const isParkedLanderShell = (html = '') => {
  const page = String(html ?? '')
  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && (/parking/i.test(page) || /_trfd/i.test(page))
}

export const pageExposesPublicJobs = (html = '') =>
  /<a[^>]+href=["'][^"']*(?:\/jobs\/|\/careers\/|\/job\/)[^"']*["'][^>]*>[\s\S]*?<\/a>/i.test(String(html ?? ''))

export const createObjectFrontierSoftwareScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (pageExposesPublicJobs(homepage?.html ?? '')) {
      throw new Error('The trusted exact-name surface now exposes public jobs')
    }
    if (homepage?.status !== 200 || !isRedirectToLanderShell(homepage.html)) {
      throw new Error('The trusted exact-name surface changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (pageExposesPublicJobs(careersPage?.html ?? '')) {
      throw new Error('The Object Frontier careers page now exposes public jobs')
    }
    if (careersPage?.status !== 200 || !isRedirectToLanderShell(careersPage.html)) {
      throw new Error('The trusted Object Frontier careers route changed materially')
    }

    const parkedLander = await fetchPage(PARKED_LANDER_URL)
    if (parkedLander?.status !== 200 || !isParkedLanderShell(parkedLander.html)) {
      throw new Error('The parked Object Frontier lander no longer matches the verified shell')
    }

    return []
  },
})

export const run = async (options = {}) => createObjectFrontierSoftwareScraper().run(options)

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
