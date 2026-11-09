import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'flintlab'
export const COMPANY = 'FlintLab'
export const HOMEPAGE_URL = 'https://flintlab.io/'
export const SITEMAP_URL = 'https://flintlab.io/sitemap.xml'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that https://flintlab.io/ was FlintLab\'s live first-party Next.js homepage, that it now led with the "Ship Mobile & Web Apps" and "With Real Confidence, At Scale" hero copy plus an "Ask FlintBot" control, and that its metadata and schema still identified FlintLab Sirius, AI NEXUS FLINT LAB INDIA PRIVATE LIMITED., engage@flintlab.io, and https://www.linkedin.com/company/flintlab-inc as the trusted public brand surface. Also verified on Friday, August 7, 2026 that https://flintlab.io/sitemap.xml exposed only product, docs, blog, and informational routes, while the first-party /careers, /career, and /jobs routes still resolved to branded missing-page responses rather than a public openings board. This provider remains fail-closed and returns an honest empty result until FlintLab publishes a trustworthy public careers surface.'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://flintlab.io/careers',
  'https://flintlab.io/careers/',
  'https://flintlab.io/career',
  'https://flintlab.io/career/',
  'https://flintlab.io/jobs',
  'https://flintlab.io/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job|jobs|opening|openings|vacancy|vacancies|join us|work with us)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return normalized.includes('flintlab sirius')
    && normalized.includes('device infrastructure paas')
    && normalized.includes('ship mobile & web apps')
    && normalized.includes('with real confidence, at scale')
    && normalized.includes('flintlab unifies real devices, emulators, and cloud-native execution in one platform')
    && normalized.includes('developer advocacy team that stress-tests your releases before your users do')
    && normalized.includes('platform, people, and compliance: all covered')
    && normalized.includes('ai nexus flint lab india private limited.')
    && normalized.includes('engage@flintlab.io')
    && normalized.includes('ask flintbot')
    && /linkedin\.com\/company\/flintlab-inc/i.test(rawHtml)
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => CAREERS_SIGNAL_PATTERN.test(entry))
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createFlintLabScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('FlintLab verified official homepage no longer matches the known public surface')
    }

    if (CAREERS_SIGNAL_PATTERN.test(homepage.html)) {
      throw new Error('FlintLab homepage now appears to expose a public careers signal')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('FlintLab verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`FlintLab verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFlintLabScraper().run(options)

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
