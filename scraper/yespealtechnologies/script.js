import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yespealtechnologies'
export const COMPANY = 'Yespeal Technologies'
export const VERIFIED_AT = '2026-07-13'

export const CAREERS_PATHS = [
  '/',
  '/careers',
  '/careers/',
  '/career',
  '/jobs',
  '/jobs/',
]

export const OFFICIAL_SURFACE_CANDIDATES = [
  'https://yespealtechnologies.com',
  'https://www.yespealtechnologies.com',
  'https://yespealtechnologies.in',
  'https://www.yespealtechnologies.in',
  'https://yespealtechnologies.co.in',
  'https://www.yespealtechnologies.co.in',
  'https://yespeal.com',
  'https://www.yespeal.com',
  'https://yespeal.in',
  'https://www.yespeal.in',
  'https://yespeal.co.in',
  'https://www.yespeal.co.in',
  'https://yespealtech.com',
  'https://www.yespealtech.com',
  'https://yespealtech.in',
  'https://www.yespealtech.in',
  'https://yespealtech.co.in',
  'https://www.yespealtech.co.in',
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  attempts: 1,
  timeoutMs: 5000,
})

export const isExpectedMissingSurfaceError = (error) => {
  const message = String(error?.message || error || '').toLowerCase()

  return message.includes('could not be resolved')
    || message.includes('enotfound')
    || message.includes('dns lookup failed')
    || message.includes('name or service not known')
    || message.includes('nxdomain')
}

const buildProbeUrls = () =>
  OFFICIAL_SURFACE_CANDIDATES.map((baseUrl) => new URL('/', `${baseUrl}/`).toString())

export const createYespealTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    for (const url of buildProbeUrls()) {
      try {
        await fetchText(url)
        throw new Error(`${COMPANY} official first-party surface changed: ${url} now resolves publicly`)
      } catch (error) {
        if (isExpectedMissingSurfaceError(error)) {
          continue
        }

        throw new Error(`${COMPANY} official first-party surface changed: ${url} no longer matches the verified missing-surface checks`, {
          cause: error,
        })
      }
    }

    return []
  },
})

export const run = async (options = {}) => createYespealTechnologiesScraper().run(options)

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
