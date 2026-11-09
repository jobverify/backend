import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { RADIXWEB_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RADIXWEB_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
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

export const hasOfficialShellSignal = (html = '') => {
  const raw = String(html ?? '')
  return /Current Job Openings .* Radixweb/i.test(raw)
    && /rel="canonical" href="https:\/\/radixweb\.com\/current-openings"/i.test(raw)
    && /id="tez_app"/i.test(raw)
    && /\/assets\/tez\.[^"]+\.js/i.test(raw)
}

export const hasServerRenderedJobsSignal = (html = '') =>
  /more details|trainee software engineer|senior ai engineer|business analyst|href=["'][^"']*current-openings\/[^"']+["']/i.test(
    normalizeWhitespace(html),
  )

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const html = await fetchText(CAREERS_URL)

  if (!hasOfficialShellSignal(html)) {
    throw new Error('Radixweb verified current-openings shell changed materially')
  }

  if (hasServerRenderedJobsSignal(html)) {
    throw new Error('Radixweb server-rendered public jobs appeared on the current-openings shell route')
  }

  return []
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
