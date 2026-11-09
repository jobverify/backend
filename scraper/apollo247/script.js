import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.apollo247.com/'
export const ABOUT_URL = 'https://www.apollo247.com/AboutUs'
export const SITEMAP_URL = 'https://www.apollo247.com/static/sitemap'
export const ROBOTS_URL = 'https://www.apollo247.com/robots.txt'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.apollo247.com/Careers',
  'https://www.apollo247.com/Jobs',
  'https://www.apollo247.com/career',
  'https://www.apollo247.com/work-with-us',
  'https://www.apollo247.com/JoinUs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bapply now\b/i,
  /\bjob openings?\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,text/plain',
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
  const text = normalizeWhitespace(page)

  return page.includes('/AboutUs')
    && /apollo 24\|?7/i.test(page)
    && /doctor consultations/i.test(text)
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /about us/i.test(page)
    && /digital healthcare platform/i.test(text)
}

export const hasOfficialSitemapSignal = (xml) => {
  const page = String(xml ?? '')
  const text = normalizeWhitespace(page)

  return (
    page.includes('<loc>https://www.apollo247.com/</loc>')
      && page.includes('<loc>https://www.apollo247.com/AboutUs</loc>')
  ) || (
    /A\s*POLLO\s*24\|7\s*SITE\s*MAP/i.test(text)
      && /About Apollo 247/i.test(text)
      && /About Us/i.test(text)
      && /Static Sitemap/i.test(text)
  )
}

export const hasOfficialRobotsSignal = (txt) =>
  /sitemap:\s*https:\/\/www\.apollo247\.com\/static\/sitemap/i.test(String(txt ?? ''))
  || /User-agent:\s*\*/i.test(String(txt ?? ''))

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const createApollo247Scraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Apollo 24/7 homepage no longer matches the verified official surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (!hasOfficialAboutSignal(about.html)) {
      throw new Error('Apollo 24/7 AboutUs page no longer matches the verified official surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (!hasOfficialSitemapSignal(sitemap.html)) {
      throw new Error('Apollo 24/7 sitemap no longer matches the verified official surface')
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (!hasOfficialRobotsSignal(robots.html)) {
      throw new Error('Apollo 24/7 robots.txt no longer matches the verified official surface')
    }

    for (const url of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const route = await fetchPage(url)

      if (hasPublicJobsSignal(route.html)) {
        throw new Error(`Apollo 24/7 checked route now exposes a public careers surface: ${url}`)
      }

      if (Number(route.status) < 400) {
        throw new Error(`Apollo 24/7 verified no-public route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createApollo247Scraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'apollo247')
  }
}
