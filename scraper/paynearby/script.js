import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PAYNEARBY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PAYNEARBY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LINKEDIN_COMPANY_URL = PROVIDER_METADATA.officialLinkedInCompanyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const stripHtmlComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

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

  return /<title>\s*Careers Learning\b/i.test(page)
    && text.includes('Current job openings')
    && text.includes('Open Position')
    && text.includes('PayNearby')
}

export const extractLinkedInCompanyUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href="(https:\/\/www\.linkedin\.com\/company\/paynearby\/?)"[^>]*>\s*Open Position\s*<\/a>/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1]).toString()
  } catch {
    return null
  }
}

export const hasVisiblePublicJobsContract = (html = '') => {
  const visiblePage = stripHtmlComments(String(html ?? ''))

  return /\bjob-preview\b/i.test(visiblePage)
    || /\bapply-btn\b/i.test(visiblePage)
    || /\bjob-listing-categories\b/i.test(visiblePage)
    || /https?:\/\/(?:jobs\.lever\.co|boards(?:-api)?\.[^"' ]*greenhouse|[^"' ]*myworkdayjobs\.com|[^"' ]*workdayjobs\.com|[^"' ]*smartrecruiters\.com|[^"' ]*jobvite\.com|[^"' ]*ashbyhq\.com)/i.test(visiblePage)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'paynearby-html',
  timeoutMs: 15000,
})

export const createPayNearbyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('PayNearby verified official careers page changed materially')
    }

    if (extractLinkedInCompanyUrl(careersHtml) !== LINKEDIN_COMPANY_URL) {
      throw new Error('PayNearby verified LinkedIn company handoff changed materially')
    }

    if (hasVisiblePublicJobsContract(careersHtml)) {
      throw new Error('PayNearby public jobs surface detected on the official careers page')
    }

    return []
  },
})

export const run = async (options = {}) => createPayNearbyScraper(options).run(options)

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
