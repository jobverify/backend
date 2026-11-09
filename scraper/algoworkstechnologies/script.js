import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ALGOWORKS_TECHNOLOGIES_CATALOG from './catalog.js'
import { runNativeInventory } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ALGOWORKS_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Algoworks Careers/i.test(page)
    && /Want to join Algoworks\?/i.test(text)
    && /email your resume and cover letter/i.test(text)
    && (/mailto:careers@algoworks\.com/i.test(page) || /\/cdn-cgi\/l\/email-protection/i.test(page))
}

export const hasFirstPartyJobsSignal = (html = '') => /https?:\/\/(?:www\.)?algoworks\.com\/careers\/[a-z0-9-]/i.test(
  String(html ?? ''),
)

export const createAlgoworksTechnologiesScraper = () => ({
  async run({ fetchText, fetchImpl = fetch, signal, ...options } = {}) {
    signal?.throwIfAborted()
    if (!fetchText) return runNativeInventory({ fetchImpl, signal, ...options })
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Algoworks careers page no longer matches the trusted first-party surface')
    }

    if (hasFirstPartyJobsSignal(careersHtml)) {
      throw new Error('Algoworks now exposes a public first-party jobs surface')
    }

    if (/algoworks\.keka\.com/i.test(careersHtml)) {
      return runNativeInventory({ fetchImpl, signal, ...options })
    }

    return []
  },
})

export const run = async (options = {}) => createAlgoworksTechnologiesScraper().run(options)

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
