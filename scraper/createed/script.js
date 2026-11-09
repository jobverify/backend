import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'createed'
export const COMPANY = 'CreatED'
export const HOMEPAGE_URL = 'https://www.create-ed.in/'
export const ABOUT_URL = 'https://www.create-ed.in/about'
export const SITEMAP_URL = 'https://www.create-ed.in/pages-sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.create-ed.in/careers',
  'https://www.create-ed.in/career',
  'https://www.create-ed.in/jobs',
  'https://www.create-ed.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const createFetchTimeoutSignal = (timeoutMs = FETCH_TIMEOUT_MS) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bvacanc(?:y|ies)\b/i,
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
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '') || '/'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createFetchTimeoutSignal(),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*CreatED \| Inspiring the Innovators of Tomorrow\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.create-ed\.in"\/?>/i.test(page)
    && normalized.includes('INSPIRING THE INNOVATORS OF TOMORROW')
    && /CreatED is an innovation hub empowering high school students to ideate, create, and build groundbreaking projects/i.test(page)
    && (
      normalized.includes('Schedule A Consultation')
      || normalized.includes('Reach Out')
    )
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*About \| CreatED\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.create-ed\.in\/about"\/?>/i.test(page)
    && /Aashna Saraf/i.test(page)
    && /Harvard University/i.test(page)
    && /Aashna founded CreatEd with the vision of turning curiosity into creation/i.test(page)
    && /Founder\s*&(?:amp;)?\s*CEO/i.test(page)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const extractSitemapLocations = (xml) =>
  (String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || [])
    .map((entry) => entry.replace(/^<loc>|<\/loc>$/gi, ''))
    .map((entry) => normalizeUrl(entry))

export const sitemapHasExpectedCorePages = (xml) => {
  const locations = new Set(extractSitemapLocations(xml))
  return locations.has('https://www.create-ed.in')
    && locations.has('https://www.create-ed.in/about')
    && locations.has('https://www.create-ed.in/schedule-a-consultation')
}

export const sitemapHasCareerLikeUrl = (xml) =>
  extractSitemapLocations(xml).some((location) => /\b(careers?|jobs?|join-us|work-with-us|openings?)\b/i.test(location))

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && !hasPublicJobsSignal(page?.html)

export const createCreatEDScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('CreatED verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('CreatED homepage now appears to expose a public jobs surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('CreatED verified about page no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('CreatED about page now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !sitemapHasExpectedCorePages(sitemap.html) || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('CreatED verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`CreatED verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCreatEDScraper().run(options)

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
