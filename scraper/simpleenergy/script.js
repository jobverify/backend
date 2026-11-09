import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'simpleenergy'
export const COMPANY = 'Simple Energy'
export const HOMEPAGE_URL = 'https://www.simpleenergy.in/'

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

const stripTags = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const text = stripTags(html)
  return /\bSimple Energy\b/i.test(text)
    && text.includes('U29309KA2019PTC127859')
    && /\bSimple One\b/i.test(text)
}

export const createSimpleEnergyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(html)) {
      throw new Error('Simple Energy homepage no longer matches the verified first-party surface')
    }

    // No official careers or ATS-backed public jobs surface is currently published.
    return []
  },
})

export const run = async (options = {}) => createSimpleEnergyScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/simpleenergy/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
