import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ipopiads'
export const COMPANY = 'Ipopi Ads'
export const LEGACY_COMPANY_URL = 'https://ipopiads.com'
export const HOMEPAGE_URL = 'https://www.ipopi.in/'
export const PRIVACY_URL = 'https://www.ipopi.in/privacy-policy.php'
export const TERMS_URL = 'https://www.ipopi.in/terms-and-conditions.php'
export const BLOG_URL = 'https://www.ipopi.in/blog/'
export const ROBOTS_URL = 'https://www.ipopi.in/robots.txt'
export const SITEMAP_URL = 'https://www.ipopi.in/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.ipopi.in/careers',
  'https://www.ipopi.in/career',
  'https://www.ipopi.in/jobs',
  'https://www.ipopi.in/job',
  'https://www.ipopi.in/work-with-us',
  'https://www.ipopi.in/join-us',
]
export const VERIFIED_ON = '2026-08-07'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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

const CAREER_LIKE_LINK_PATTERN =
  /<a\b[^>]*(href=["'][^"']*\b(careers?|jobs?|join-us|work-with-us)\b[^"']*["']|>\s*(careers?|jobs?|join us|work with us)\s*<\/a>)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
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
  return normalized === HOMEPAGE_URL.toLowerCase() || normalized === 'https://ipopi.in/'
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Leading Digital Marketing Agency in Mysore & Bangalore \| Expert SEO & Social Media Marketing\s*<\/title>/i.test(page)
    && normalized.includes('#1 digital marketing company')
    && (
      normalized.includes('sales@ipopi.in')
      || normalized.includes('sales@ipop.in')
    )
    && normalized.includes('padmanabhanagar, bangalore, karnataka 560070')
    && /ipopi\s+ads\.\s+all rights reserved\./i.test(page)
}

export const hasOfficialPrivacySignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return /\bPrivacy Policy\b/i.test(normalized)
    && /refers to Ipopi Ads/i.test(normalized)
    && /accessible from https:\/\/www\.ipopi\.in\//i.test(normalized)
    && /India/i.test(normalized)
}

export const hasOfficialTermsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Terms and Conditions\s*-\s*Ipopi Ads\s*<\/title>/i.test(page)
    && /\bTerms and Conditions\b/i.test(normalized)
    && /Last updated:\s*June 13,\s*2024/i.test(normalized)
    && /Company .* refers to Ipopi Ads/i.test(normalized)
    && /Country refers to:\s*Kerala,\s*India/i.test(normalized)
    && /Mysuru,\s*Karnataka\s*570017/i.test(normalized)
}

export const hasOfficialBlogSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Ipopi Ads Blog(?:\s*-\s*)?\s*<\/title>/i.test(page)
    && normalized.includes('ipopi ads blog')
    && normalized.includes('latest posts')
    && normalized.includes('digital marketing')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const homepageHasCareerLikeLink = (html) => CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const robotsHasExpectedSitemapSignal = (txt) =>
  /(?:^|\n)\s*Sitemap:\s*https?:\/\/(?:www\.)?ipopi\.in\/sitemap\.xml\s*(?:\n|$)/i.test(String(txt ?? ''))

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => /\b(careers?|jobs?|join-us|work-with-us)\b/i.test(entry))
}

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && /\b404 Not Found\b/i.test(String(page?.html ?? ''))
  && !hasPublicJobsSignal(page?.html)

const hasVerifiedLegacyDomainBridge = (page = {}) =>
  [301, 302, 307, 308].includes(Number(page?.status))
  && isExpectedHomepageUrl(page?.location)

export const createIpopiAdsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const legacyPage = await fetchPage(LEGACY_COMPANY_URL, { redirect: 'manual' })
    if (!hasVerifiedLegacyDomainBridge(legacyPage)) {
      throw new Error('Ipopi Ads verified legacy domain bridge no longer matches the known first-party surface')
    }

    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Ipopi Ads verified homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html) || homepageHasCareerLikeLink(homepage.html)) {
      throw new Error('Ipopi Ads homepage now appears to expose a public jobs surface')
    }

    const privacy = await fetchPage(PRIVACY_URL)
    if (privacy.status !== 200 || !hasOfficialPrivacySignal(privacy.html)) {
      throw new Error('Ipopi Ads verified privacy page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(privacy.html)) {
      throw new Error('Ipopi Ads privacy page now appears to expose a public jobs surface')
    }

    const terms = await fetchPage(TERMS_URL)
    if (terms.status !== 200 || !hasOfficialTermsSignal(terms.html)) {
      throw new Error('Ipopi Ads verified terms page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(terms.html)) {
      throw new Error('Ipopi Ads terms page now appears to expose a public jobs surface')
    }

    const blog = await fetchPage(BLOG_URL)
    if (blog.status !== 200 || !hasOfficialBlogSignal(blog.html)) {
      throw new Error('Ipopi Ads verified blog no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(blog.html)) {
      throw new Error('Ipopi Ads blog now appears to expose a public jobs surface')
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (robots.status !== 200 || !robotsHasExpectedSitemapSignal(robots.html)) {
      throw new Error('Ipopi Ads verified robots surface no longer exposes the expected sitemap')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('Ipopi Ads verified sitemap no longer matches the known careers-free surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Ipopi Ads verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createIpopiAdsScraper().run(options)

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
