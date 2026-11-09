import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URLS = [
  'https://www.radspanwirelesssystems.com/',
  'https://radspanwirelesssystems.com/',
  'https://www.radspan.com/',
  'https://radspan.com/',
]

export const CAREERS_URLS = [
  'https://www.radspanwirelesssystems.com/careers',
  'https://radspanwirelesssystems.com/careers',
  'https://www.radspan.com/careers',
  'https://radspan.com/careers',
  'https://www.radspanwirelesssystems.com/jobs',
  'https://radspanwirelesssystems.com/jobs',
  'https://www.radspan.com/jobs',
  'https://radspan.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const DOMAIN_ABSENT_PATTERNS = [
  /\bENOTFOUND\b/i,
  /\bEAI_AGAIN\b/i,
  /\bCould not resolve host\b/i,
  /\bDNS name does not exist\b/i,
  /\bName or service not known\b/i,
  /\bNXDOMAIN\b/i,
]

const normalizeMessage = (error) => {
  const parts = [
    error?.message,
    error?.cause?.message,
    error?.code,
    error?.cause?.code,
  ].filter(Boolean)

  return parts.join(' ')
}

export const isDomainAbsentError = (error) => {
  const message = normalizeMessage(error)
  return DOMAIN_ABSENT_PATTERNS.some((pattern) => pattern.test(message))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'radspanwirelesssystems',
  timeoutMs: 15000,
})

export const createRadspanWirelessSystemsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    for (const url of [...HOMEPAGE_URLS, ...CAREERS_URLS]) {
      try {
        await fetchText(url)
        throw new Error(`RADSPAN Wireless Systems public surface changed at ${url}`)
      } catch (error) {
        if (isDomainAbsentError(error)) {
          continue
        }

        if (/public surface changed/i.test(String(error?.message ?? ''))) {
          throw error
        }

        throw new Error(
          `RADSPAN Wireless Systems sentinel could not verify the verified no-surface condition at ${url}: ${error?.message ?? error}`,
        )
      }
    }

    return []
  },
})

export const run = async () => createRadspanWirelessSystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running RADSPAN Wireless Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)

  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'radspanwirelesssystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
