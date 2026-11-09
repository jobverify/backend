import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runRocketNativeRecruitment } from './nativeRun.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ROCKET_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.workdayBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
  signal,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\b/i.test(page)
    && /Rocket Software/i.test(text)
    && /Current Openings|View current openings/i.test(text)
    && page.includes(WORKDAY_BOARD_URL)
}

export const createRocketSoftwareScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    runWorkday = runRocketNativeRecruitment,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await (signal === undefined ? fetchText(CAREERS_URL) : fetchText(CAREERS_URL, { signal }))
    signal?.throwIfAborted()

    const officialHandoffVerified = Boolean(careersHtml && hasOfficialCareersSignal(careersHtml))
    if (!officialHandoffVerified) {
      throw new Error('Rocket Software current corporate recruitment handoff is unavailable; refusing the stored ATS account')
    }

    const jobs = await runWorkday({
      company: COMPANY,
      baseUrl: WORKDAY_BOARD_URL,
      locationCountry: 'India',
      source: SOURCE,
      scraperDir: currentDir,
      ...(signal === undefined ? {} : { signal }),
    })
    signal?.throwIfAborted()

    const mapped = jobs.map((job) => ({
      ...job,
      company: job.company || COMPANY,
      source: job.source || SOURCE,
      sourceUrl: job.sourceUrl || job.link || null,
      applyUrl: job.applyUrl || job.link || null,
    }))
    // Native inventory/country receipts are non-enumerable array symbols.
    // Keep them when decorating the independently returned native jobs.
    for (const symbol of Object.getOwnPropertySymbols(jobs)) {
      Object.defineProperty(mapped, symbol, Object.getOwnPropertyDescriptor(jobs, symbol))
    }
    return mapped
  },
})

export const run = async (options = {}) => createRocketSoftwareScraper().run(options)

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
