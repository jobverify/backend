import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BHASH_SOFTWARE_LABS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BHASH_SOFTWARE_LABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes('<title>Bhash Softwares</title>')
    && page.includes('Contact Us')
    && page.includes('info@bhashsoftware.com')
}

export const hasMissingCareersRouteSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes('Page not found')
    && page.includes('Bhash Softwares')
    && page.includes('Oops! Page Not Found')
    && page.includes('<h2>404</h2>')
}

export const createBhashSoftwareLabsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Bhash Software Labs homepage no longer matches the verified first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 404 || !hasMissingCareersRouteSignal(careersPage.html)) {
      throw new Error('Bhash Software Labs careers route no longer matches the verified missing-page surface')
    }

    return []
  },
})

export const run = async (options = {}) => createBhashSoftwareLabsScraper().run(options)

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
