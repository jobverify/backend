import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TANGOE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_VENDOR_HOST = PROVIDER_METADATA.careersVendorHost

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Join Our Innovative Global Team')
    && normalized.includes('Join Team Tangoe to help us shape the future and lead change.')
    && normalized.includes('Competitive Salaries')
    && normalized.includes('Remote Work')
}

export const hasOpaqueAdpHandoffSignal = (html = '') =>
  new RegExp(`https://${CAREERS_VENDOR_HOST.replace('.', '\\.')}`, 'i').test(String(html ?? ''))
    && /Search Careers/i.test(String(html ?? ''))

export const hasTrustworthyPublicJobInventorySignal = (html = '') =>
  /jobTitle|job opening|open roles|current openings|job card|jobs\.lever\.co|greenhouse|zohorecruit|ashbyhq/i
    .test(String(html ?? ''))
    && !hasOpaqueAdpHandoffSignal(html)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTangoeScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Tangoe verified careers page no longer matches the known first-party surface')
    }

    if (!hasOpaqueAdpHandoffSignal(careersHtml)) {
      throw new Error('Tangoe verified ADP careers handoff no longer matches the known public surface')
    }

    if (hasTrustworthyPublicJobInventorySignal(careersHtml)) {
      throw new Error('Tangoe now exposes a trustworthy public jobs inventory')
    }

    return []
  },
})

export const run = async (options = {}) => createTangoeScraper().run(options)

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
