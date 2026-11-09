import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { RYSUN_LABS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RYSUN_LABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OBSERVED_PUBLIC_JOBS_URL = PROVIDER_METADATA.observedPublicJobsUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const hasObservedCareerPlugSignal = (html = '') => {
  const page = String(html ?? '')
  return /Rysun Labs Inc/i.test(page)
    && /Show Me All Jobs/i.test(page)
    && /careerplug/i.test(OBSERVED_PUBLIC_JOBS_URL)
}

export const createRysunLabsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(OBSERVED_PUBLIC_JOBS_URL)
    if (!hasObservedCareerPlugSignal(html)) {
      throw new Error('Rysun Labs observed third-party CareerPlug board changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createRysunLabsScraper().run(options)

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
