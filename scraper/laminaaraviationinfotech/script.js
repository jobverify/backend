import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { LAMINAAR_AVIATION_INFOTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LAMINAAR_AVIATION_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

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

export const hasVerifiedSpaShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /<title>\s*Laminaar Aviation Infotech \(India\) Pvt\. Ltd\.\s*<\/title>/i.test(rawHtml)
    && /<div[^>]*id=["']root["'][^>]*><\/div>/i.test(rawHtml)
    && /\/assets\/index-[^"']+\.js/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html = '') =>
  /\b(careers?|job openings?|current openings|join us|apply now)\b/i.test(String(html ?? ''))

export const createLaminaarAviationInfotechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    const careersHtml = await fetchText(CAREERS_URL)

    if (
      !hasVerifiedSpaShellSignal(homepageHtml)
      || !hasVerifiedSpaShellSignal(careersHtml)
      || hasPublicJobsSignal(homepageHtml)
      || hasPublicJobsSignal(careersHtml)
    ) {
      throw new Error('Laminaar verified first-party SPA shell no longer matches the known fail-closed contract')
    }

    return []
  },
})

export const run = async (options = {}) => createLaminaarAviationInfotechScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
