import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jindalsteelandpower'
export const COMPANY = 'Jindal Steel and Power'
export const HOMEPAGE_URL = 'https://www.jindalsteel.in/'
export const CAREERS_URL = 'https://www.jindalsteel.in/career-opportunity'
export const TALENT_COMMUNITY_URL = 'https://www.jindalsteel.in/join-our-talent-community'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html) => {
  const page = normalizeWhitespace(html)
  return page.includes('Jindal Steel') && page.includes('Formerly Jindal Steel & Power Limited')
}

export const hasOfficialCareersSignal = (html) => {
  const page = normalizeWhitespace(html)
  return page.includes('Are you Ready to Steel the Future?')
    && page.includes('Build Your Future With Us')
    && page.includes('Join Our Talent')
    && page.includes('Current Openings')
}

export const hasTalentCommunitySignal = (html) => {
  const page = normalizeWhitespace(html)
  return page.includes('Join Our Talent Community')
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

export const pageExposesPublicJobListings = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJindalSteelAndPowerScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Jindal Steel and Power official homepage changed; refusing to assume the verified careers surface still applies')
    }

    if (pageExposesPublicJobListings(homepageHtml)) {
      throw new Error('Jindal Steel and Power homepage now appears to expose public job listings')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Jindal Steel and Power careers page changed; refusing to assume the verified no-jobs surface still applies')
    }

    if (pageExposesPublicJobListings(careersHtml)) {
      throw new Error('Jindal Steel and Power careers page now appears to expose public job listings')
    }

    const talentCommunityHtml = await fetchText(TALENT_COMMUNITY_URL)

    if (!hasTalentCommunitySignal(talentCommunityHtml)) {
      throw new Error('Jindal Steel and Power talent community page changed; refusing to assume the verified resume-drop flow still applies')
    }

    if (pageExposesPublicJobListings(talentCommunityHtml)) {
      throw new Error('Jindal Steel and Power talent community page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createJindalSteelAndPowerScraper().run(options)

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
