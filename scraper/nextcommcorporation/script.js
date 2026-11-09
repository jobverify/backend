import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NEXTCOMM_CORPORATION_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LANDER_URL = PROVIDER_METADATA.landerUrl
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
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

export const hasRedirectShellSignal = (html) => {
  const page = String(html ?? '')
  return page.includes('window.location.href="/lander"')
    && normalizeWhitespace(page).includes('window.location.href="/lander"')
}

export const hasParkingLanderSignal = (html) => {
  const page = String(html ?? '')
  return page.includes('window.LANDER_SYSTEM="PW"')
    && page.includes('parking-lander')
    && page.includes('img1.wsimg.com')
}

export const createNextCommCorporationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    const careersHtml = await fetchText(CAREERS_URL)
    const landerHtml = await fetchText(LANDER_URL)

    if (!hasRedirectShellSignal(homepageHtml) || !hasRedirectShellSignal(careersHtml)) {
      throw new Error('NextComm Corporation exact-domain redirect shell changed materially')
    }

    if (!hasParkingLanderSignal(landerHtml)) {
      throw new Error('NextComm Corporation lander no longer matches the verified parking surface')
    }

    return []
  },
})

export const run = async (options = {}) => createNextCommCorporationScraper().run(options)

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
