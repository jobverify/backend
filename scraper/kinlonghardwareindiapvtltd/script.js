import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kinlonghardwareindiapvtltd'
export const COMPANY = 'KINLONG HARDWARE INDIAPVT. LTD'
export const HOMEPAGE_URL = 'https://en.kinlong.com/'
export const CAREERS_URL = 'https://en.kinlong.com/career.html'
export const CONTACT_URL = 'https://en.kinlong.com/contact.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/[â€˜â€™]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('kinlong')
    && normalized.includes('for better living')
    && normalized.includes('one-stop solution for building material integration')
    && normalized.includes('join kinlong')
    && normalized.includes('contact us')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('join kinlong')
    && normalized.includes('talent philosophy')
    && normalized.includes('retaining, educating, and empowering people')
    && normalized.includes('are you seeking new career opportunities?')
    && normalized.includes('share your aspirations with us via email')
    && normalized.includes('mail@kinlong.com')
}

export const hasIndiaSubsidiarySignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('marketing offices (overseas)')
    && normalized.includes('kinlong hardware (india) private limited')
    && normalized.includes('contact: allenchen@kinlong.com')
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bpositions recruitment\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bbrowse our current openings\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createKinlongHardwareIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('KINLONG verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('KINLONG verified first-party careers page no longer matches the known email-only surface')
    }

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('KINLONG verified zero-job state drifted to a public jobs surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasIndiaSubsidiarySignal(contactHtml)) {
      throw new Error('KINLONG verified India subsidiary contact surface no longer matches the known first-party listing')
    }

    return []
  },
})

export const run = async (options = {}) => createKinlongHardwareIndiaScraper().run(options)

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
