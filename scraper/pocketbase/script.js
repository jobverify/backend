import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import POCKETBASE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = POCKETBASE_CATALOG.source
export const COMPANY = POCKETBASE_CATALOG.companyName
export const PROVIDER_METADATA = POCKETBASE_CATALOG
export const COMPANY_DOMAIN = POCKETBASE_CATALOG.companyDomain
export const HOMEPAGE_URL = POCKETBASE_CATALOG.homepageUrl
export const CAREERS_URL = POCKETBASE_CATALOG.companyCareerPage
export const FAQ_URL = POCKETBASE_CATALOG.faqPageUrl
export const VERIFIED_AT = POCKETBASE_CATALOG.verifiedOn

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*pocketbase(?:\s*-\s*open source backend in 1 file)?\s*<\/title>/i.test(page)
    && normalized.includes('open source backend in 1 file')
    && normalized.includes('documentation')
    && normalized.includes('faq')
}

export const hasOfficialFaqSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /pocketbase is neither a startup,\s*nor a business\./i.test(normalized)
    && /there is no paid team or company behind it\./i.test(normalized)
    && /personal open source project/i.test(normalized)
}

export const createPocketBaseScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Verified PocketBase homepage changed materially')
    }

    const faqHtml = await fetchText(FAQ_URL)
    if (!hasOfficialFaqSignal(faqHtml)) {
      throw new Error('Verified PocketBase FAQ no-company statement changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPocketBaseScraper().run(options)

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
