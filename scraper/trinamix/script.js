import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TRINAMIX_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TRINAMIX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
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

export const hasOfficialCareersShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hasLegacySearchShell = (
    normalized.includes('Innovate with Us')
    && normalized.includes('Current Openings')
    && normalized.includes('Search')
    && normalized.includes('Reset')
    && normalized.includes('Submit Your Resume')
  )
  const hasMinimalJavaScriptShell = (
    /<title>\s*Careers - Trinamix\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Trinamix Careers["']/i.test(rawHtml)
    && /<base[^>]+href=["']\/trinamix\/["']/i.test(rawHtml)
    && /<noscript/i.test(rawHtml)
    && /<script[^>]+src=/i.test(rawHtml)
  )

  return hasLegacySearchShell || hasMinimalJavaScriptShell
}

export const hasServerRenderedRoleInventory = (html = '') =>
  /Apply Now|Job listing|<article[^>]*class=["'][^"']*job/i.test(String(html))

export const createTrinamixScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('TRINAMIX careers page no longer matches the verified first-party shell')
    }

    if (hasServerRenderedRoleInventory(careersHtml)) {
      throw new Error('TRINAMIX public jobs surface changed materially and needs a verified scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createTrinamixScraper(options).run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
