import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mdrift'
export const COMPANY = 'mDrift Technologies'
export const HOMEPAGE_URL = 'https://mdrift.com/'
export const SCRIPT_BUNDLE_URL = 'https://mdrift.com/static/js/mdrift.js'
export const ROBOTS_URL = 'https://mdrift.com/robots.txt'
export const SITEMAP_URL = 'https://mdrift.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://mdrift.com/careers',
  'https://mdrift.com/career',
  'https://mdrift.com/jobs',
  'https://mdrift.com/join-us',
  'https://mdrift.com/current-openings',
  'https://mdrift.com/openings',
  'https://mdrift.com/work-with-us',
]
export const VERIFIED_MISSING_ROUTE_URLS = [
  ROBOTS_URL,
  SITEMAP_URL,
  ...NO_PUBLIC_CAREERS_ROUTE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_PATH_PATTERN =
  /(?:^|\/)(careers?|jobs?|job|openings?|vacancies?|join-us|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bwe are hiring\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitee/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const BUNDLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bapply now\b/i,
  /\/careers?(?:\/|['"`])/i,
  /\/jobs?(?:\/|['"`])/i,
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

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'mdrift.com' || hostname.endsWith('.mdrift.com')
}

const getNormalizedPathname = (value) => {
  try {
    const pathname = new URL(value, HOMEPAGE_URL).pathname
    return pathname !== '/' ? pathname.replace(/\/$/, '') : pathname
  } catch {
    return null
  }
}

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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Partner for Innovation')
    && normalized.includes('Our Services')
    && normalized.includes('Product and Platform Engineering')
    && normalized.includes('IP Development and Research')
    && normalized.includes('Artificial Intelligence')
    && normalized.includes('Our Tech Stack for your Projects')
    && normalized.includes('About Us')
    && normalized.includes('Contact Us')
    && normalized.includes('contact@mdrift.com')
    && normalized.includes('founded in May of 2013')
}

export const hasHomepageBundleReference = (html) =>
  /<script[^>]+src=["']\/static\/js\/mdrift\.js["']/i.test(String(html ?? ''))

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (FIRST_PARTY_CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  hasFirstPartyCareerLikeLink(html)
  || PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBundleSignal = (bundleText) => String(bundleText ?? '').trim() === ''

export const hasBundlePublicJobsSignal = (bundleText) =>
  BUNDLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedMissingRoute = (page = {}, expectedUrl = '') => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)
  const pagePath = getNormalizedPathname(page?.url || expectedUrl)
  const expectedPath = getNormalizedPathname(expectedUrl)

  return Number(page?.status) === 404
    && Boolean(pagePath)
    && pagePath === expectedPath
    && /<title>\s*Page not found at\s+[^<]+\s*<\/title>/i.test(html)
    && normalized.includes('Page not found (404)')
    && normalized.includes(`Request URL: https://mdrift.com${pagePath === '/' ? '' : pagePath}`)
}

export const createMdriftScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchText = defaultFetchText } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('mDrift verified official homepage no longer matches the known first-party surface')
    }
    if (!hasHomepageBundleReference(homepage.html)) {
      throw new Error('mDrift verified official homepage no longer matches the known first-party surface')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('mDrift homepage now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('mDrift homepage now appears to expose public jobs')
    }

    const bundleText = await fetchText(SCRIPT_BUNDLE_URL)
    if (!hasVerifiedBundleSignal(bundleText) || hasBundlePublicJobsSignal(bundleText)) {
      throw new Error('mDrift first-party script changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of VERIFIED_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage, routeUrl)) {
        if (routeUrl === ROBOTS_URL || routeUrl === SITEMAP_URL) {
          throw new Error('mDrift robots.txt or sitemap surface changed or now exposes public jobs')
        }

        throw new Error(
          `mDrift no-public-careers route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMdriftScraper().run(options)

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
