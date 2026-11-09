import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SHELL_RECHARGE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SHELL_RECHARGE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes('Elektrisch opladen | Shell Nederland')
    && page.includes('Shell Recharge')
}

export const hasGenericShellCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes('<title>Shell Global</title>')
    && page.includes('application-name" content="Shell Global')
}

export const createShellRechargeSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Shell Recharge Solutions homepage no longer matches the verified brand surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasGenericShellCareersSignal(careersHtml)) {
      throw new Error('Shell Recharge Solutions careers route no longer matches the verified generic Shell surface')
    }

    return []
  },
})

export const run = async (options = {}) => createShellRechargeSolutionsScraper().run(options)

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
