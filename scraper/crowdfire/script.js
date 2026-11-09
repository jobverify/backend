import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'crowdfire'
export const COMPANY = 'Crowdfire'
export const HOMEPAGE_URL = 'https://www.crowdfireapp.com/'
export const CHECKED_ROUTE_URLS = [
  'https://www.crowdfireapp.com/careers',
  'https://www.crowdfireapp.com/careers/',
  'https://www.crowdfireapp.com/jobs',
  'https://www.crowdfireapp.com/jobs/',
  'https://www.crowdfireapp.com/join-us',
  'https://www.crowdfireapp.com/join-us/',
  'https://www.crowdfireapp.com/career',
  'https://www.crowdfireapp.com/career/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_TEXT_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
]

const PUBLIC_JOBS_HTML_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
  /workable\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractVisibleText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
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
  const text = extractVisibleText(page)

  return /<title[^>]*>\s*Crowdfire is evolving\s*<\/title>/i.test(page)
    && text.includes("After 15 years helping creators manage social media, we're becoming something new")
    && text.includes('a media platform dedicated to covering the intersection of social media, Web3, and AI.')
    && text.includes("So we're doubling down on our mission: helping creators like you build, monetize, and own your digital future.")
    && text.includes('No BS approach')
    && text.includes('The next chapter starts now. Are you in?')
}

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const text = extractVisibleText(page)

  return PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(text))
    || PUBLIC_JOBS_HTML_PATTERNS.some((pattern) => pattern.test(page))
}

export const isVerifiedRouteFallbackShell = (pageHtml, homepageHtml) =>
  hasOfficialHomepageSignal(pageHtml)
  && !hasPublicJobsSignal(pageHtml)
  && normalizeWhitespace(pageHtml) === normalizeWhitespace(homepageHtml)

export const createCrowdfireScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Crowdfire verified official homepage no longer matches the known first-party shell')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Crowdfire homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !isVerifiedRouteFallbackShell(routePage.html, homepage.html)) {
        throw new Error(
          `Crowdfire checked first-party route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCrowdfireScraper().run(options)

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
