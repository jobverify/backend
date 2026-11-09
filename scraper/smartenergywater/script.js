import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SMART_ENERGY_WATER_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_DETAIL_URL = PROVIDER_METADATA.knownIndiaJobDetailUrl

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
  const title = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''

  return (
    normalized.includes('Join the SEW Mission')
    && normalized.includes('Explore Job Openings')
    && normalized.includes('Help Us Shape the Future')
  ) || (
    /SEW Careers \| Be Part of Our Future Success/i.test(title)
    && /skilled and innovative individuals/i.test(normalized)
    && /shape the future/i.test(normalized)
  )
}

export const hasVerifiedIndiaDetailSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Product Engineer- .Net')
    && normalized.includes('Noida (India)')
    && normalized.includes('Apply for This Job')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSmartEnergyWaterScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Smart Energy Water verified careers landing page no longer matches the known first-party surface')
    }

    const detailHtml = await fetchText(INDIA_DETAIL_URL)
    if (!hasVerifiedIndiaDetailSignal(detailHtml)) {
      throw new Error('Smart Energy Water verified India detail page no longer matches the known public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSmartEnergyWaterScraper().run(options)

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
