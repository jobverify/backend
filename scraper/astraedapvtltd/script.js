import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'astraedapvtltd'
export const COMPANY = 'AstraEDA Pvt Ltd'
export const HOMEPAGE_URL = 'https://astraeda.com/'
export const CHECKED_ROUTE_URLS = [
  'https://astraeda.com/careers',
  'https://astraeda.com/careers/',
  'https://astraeda.com/career',
  'https://astraeda.com/career/',
  'https://astraeda.com/jobs',
  'https://astraeda.com/jobs/',
  'https://astraeda.com/join-us',
  'https://astraeda.com/join-us/',
  'https://astraeda.com/openings',
  'https://astraeda.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bview jobs?\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const extractVisibleText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' '),
)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = extractVisibleText(page)

  return /<title>\s*AstraEDA\s*<\/title>/i.test(page)
    && page.includes('https://i.ibb.co/pvCZmqqH/astra-logo.png')
    && page.includes('fonts.googleapis.com/css2?family=Inter')
    && page.includes('family=Space+Grotesk')
    && visibleText.includes('AstraEDA')
    && visibleText.includes('AI-Powered Optimization for Superior Low-Power PPA')
    && visibleText.includes('Supercharge your low-power design')
    && visibleText.includes('custom recipe.')
    && visibleText.includes('Coming soon ...')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedRouteFallbackShell = (pageHtml, homepageHtml) =>
  hasOfficialHomepageSignal(pageHtml)
  && !hasPublicJobsSignal(pageHtml)
  && normalizeWhitespace(pageHtml) === normalizeWhitespace(homepageHtml)

export const createAstraEdaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('AstraEDA verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('AstraEDA homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !isVerifiedRouteFallbackShell(routePage.html, homepage.html)) {
        throw new Error(
          `AstraEDA checked first-party route changed materially or now exposes public jobs: ${routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAstraEdaScraper().run(options)

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
