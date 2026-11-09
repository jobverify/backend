import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import REBEL_FOODS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = REBEL_FOODS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_EMAIL = PROVIDER_METADATA.officialCareersEmail
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

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

  return /<title>\s*Join the Rebel team\b/i.test(page)
    && text.includes('Rebel Foods')
    && text.includes('Join the Rebel team')
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
  label: 'rebelfoods-html',
  timeoutMs: 15000,
})

export const createRebelFoodsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Rebel Foods verified official careers page changed materially')
    }

    if (hasVisiblePublicJobsContract(careersHtml)) {
      throw new Error('Rebel Foods public jobs surface detected on the official careers page')
    }

    return []
  },
})

export const run = async (options = {}) => createRebelFoodsScraper(options).run(options)

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
