import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { QENTELLI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = QENTELLI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_URL = PROVIDER_METADATA.blockedJobsPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const pageExposesPublicJobs = (html = '') => (
  /\bcurrent openings\b/i.test(String(html ?? ''))
  || /\bapply now\b/i.test(String(html ?? ''))
  || /\/jobs\//i.test(String(html ?? ''))
)

export const createQentelliScraper = ({ fetchPage = defaultFetchPage } = {}) => ({
  async run({ fetchPage: overrideFetchPage } = {}) {
    for (const url of [HOMEPAGE_URL, CAREERS_URL, JOBS_URL]) {
      const page = await (overrideFetchPage || fetchPage)(url)

      if (pageExposesPublicJobs(page.html)) {
        throw new Error('The verified Qentelli surface now appears to expose a public jobs surface')
      }

      if (Number(page.status) !== 403) {
        throw new Error('The verified Qentelli first-party routes are no longer consistently 403-blocked')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createQentelliScraper().run(options)

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
