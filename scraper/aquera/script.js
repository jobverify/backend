import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://aquera.com/'
export const CAREERS_PAGE_URL = 'https://aquera.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Aquera \| HR (?:&|&amp;) Identity Integration Platform as a Service\s*<\/title>/i
const OFFICIAL_SITE_PATTERN = /HR-Driven Automated IT Onboarding|About Aquera|Aquera 360 HR & Identity Integration Platform/i
const PUBLIC_JOBS_BOARD_PATTERN = /\b(job openings|open positions|search jobs|view jobs|apply now|greenhouse|lever\.co|workdayjobs|smartrecruiters|ashby|jobvite)\b/i
const MISSING_CAREER_ROUTE_PATTERN = /\b(404|not found)\b/i

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_TITLE_PATTERN.test(page) && /About Aquera/i.test(page)
}

export const hasOfficialSiteSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_TITLE_PATTERN.test(page) && OFFICIAL_SITE_PATTERN.test(page)
}

export const hasPublicJobsBoardSignal = (html) => {
  const page = String(html ?? '')

  if (PUBLIC_JOBS_BOARD_PATTERN.test(page)) return true

  return /\bcareers\b/i.test(page) && /\/jobs?\//i.test(page)
}

export const hasMissingCareerRouteSignal = (html) =>
  MISSING_CAREER_ROUTE_PATTERN.test(String(html ?? ''))

const isMissingCareerRouteError = (error) =>
  /HTTP 404\b/i.test(String(error?.message ?? error))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: 'aquera',
  timeoutMs: 15000,
})

export const createAqueraScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Aquera homepage no longer matches the verified official public site')
    }

    let careersHtml = null

    try {
      careersHtml = await fetchText(CAREERS_PAGE_URL)
    } catch (error) {
      if (isMissingCareerRouteError(error)) return []
      throw error
    }

    if (hasMissingCareerRouteSignal(careersHtml)) {
      return []
    }

    if (hasPublicJobsBoardSignal(careersHtml)) {
      throw new Error('Aquera careers route now appears to expose public job listings')
    }

    if (!hasOfficialSiteSignal(careersHtml)) {
      throw new Error('Aquera careers route no longer matches the verified official public site shape')
    }

    return []
  },
})

export const run = async () => createAqueraScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'aquera')
}
