import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cyres'
export const COMPANY = 'CYRES'
export const ROOT_URL = 'https://cyres.com/'
export const HOMEPAGE_URL = 'https://www.cyres.com/'
export const CONNECT_URL = 'https://www.cyres.com/connect/'
export const PRIVACY_URL = 'https://www.cyres.com/privacy-policy/'
export const SITEMAP_INDEX_URL = 'https://www.cyres.com/sitemap.xml'
export const PAGE_SITEMAP_URL = 'https://www.cyres.com/wp-sitemap-posts-page-1.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.cyres.com/careers',
  'https://www.cyres.com/career',
  'https://www.cyres.com/jobs',
  'https://www.cyres.com/job',
  'https://www.cyres.com/join-us',
  'https://www.cyres.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bopen roles?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bapply for (?:this|the) (?:role|position)\b/i,
  /\bjob description\b/i,
  /\bposition summary\b/i,
  /\bjoin our team\b/i,
  /\bsubmit your application\b/i,
  /mailto:[^"' >]*(careers?|jobs?|recruit|recruiting|talent|hr)[^"' >]*/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const CAREER_LIKE_LINK_PATTERN = /href=["'][^"']*\b(careers?|jobs?|join-us|work-with-us)\b[^"']*["']/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&#x2013;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    redirect: options.redirect || 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    html: await response.text(),
  }
}

const isExpectedHomepageUrl = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === HOMEPAGE_URL.toLowerCase() || normalized === 'https://www.cyres.com'
}

export const hasVerifiedRootRedirect = (page = {}) =>
  [301, 302, 307, 308].includes(Number(page?.status))
  && isExpectedHomepageUrl(page?.location)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Cyres\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Building Strong Leaders is Our Passion\s*<\/title>/i.test(page)
    && normalized.includes('building strong leaders is our passion')
    && normalized.includes('info@cyres.com')
    && normalized.includes('belgium')
    && normalized.includes('dubai, uae')
}

export const hasOfficialConnectSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Connect\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Cyres\s*<\/title>/i.test(page)
    && normalized.includes('durmen 80')
    && normalized.includes('belgium')
    && normalized.includes('blue technologies office')
    && normalized.includes('dubai, uae')
    && normalized.includes('info@cyres.com')
}

export const hasOfficialPrivacySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Privacy Policy\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Cyres\s*<\/title>/i.test(page)
    && /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.cyres\.com\/privacy-policy\/["']/i.test(page)
    && normalized.includes('privacy policy')
    && normalized.includes('cyres')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const pageHasCareerLikeLink = (html) => CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const sitemapIndexHasExpectedPageSitemap = (xml) =>
  /<loc>https:\/\/www\.cyres\.com\/wp-sitemap-posts-page-1\.xml<\/loc>/i.test(String(xml ?? ''))

export const sitemapHasUnexpectedCareerLikeUrl = (xml) => {
  const matches = Array.from(
    String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi),
    (match) => match[1],
  )

  return matches.some((entry) => /\/(?:careers?|jobs?|join-us|work-with-us)(?:\/|$|[?#])/i.test(entry))
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(page?.status) === 404
    && /<title>\s*Page not found\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Cyres\s*<\/title>/i.test(html)
    && normalized.includes('page not found')
    && normalized.includes('cyres')
    && !hasPublicJobsSignal(html)
}

export const createCyresScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const root = await fetchPage(ROOT_URL, { redirect: 'manual' })
    if (!hasVerifiedRootRedirect(root)) {
      throw new Error('CYRES verified root redirect no longer matches the known first-party surface')
    }

    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('CYRES verified homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html) || pageHasCareerLikeLink(homepage.html)) {
      throw new Error('CYRES homepage now appears to expose a public jobs surface')
    }

    const connect = await fetchPage(CONNECT_URL)
    if (connect.status !== 200 || !hasOfficialConnectSignal(connect.html)) {
      throw new Error('CYRES verified connect page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(connect.html) || pageHasCareerLikeLink(connect.html)) {
      throw new Error('CYRES connect page now appears to expose a public jobs surface')
    }

    const privacy = await fetchPage(PRIVACY_URL)
    if (privacy.status !== 200 || !hasOfficialPrivacySignal(privacy.html)) {
      throw new Error('CYRES verified privacy page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(privacy.html) || pageHasCareerLikeLink(privacy.html)) {
      throw new Error('CYRES privacy page now appears to expose a public jobs surface')
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
    if (
      sitemapIndex.status !== 200
      || !sitemapIndexHasExpectedPageSitemap(sitemapIndex.html)
      || sitemapHasUnexpectedCareerLikeUrl(sitemapIndex.html)
    ) {
      throw new Error('CYRES verified sitemap index no longer matches the known careers-free surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || sitemapHasUnexpectedCareerLikeUrl(pageSitemap.html)) {
      throw new Error('CYRES verified page sitemap no longer matches the known careers-free surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`CYRES verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCyresScraper().run(options)

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
