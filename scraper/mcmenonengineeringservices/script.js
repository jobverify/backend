import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mcmenonengineeringservices'
export const COMPANY = 'McMenon Engineering Services Ltd.'
export const HOMEPAGE_URL = 'https://www.mcmenon.com/'
export const CAREERS_URL = 'https://www.mcmenon.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 3,
    baseDelayMs: 2000,
    timeoutMs: 20000,
    label: SOURCE,
  })

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.mcmenon\.com)?\/careers\/["']/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('mcmenon engineering')
    && normalized.includes('flow temperature instruments uk')
    && normalized.includes('careers')
}

const hasCurrentCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  return /<title\b[^>]*>\s*Careers \| McMenon Engineering\s*<\/title>/i.test(page)
    && normalized.includes('build your future with mcmenon')
    && normalized.includes('engineering the future. investing in people.')
    && normalized.includes('email your cv to')
    && normalized.includes('hr@mcmenon.com')
    && normalized.includes('mcmenon engineering services ltd.')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const legacySignal = normalized.includes('mcmenon - champions of diversity and committed to transition towards net zero looking for talent to support exciting growth plans')
    && normalized.includes('email your resume to')
    && normalized.includes('hr@mcmenon.com')
  return legacySignal || hasCurrentCareersSignal(html)
}

export const hasVerifiedEmptyVacanciesSignal = (html) => {
  const page = String(html ?? '')
  return hasCurrentCareersSignal(page)
    && /<h2\b[^>]*>\s*Current vacancies\s*<\/h2>/i.test(page)
    && /<p\b[^>]*>\s*There are no current vacancies at the moment\.\s*<\/p>/i.test(page)
}

export const hasEmailOnlyCareersSignal = (html) =>
  /href=["']mailto:hr@mcmenon\.com["']/i.test(String(html ?? ''))

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /href=["'][^"']*\/(?:careers|jobs)\/[^"']+["']/i,
  /\bJobPosting\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
]

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const inspected = hasVerifiedEmptyVacanciesSignal(page) ? page
    .replace(/\bCurrent vacancies\b/gi, ' ')
    .replace(/There are no current vacancies at the moment\./gi, ' ')
    .replace(/Don[’']t see a current vacancy that matches your experience\?/gi, ' ') : page
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(inspected))
}

export const createMcMenonEngineeringServicesScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml) || !hasVerifiedCareersLink(homepageHtml)) {
      throw new Error('McMenon Engineering Services Ltd. verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml) || !hasEmailOnlyCareersSignal(careersHtml)) {
      throw new Error('McMenon Engineering Services Ltd. verified first-party careers page no longer matches the known email-only surface')
    }

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('McMenon Engineering Services Ltd. careers page now appears to expose a public jobs surface')
    }

    if (hasVerifiedEmptyVacanciesSignal(careersHtml)) {
      return attachInventoryEvidence([], {
        status: 'verified-empty', surface: CAREERS_URL, firstParty: true, listingComplete: true,
        pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: now(),
        reason: 'official-careers-explicit-no-current-vacancies',
      })
    }
    if (hasCurrentCareersSignal(careersHtml)) {
      throw new Error('McMenon Engineering Services Ltd. current vacancy inventory is unavailable')
    }
    return []
  },
})

export const run = async (options = {}) => createMcMenonEngineeringServicesScraper().run(options)

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
