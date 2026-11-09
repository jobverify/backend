import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PEAK_AI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PEAK_AI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_HOME_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const INDIA_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
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

export const hasOfficialCareersHomeSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*Peak\s*<\/title>/i.test(page)
    && text.includes('Peak')
    && text.includes('India Careers')
}

export const extractIndiaCareersUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href="(https:\/\/peak\.ai\/company\/careers\/india\/?)"[^>]*>\s*(?:India Careers|Open opportunities)\s*<\/a>/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1]).toString()
  } catch {
    return null
  }
}

export const hasOfficialIndiaCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers in India\s*-\s*Peak\s*<\/title>/i.test(page)
    && text.includes('Our India Opportunities')
}

export const hasExplicitNoOpportunitiesSignal = (html = '') =>
  normalizeWhitespace(html).includes('There are currently no opportunities')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'peakai-html',
  timeoutMs: 15000,
})

export const createPeakAiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHomeHtml = await fetchText(CAREERS_HOME_URL)

    if (!hasOfficialCareersHomeSignal(careersHomeHtml)) {
      throw new Error('Peak AI verified official careers landing page changed materially')
    }

    if (extractIndiaCareersUrl(careersHomeHtml) !== INDIA_CAREERS_URL) {
      throw new Error('Peak AI verified India careers handoff changed materially')
    }

    const indiaCareersHtml = await fetchText(INDIA_CAREERS_URL)

    if (!hasOfficialIndiaCareersSignal(indiaCareersHtml)) {
      throw new Error('Peak AI verified official India careers page changed materially')
    }

    if (!hasExplicitNoOpportunitiesSignal(indiaCareersHtml)) {
      throw new Error('Peak AI India careers board no longer says there are currently no opportunities')
    }

    return []
  },
})

export const run = async (options = {}) => createPeakAiScraper(options).run(options)

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
