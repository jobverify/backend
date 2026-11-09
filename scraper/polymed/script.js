import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import POLYMED_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = POLYMED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_OPENING_URL = PROVIDER_METADATA.officialJobOpeningUrl
export const OFFICIAL_CAREERS_EMAIL = PROVIDER_METADATA.officialCareersEmail
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasPublicJobBoardSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /\b(current openings?|open positions?|job id|requisition id|req id|apply now)\b/i.test(text)
    || /\bjob-card\b/i.test(page)
    || /https?:\/\/(?:jobs\.lever\.co|boards(?:-api)?\.[^"' ]*greenhouse|[^"' ]*myworkdayjobs\.com|[^"' ]*workdayjobs\.com|[^"' ]*smartrecruiters\.com|[^"' ]*jobvite\.com|[^"' ]*ashbyhq\.com)/i.test(page)
  }

export const hasOfficialCareersFormSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return (/<title>\s*Careers At Polymed\s*<\/title>/i.test(page)
      || /<title>\s*Careers\s*-\s*Polymedicure Limited\s*<\/title>/i.test(page)
      || /property=["']og:title["'][^>]*content=["']Careers\s*-\s*Polymedicure Limited["']/i.test(page))
    && text.includes('Careers At Polymed')
    && text.includes('Send us your application')
    && text.includes('Upload Resume')
    && (text.includes('Submit Application') || /value=["']Submit Application["']/i.test(page))
  }

export const extractOfficialCareersEmail = (html = '') => {
  const emailMatch = String(html ?? '').match(/\b([a-z0-9._%+-]+@polymedicure\.com)\b/i)
  return emailMatch?.[1]?.toLowerCase() ?? null
}

export const hasStaleJobOpeningSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('Job Opening')
    && (/2019-10-21/i.test(page) || text.includes('October 21, 2019'))
    && text.includes('Product Quick Finder')
    && (/property=["']og:title["'][^>]*content=["']Job Opening\s*-\s*Polymedicure Limited["']/i.test(page)
      || /<title>\s*Job Opening\s*-\s*Polymedicure Limited\s*<\/title>/i.test(page)
      || /\[vc_row/i.test(page)
      || text.includes('Career'))
  }

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPolymedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (hasPublicJobBoardSignals(careersHtml)) {
      throw new Error('Polymed public jobs surface detected on the official careers page')
    }
    if (!hasOfficialCareersFormSignal(careersHtml)) {
      throw new Error('Polymed verified official careers form changed materially')
    }
    const careersEmail = extractOfficialCareersEmail(careersHtml)
    if (careersEmail && careersEmail !== OFFICIAL_CAREERS_EMAIL) {
      throw new Error('Polymed verified official careers email changed materially')
    }

    const jobOpeningHtml = await fetchText(JOB_OPENING_URL)
    if (hasPublicJobBoardSignals(jobOpeningHtml)) {
      throw new Error('Polymed public jobs surface detected on the job-opening page')
    }
    if (!hasStaleJobOpeningSignal(jobOpeningHtml)) {
      throw new Error('Polymed verified stale job-opening page changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPolymedScraper(options).run(options)

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
