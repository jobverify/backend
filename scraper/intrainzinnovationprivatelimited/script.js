import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intrainzinnovationprivatelimited'
export const COMPANY = 'INTRAINZ INNOVATION PRIVATE LIMITED'
export const HOMEPAGE_URL = 'https://www.intrainz.com/'
export const CHECKED_ROUTE_URLS = [
  'https://www.intrainz.com/careers',
  'https://www.intrainz.com/careers/',
  'https://www.intrainz.com/career',
  'https://www.intrainz.com/jobs',
  'https://www.intrainz.com/jobs/',
  'https://www.intrainz.com/join-us',
  'https://www.intrainz.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const VERIFIED_SHELL_SIGNALS = [
  'place mantra',
  'level up your skills for any industry.',
  'at place mantra, we believe you don’t need to master the entire syllabus to land your dream job.',
  'popular courses',
  'we boost your learning potential',
  'subscribe to our newsletter',
  'place mantra private limited',
]

const PUBLIC_JOB_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\/jobs?\/[a-z0-9-]{3,}/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasVerifiedShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return VERIFIED_SHELL_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title>\s*PLACE MANTRA\s*<\/title>/i.test(rawHtml)
    && /<meta\s+name="robots"\s+content="noindex,\s*nofollow">/i.test(rawHtml)
    && /assets\/img\/logo\.svg/i.test(rawHtml)
  }

export const hasPublicJobSignal = (html) =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createIntrainzInnovationPrivateLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasVerifiedShellSignal(homepage.html)) {
      throw new Error('INTRAINZ INNOVATION PRIVATE LIMITED verified first-party shell no longer matches the known public surface')
    }

    if (hasPublicJobSignal(homepage.html)) {
      throw new Error('INTRAINZ INNOVATION PRIVATE LIMITED homepage now exposes public job signals')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !hasVerifiedShellSignal(routePage.html)) {
        throw new Error(`INTRAINZ INNOVATION PRIVATE LIMITED verified first-party shell changed: ${routePage.url || routeUrl}`)
      }

      if (hasPublicJobSignal(routePage.html)) {
        throw new Error(`INTRAINZ INNOVATION PRIVATE LIMITED route now exposes public job signals: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createIntrainzInnovationPrivateLimitedScraper().run(options)

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
