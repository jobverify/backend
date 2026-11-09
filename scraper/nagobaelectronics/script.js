import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nagobaelectronics'
export const COMPANY = 'Nagoba Electronics'
export const HOMEPAGE_URL = 'https://nagoba.com/'
export const PAGE_SITEMAP_URL = 'https://nagoba.com/page-sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://nagoba.com/careers',
  'https://nagoba.com/careers/',
  'https://nagoba.com/career',
  'https://nagoba.com/career/',
  'https://nagoba.com/jobs',
  'https://nagoba.com/jobs/',
  'https://nagoba.com/job',
  'https://nagoba.com/job/',
  'https://nagoba.com/work-with-us',
  'https://nagoba.com/work-with-us/',
  'https://nagoba.com/join-us',
  'https://nagoba.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
  /\bapply now\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /\bupload your resume\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
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
  return hostname === 'nagoba.com' || hostname === 'www.nagoba.com' || hostname.endsWith('.nagoba.com')
}

const extractLocUrls = (xml) =>
  Array.from(String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => match[1].trim())

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Nagoba Electronics \| ACCL, Earth Leakage Relay , Earth Fault Relay &amp; more\.\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+Leading manufacturer of ACCL &amp; Relays in India/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/nagoba\.com\/["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Nagoba Electronics["']/i.test(rawHtml)
    && rawHtml.includes('"name":"Nagoba Electronics"')
    && normalized.includes('Installed Products')
    && normalized.includes('Builders')
    && normalized.includes('Cities')
    && normalized.includes('Customers')
    && normalized.includes('contact@nagoba.com')
    && normalized.includes('sales@nagoba.com')
    && normalized.includes('11/32, Byraveshwara Industrial Estate, Near Peenya 2nd Stage, Bengaluru 560091')
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedPageSitemap = (xml) => {
  const normalized = normalizeWhitespace(xml)
  const urls = extractLocUrls(xml)

  return normalized.includes('https://nagoba.com/')
    && urls.length === 1
    && urls[0] === HOMEPAGE_URL
    && !urls.some((url) => CAREER_PATH_PATTERN.test(new URL(url).pathname))
}

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 404
    && /<title>\s*Page not found \| Nagoba Electronics\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Page could not be found')
    && normalized.includes('Oops, This Page Could Not Be Found!')
    && normalized.includes('The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.')
    && normalized.includes('Error 404')
    && !hasFirstPartyCareerLikeLink(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const createNagobaElectronicsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Nagoba Electronics verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Nagoba Electronics homepage now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Nagoba Electronics homepage now exposes a first-party careers path')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !isVerifiedPageSitemap(pageSitemap.html)) {
      throw new Error('Nagoba Electronics verified page sitemap no longer matches the known public surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error(
          'Nagoba Electronics careers routes changed materially or now expose a public careers surface',
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNagobaElectronicsScraper().run(options)

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
