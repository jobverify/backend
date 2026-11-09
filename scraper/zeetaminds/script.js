import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zeetaminds'
export const COMPANY = 'Zeetaminds'
export const HOMEPAGE_URL = 'https://zeetaminds.com/'
export const EXPLORE_URL = 'https://zeetaminds.com/explore/'
export const ROBOTS_URL = 'https://zeetaminds.com/robots.txt'
export const SITEMAP_URL = 'https://zeetaminds.com/sitemap.xml'
export const CAREERS_URL = 'https://zeetaminds.com/careers/'
export const JOBS_URL = 'https://zeetaminds.com/jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUIRED_SITEMAP_URLS = [
  'https://zeetaminds.com/explore',
  'https://zeetaminds.com/explore/features',
  'https://zeetaminds.com/explore/pricing',
  'https://zeetaminds.com/explore/videos',
  'https://zeetaminds.com/explore/getting-started',
  'https://zeetaminds.com/explore/faq',
  'https://zeetaminds.com/explore/privacy',
  'https://zeetaminds.com/explore/terms',
  'https://zeetaminds.com/explore/refund',
  'https://zeetaminds.com/explore/blog',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bjoin our team\b/i,
  /\bcurrent openings\b/i,
  /\bopen roles?\b/i,
  /\bapply now\b/i,
  /\bview openings\b/i,
  /linkedin\.com\/jobs/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /wellfound\.com/i,
  /\/apply\b/i,
  /\/job\/[a-z0-9-]+/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return page.includes('https://static.zeetaminds.com/explore/icons/zeetaminds.png')
    && page.includes('https://static.zeetaminds.com/explore/icons/zeetaminds-touch-icon.png')
    && /https:\/\/static\.zeetaminds\.com\/explore\/_app\/immutable\/entry\/start\.[^"']+\.js/.test(page)
    && /https:\/\/static\.zeetaminds\.com\/explore\/_app\/immutable\/entry\/app\.[^"']+\.js/.test(page)
    && page.includes('data-sveltekit-preload-data="hover"')
}

export const hasOfficialRobotsSignal = (text) => {
  const normalized = normalizeWhitespace(text)

  return normalized.includes('User-agent: *')
    && normalized.includes('Allow: /explore/')
    && normalized.includes('Sitemap: https://zeetaminds.com/sitemap.xml')
}

export const hasOfficialSitemapSignal = (xml) => {
  const page = String(xml ?? '')
  const urls = extractSitemapUrls(page)
  const urlSet = new Set(urls)

  return page.includes('<?xml-stylesheet type="text/xsl" href="/explore/sitemap.xsl"?>')
    && REQUIRED_SITEMAP_URLS.every((url) => urlSet.has(url))
    && urls.some((url) => url.startsWith('https://zeetaminds.com/explore/blog/'))
    && !urls.some((url) => /\/careers?\/?$/i.test(url))
    && !urls.some((url) => /\/jobs?\/?$/i.test(url))
}

export const hasOfficialNotFoundSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Not Found')
    && normalized.includes("For request 'GET /")
    && normalized.includes("Monaco, 'Lucida Console', monospace")
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createZeetamindsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeUrl(homepage.url) !== normalizeUrl(EXPLORE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Zeetaminds verified official homepage no longer matches the trusted first-party shell')
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (robots.status !== 200 || !hasOfficialRobotsSignal(robots.html)) {
      throw new Error('Zeetaminds verified robots.txt no longer matches the trusted first-party contract')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html) || hasPublicJobsSignal(sitemap.html)) {
      throw new Error('Zeetaminds verified sitemap no longer matches the trusted first-party marketing surface')
    }

    for (const url of [CAREERS_URL, JOBS_URL]) {
      const route = await fetchPage(url)
      const routeLooksLikeJobsSurface = hasPublicJobsSignal(route.html) && !hasOfficialNotFoundSignal(route.html)
      if (route.status !== 404 || !hasOfficialNotFoundSignal(route.html) || routeLooksLikeJobsSurface) {
        throw new Error('Zeetaminds verified first-party empty careers routes no longer match the trusted non-listing surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createZeetamindsScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
