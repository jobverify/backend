import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'simhatel'
export const COMPANY = 'Simhatel Technology Private Limited'
export const HOMEPAGE_URL = 'https://www.simhatel.com/'
export const ABOUT_URL = 'https://www.simhatel.com/about'
export const CONTACT_URL = 'https://www.simhatel.com/contact'
export const SITEMAP_URL = 'https://www.simhatel.com/sitemap.xml'
export const ROBOTS_URL = 'https://www.simhatel.com/robots.txt'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.simhatel.com/careers',
  'https://www.simhatel.com/career',
  'https://www.simhatel.com/jobs',
  'https://www.simhatel.com/join-us',
  'https://www.simhatel.com/hiring',
  'https://www.simhatel.com/openings',
]
export const NO_PUBLIC_CAREERS_ALIAS_URLS = [
  'https://www.simhatel.com/careers/',
  'https://www.simhatel.com/career/',
  'https://www.simhatel.com/jobs/',
  'https://www.simhatel.com/join-us/',
]
export const OFFICIAL_SURFACE_URLS = [
  HOMEPAGE_URL,
  ABOUT_URL,
  CONTACT_URL,
  SITEMAP_URL,
  ROBOTS_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_TEXT_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bopen roles?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bsubmit your application\b/i,
  /\bjoin our team\b/i,
  /\bjob description\b/i,
]

const PUBLIC_JOBS_RAW_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /linkedin\.com\/jobs/i,
]

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/www\.simhatel\.com)?\/(?:careers?|jobs?|join-us|hiring|openings)(?:\/|["'#?])/i

const CAREER_LIKE_URL_PATTERN = /\/(?:careers?|jobs?|join-us|hiring|openings)(?:\/|$|[?#])/i

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? '')
}

const getHeader = (headers, name) => {
  if (!headers) return null

  if (typeof headers.get === 'function') {
    return headers.get(name)
  }

  const target = String(name).toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return value
    }
  }

  return null
}

const normalizeAbsoluteUrl = (value, base = HOMEPAGE_URL) => {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const extractRefreshUrl = (headers, pageUrl) => {
  const refresh = getHeader(headers, 'refresh')
  const url = String(refresh ?? '').match(/url=(.+)$/i)?.[1]
  return normalizeAbsoluteUrl(url, pageUrl || HOMEPAGE_URL)
}

const describePage = (page = {}) => {
  const location = normalizeAbsoluteUrl(getHeader(page.headers, 'location'), page.url || HOMEPAGE_URL)
  const refreshUrl = extractRefreshUrl(page.headers, page.url || HOMEPAGE_URL)

  return `status=${page.status ?? 'unknown'} url=${page.url || 'unknown'} location=${location || 'none'} refresh=${refreshUrl || 'none'}`
}

const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url,
    headers: response.headers,
    html: await response.text(),
  }
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))
    || PUBLIC_JOBS_RAW_PATTERNS.some((pattern) => pattern.test(page))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return extractTitle(page) === 'Simhatel - Pioneering Drone Technology & AI Solutions'
    && /href=["'][^"']*\/about["']/i.test(page)
    && /href=["'][^"']*\/contact["']/i.test(page)
    && normalized.includes('see it in action.')
    && normalized.includes('firestriker airdrop')
    && normalized.includes('densesight')
    && normalized.includes('simhatel technology private limited')
    && normalized.includes('support@simhatel.com')
    && normalized.includes('iit mandi, himachal pradesh, india')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return extractTitle(html) === 'Simhatel - Pioneering Drone Technology & AI Solutions'
    && normalized.includes('about simhatel.')
    && normalized.includes('our mission')
    && normalized.includes('dr. amit shukla')
    && normalized.includes('simhatel technology private limited')
    && normalized.includes('support@simhatel.com')
    && normalized.includes('iit mandi, himachal pradesh, india')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return extractTitle(html) === 'Simhatel - Pioneering Drone Technology & AI Solutions'
    && normalized.includes('get in touch.')
    && normalized.includes("we'd love to hear from you. reach out to discuss your project.")
    && normalized.includes('support@simhatel.com')
    && normalized.includes('+91 82269 48584')
    && normalized.includes('iit mandi, himachal pradesh, india')
    && normalized.includes('simhatel technology private limited')
}

export const hasOfficialSitemapSignal = (xml) => {
  const urls = new Set(extractSitemapUrls(xml))

  return urls.has('https://www.simhatel.com')
    && urls.has('https://www.simhatel.com/about')
    && urls.has('https://www.simhatel.com/contact')
    && urls.has('https://www.simhatel.com/products')
    && urls.has('https://www.simhatel.com/products/firestriker-airdrop')
    && urls.has('https://www.simhatel.com/products/densesight')
    && ![...urls].some((url) => CAREER_LIKE_URL_PATTERN.test(url))
}

export const hasOfficialRobotsSignal = (text) => {
  const normalized = normalizeWhitespace(text).toLowerCase()

  return normalized.includes('user-agent: *')
    && normalized.includes('allow: /')
    && normalized.includes('sitemap: https://www.simhatel.com/sitemap.xml')
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page.html ?? '')

  return Number(page.status) === 404
    && extractTitle(html) === '404: This page could not be found.'
    && /<h1[^>]*>\s*404\s*<\/h1>/i.test(html)
    && /this page could not be found/i.test(html)
    && !hasPublicJobsSignal(html)
}

export const isVerifiedMissingCareerAliasRedirect = (page = {}, canonicalUrl) => {
  const location = normalizeAbsoluteUrl(getHeader(page.headers, 'location'), page.url || canonicalUrl)
  const refreshUrl = extractRefreshUrl(page.headers, page.url || canonicalUrl)

  return Number(page.status) === 308
    && location === canonicalUrl
    && refreshUrl === canonicalUrl
}

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: HOMEPAGE_URL,
    alternateCareerPages: [
      ...NO_PUBLIC_CAREERS_ROUTE_URLS,
      ...NO_PUBLIC_CAREERS_ALIAS_URLS,
    ],
    officialSurfaceUrls: [...OFFICIAL_SURFACE_URLS],
    adapter: 'script',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'verified-first-party-site-and-no-public-careers-routes',
    extractionStrategy: 'verified-first-party-marketing-surface-and-missing-careers-routes-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: 'www.simhatel.com',
  },
})

const NO_PUBLIC_CAREERS_ALIAS_TARGETS = [
  [NO_PUBLIC_CAREERS_ALIAS_URLS[0], NO_PUBLIC_CAREERS_ROUTE_URLS[0]],
  [NO_PUBLIC_CAREERS_ALIAS_URLS[1], NO_PUBLIC_CAREERS_ROUTE_URLS[1]],
  [NO_PUBLIC_CAREERS_ALIAS_URLS[2], NO_PUBLIC_CAREERS_ROUTE_URLS[2]],
  [NO_PUBLIC_CAREERS_ALIAS_URLS[3], NO_PUBLIC_CAREERS_ROUTE_URLS[3]],
]

export const createSimhatelScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Simhatel verified homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html) || hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Simhatel homepage now appears to expose a public jobs surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Simhatel verified about page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(aboutPage.html) || hasFirstPartyCareerLikeLink(aboutPage.html)) {
      throw new Error('Simhatel about page now appears to expose a public jobs surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Simhatel verified contact page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(contactPage.html) || hasFirstPartyCareerLikeLink(contactPage.html)) {
      throw new Error('Simhatel contact page now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html) || hasPublicJobsSignal(sitemap.html)) {
      throw new Error('Simhatel verified sitemap no longer matches the known first-party surface')
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (robots.status !== 200 || !hasOfficialRobotsSignal(robots.html) || hasPublicJobsSignal(robots.html)) {
      throw new Error('Simhatel verified robots.txt no longer matches the known first-party surface')
    }

    for (const [aliasUrl, canonicalUrl] of NO_PUBLIC_CAREERS_ALIAS_TARGETS) {
      const aliasPage = await fetchPage(aliasUrl)
      if (!isVerifiedMissingCareerAliasRedirect(aliasPage, canonicalUrl)) {
        throw new Error(
          `Simhatel verified alias route changed: expected redirect to ${canonicalUrl}; received ${describePage(aliasPage)}`,
        )
      }
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Simhatel verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSimhatelScraper().run(options)

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
