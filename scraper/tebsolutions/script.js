import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

export const SOURCE = 'tebsolutions'
export const COMPANY = 'TEB Solutions'
export const HOMEPAGE_URL = 'https://tebsolutions.in/'
export const PAGE_SITEMAP_URL = 'https://tebsolutions.in/page-sitemap.xml'
export const CAREERS_ROUTE_URLS = [
  'https://tebsolutions.in/careers',
  'https://tebsolutions.in/careers/',
  'https://tebsolutions.in/career',
  'https://tebsolutions.in/career/',
  'https://tebsolutions.in/jobs',
  'https://tebsolutions.in/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bjob opportunities\b/i,
  /\bcareer opportunities\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /\bvacan(?:cy|cies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /recruitcrm/i,
  /bamboohr/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const isSameOfficialDomain = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'tebsolutions.in' || hostname === 'www.tebsolutions.in'
  } catch {
    return false
  }
}

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*(?:TEBSolutions-\s*Your Path to Digital Excellence|HomePage - TEB Solutions)\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']TEB Solutions["']/i.test(page)
    && /"@type":"Organization"[^]*?"name":"TEB Solutions"/i.test(page)
    && normalized.includes('Your Path to Digital Excellence')
    && normalized.includes('We build high-converting websites and drive traffic through powerful digital marketing.')
    && normalized.includes('Grow online with targeted strategies built for performance and lasting impact.')
    && (
      /mailto:info@tebsolutions\.in/i.test(page)
      || (page.includes('/wp-content/uploads/2025/07/Tattavit-Blue-PNG.png')
        && normalized.includes('Seamless Communication, Global Impact.')
        && normalized.includes('Transforming Ideas into Digital Excellence.')
        && normalized.includes('Send us a message'))
    )
    && /href=["'](?:https:\/\/tebsolutions\.in)?\/marketing\/["']/i.test(page)
    && /href=["'](?:https:\/\/tebsolutions\.in)?\/web-design\/["']/i.test(page)
    && /href=["'](?:https:\/\/tebsolutions\.in)?\/blog\/["']/i.test(page)
}

export const hasOfficialPageSitemapSignal = (xml) => {
  const page = String(xml ?? '')
  if (!/<urlset\b/i.test(page)) return false
  const urls = [...page.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => {
    try { return new URL(match[1].trim(), HOMEPAGE_URL) } catch { return null }
  })
  return urls.length > 0
    && urls.every(url => url && isSameOfficialDomain(url.href) && !/\/(?:career|careers|jobs)\/?$/i.test(url.pathname))
    && ['/web-design/', '/marketing/', '/blog/'].every(path => urls.some(url => url.pathname === path))
}

const hasBrandedSoft404Signal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  const knownMissingPageCopy = (
    normalized.includes('404 Page not found')
      && normalized.includes('The page you are looking for no longer exists.')
      && normalized.includes('Back Home')
  ) || (
    normalized.includes('Article & News Category:')
      && normalized.includes("It seems we can't find what you're looking for.")
  )

  return /<title>\s*Page Not Found - TEB Solutions\s*<\/title>/i.test(page)
    && knownMissingPageCopy
    && normalized.includes('Seamless Communication, Global Impact.')
    && normalized.includes('Transforming Ideas into Digital Excellence.')
    && normalized.includes('Send us a message')
}

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  return hasBrandedSoft404Signal(page.html)
    || (Number(page.status) === 200 && hasOfficialHomepageSignal(page.html))
}

export const createTebSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('TEB Solutions homepage no longer matches the verified official surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('TEB Solutions homepage now appears to expose public jobs')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasOfficialPageSitemapSignal(pageSitemap.html)) {
      throw new Error('TEB Solutions page sitemap no longer matches the verified official surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('TEB Solutions careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTebSolutionsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`TEB Solutions jobs scraped: ${jobs.length}`)
}
