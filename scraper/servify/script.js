import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SERVIFY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SERVIFY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_EMAIL = PROVIDER_METADATA.officialCareersEmail
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&rsquo;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers\s*(?:&#8211;|&ndash;|-)\s*The product lifecycle management platform\s*<\/title>/i.test(page)
    && text.includes('Make Great Things Happen.')
    && text.includes('Join Servify.')
    && text.includes('Present across 3 continents, Servify has a diverse workforce')
    && text.includes('Apply now and shape your future')
    && text.includes(CAREERS_EMAIL)
}

export const hasVisiblePublicJobsContract = (html = '') => /https?:\/\/(?:jobs\.lever\.co|boards(?:-api)?\.[^"' ]*greenhouse|[^"' ]*myworkdayjobs\.com|[^"' ]*workdayjobs\.com|[^"' ]*smartrecruiters\.com|[^"' ]*jobvite\.com|[^"' ]*ashbyhq\.com)/i.test(String(html ?? ''))
  || /\bjob-card\b/i.test(String(html ?? ''))
  || /\bopening-card\b/i.test(String(html ?? ''))
  || /\bcurrent openings\b/i.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'servify-html',
  timeoutMs: 15000,
})

export const createServifyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Servify verified official careers page changed materially')
    }

    if (hasVisiblePublicJobsContract(careersHtml)) {
      throw new Error('Servify public jobs surface detected on the official careers page')
    }

    return []
  },
})

export const run = async (options = {}) => createServifyScraper(options).run(options)

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
