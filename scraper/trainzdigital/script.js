import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'trainzdigital'
export const COMPANY = 'Trainz Digital'
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
export const ROBOTS_URL = 'https://www.intrainz.com/robots.txt'
export const SITEMAP_URL = 'https://www.intrainz.com/sitemap.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_SHELL_SIGNALS = [
  'place mantra',
  'level up your skills for any industry.',
  "at place mantra, we believe you don't need to master the entire syllabus to land your dream job.",
  'domains categories',
  'popular courses',
  'we boost your learning potential',
  'place mantra private limited',
  'subscribe to our newsletter',
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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/[’‘]/g, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

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
    && /linkedin\.com\/company\/hexabells/i.test(rawHtml)
}

export const hasPublicJobSignal = (html) =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createTrainzDigitalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const urlsToVerify = [
      HOMEPAGE_URL,
      ...CHECKED_ROUTE_URLS,
      ROBOTS_URL,
      SITEMAP_URL,
    ]

    for (const url of urlsToVerify) {
      const page = await fetchPage(url)

      if (page.status !== 200 || !hasVerifiedShellSignal(page.html)) {
        throw new Error(`Trainz Digital verified first-party shell changed materially: ${page.url || url}`)
      }

      if (hasPublicJobSignal(page.html)) {
        throw new Error(`Trainz Digital route now exposes public job signals: ${page.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTrainzDigitalScraper().run(options)

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
