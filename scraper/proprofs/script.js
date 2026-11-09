import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import PROPROFS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROPROFS_CATALOG.source
export const COMPANY = PROPROFS_CATALOG.companyName
export const ABOUT_URL = PROPROFS_CATALOG.companyCareerPage
export const CAREERS_URL = PROPROFS_CATALOG.blockedCareersUrl
export const JOBS_URL = PROPROFS_CATALOG.blockedJobsUrl
export const VERIFIED_ON = PROPROFS_CATALOG.verifiedOn
export const PROVIDER_METADATA = PROPROFS_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const hasVerifiedProProfsAboutSignal = (html) =>
  /<title>\s*ProProfs\s*-\s*Delightfully Smart Tools\s*<\/title>/i.test(String(html))
  && /Delhi-NCR/i.test(String(html))
  && /build extraordinary careers/i.test(String(html))

export const isBlockedRouteResponse = (response = {}) =>
  Number(response?.status ?? 0) === 0
  || /socket|connection|abort|reset|hang up/i.test(String(response?.error ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  try {
    return {
      status: 200,
      url,
      html: await defaultFetchText(url),
    }
  } catch (error) {
    return {
      status: 0,
      url,
      html: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export const createProProfsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasVerifiedProProfsAboutSignal(aboutPage.html)) {
      throw new Error('ProProfs verified exact-name about page changed')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    const jobsPage = await fetchPage(JOBS_URL)

    if (!isBlockedRouteResponse(careersPage) || !isBlockedRouteResponse(jobsPage)) {
      throw new Error('ProProfs public careers routes no longer match the verified blocked state')
    }

    return []
  },
})

export const run = async (options = {}) => createProProfsScraper().run(options)

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
