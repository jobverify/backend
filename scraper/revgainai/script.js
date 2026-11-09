import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'revgainai'
export const COMPANY = 'RevGain AI'
export const HOMEPAGE_URL = 'https://revgain.ai/'
export const SITEMAP_URL = 'https://revgain.ai/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://revgain.ai/careers',
  'https://revgain.ai/careers/',
  'https://revgain.ai/career',
  'https://revgain.ai/career/',
  'https://revgain.ai/jobs',
  'https://revgain.ai/jobs/',
  'https://revgain.ai/join-us',
  'https://revgain.ai/join-us/',
  'https://revgain.ai/openings',
  'https://revgain.ai/openings/',
  'https://revgain.ai/work-with-us',
  'https://revgain.ai/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?revgain\.ai)?\/(?:careers?|jobs?|join-us|openings|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHtml = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

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

export const hasUnexpectedCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*RevGain\s+[—-]\s+AI Revenue Engine\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+RevGain is an AI-powered revenue platform that drives retention and expansion by pairing your team with an augmented workforce of AI agents\./i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/revgain\.ai\/["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']RevGain["']/i.test(page)
    && /"@type"\s*:\s*"Organization"/i.test(page)
    && /"name"\s*:\s*"RevGain"/i.test(page)
    && /"email"\s*:\s*"info@revgain\.ai"/i.test(page)
    && /<div[^>]+id=["']app["'][^>]*><\/div>/i.test(page)
    && normalized.includes('RevGain')
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []

  return matches.some((entry) =>
    /\b(careers?|jobs?|join-us|openings|work-with-us)\b/i.test(
      entry.replace(/^<loc>|<\/loc>$/gi, ''),
    ))
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)
  const raw = normalizeHtml(page?.html)

  return Number(page?.status) === 404
    && (raw === ''
      || (
        raw.includes('<title>page not found | framer</title>')
        && normalized.includes('Page Not Found')
        && normalized.includes('The page you are looking for does not exist or may have been moved.')
        && normalized.includes('Back to Home')
      ))
    && !hasUnexpectedCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createRevgainAiScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('RevGain AI verified official homepage no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(homepage.html)) {
      throw new Error('RevGain AI homepage now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('RevGain AI homepage now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('RevGain AI verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(
          `RevGain AI verified missing first-party careers route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createRevgainAiScraper().run(options)

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
