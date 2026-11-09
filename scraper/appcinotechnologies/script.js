import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { APPCINO_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APPCINO_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasParentCareersHubSignal = (html = '') => {
  const normalized = String(html).replace(/\s+/g, ' ')

  return (
    normalized.includes('<title>Careers | Xebia</title>')
    || normalized.includes('<title>Join Xebia: Top Digital Experts Wanted | People-First Culture</title>')
  )
    && (normalized.includes('Become a Xebian') || normalized.includes('Join us!'))
    && normalized.includes('Open Positions')
    && normalized.includes('North America (USA / Canada)')
}

export const hasAppcinoSpecificInventory = (html = '') =>
  /Appcino Jobs|Appcino Careers|Jaipur, India|itemtype=["']https:\/\/schema\.org\/JobPosting/i.test(String(html))

export const createAppcinoTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasParentCareersHubSignal(html) || hasAppcinoSpecificInventory(html)) {
      throw new Error('The verified Appcino recruiting surface no longer matches the trusted Xebia-hub sentinel')
    }

    return []
  },
})

export const run = async (options = {}) => createAppcinoTechnologiesScraper().run(options)

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
