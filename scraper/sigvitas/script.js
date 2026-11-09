import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sigvitas'
export const COMPANY = 'Sigvitas'
export const HOMEPAGE_URL = 'https://sigvitas.com/'
export const CONTACT_URL = 'https://sigvitas.com/get-in-touch/'
export const SITEMAP_INDEX_URL = 'https://sigvitas.com/sitemap.xml'
export const PAGE_SITEMAP_URL = 'https://sigvitas.com/page-sitemap.xml'
export const PAGES_API_URL =
  'https://sigvitas.com/wp-json/wp/v2/pages?per_page=100&_fields=slug,link,title,status'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://sigvitas.com/careers/',
  'https://sigvitas.com/careers',
  'https://sigvitas.com/career/',
  'https://sigvitas.com/career',
  'https://sigvitas.com/jobs/',
  'https://sigvitas.com/jobs',
  'https://sigvitas.com/join-us/',
  'https://sigvitas.com/join-us',
]
export const OFFICIAL_SURFACE_URLS = [
  HOMEPAGE_URL,
  CONTACT_URL,
  SITEMAP_INDEX_URL,
  PAGE_SITEMAP_URL,
  PAGES_API_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/sigvitas\.com)?\/(?:careers?|jobs?|join-us)(?:\/|["'#?])/i

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
  /\bposition summary\b/i,
]

const PUBLIC_JOBS_RAW_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
  /linkedin\.com\/jobs/i,
  /mailto:[^"' >]*(careers?|jobs?|recruit|recruiting|talent|hr)[^"' >]*/i,
]

const CAREER_LIKE_URL_PATTERN = /\/(?:careers?|jobs?|join-us)(?:\/|$|[?#])/i
const CAREER_LIKE_SLUG_PATTERN = /^(?:careers?|jobs?|join-us)$/i
const CAREER_LIKE_TITLE_PATTERN = /\b(?:careers?|jobs?|join us)\b/i

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&#x2013;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.6',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasVerifiedLaunchingSoonCareerPlaceholder = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Careers\s*\|\s*Sigvitas\s*<\/title>/i.test(page)
    && normalized.includes('join our team')
    && normalized.includes('we are currently building our careers portal')
    && normalized.includes('launching soon')
    && normalized.includes('look forward to welcoming talented professionals in the near future')
}

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  if (hasVerifiedLaunchingSoonCareerPlaceholder(page)) {
    return false
  }

  return PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))
    || PUBLIC_JOBS_RAW_PATTERNS.some((pattern) => pattern.test(page))
}

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const parsePagesApiEntries = (jsonText) => {
  try {
    const parsed = JSON.parse(String(jsonText ?? ''))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const pageEntryHasCareerLikeSignal = (entry) => {
  const slug = normalizeWhitespace(entry?.slug).toLowerCase()
  const link = normalizeWhitespace(entry?.link)
  const title = normalizeWhitespace(entry?.title?.rendered)

  return CAREER_LIKE_SLUG_PATTERN.test(slug)
    || CAREER_LIKE_URL_PATTERN.test(link)
    || CAREER_LIKE_TITLE_PATTERN.test(title)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Home\s*-\s*Sigvitas\s*<\/title>/i.test(page)
    && normalized.includes('elevate your business to new heights with sigvitas')
    && normalized.includes("unlock your business's full potential with sigvitas")
    && normalized.includes('serving extraordinary capabilities with six sigma compliant solutions')
    && normalized.includes('leading global provider of consulting and technology solutions')
    && normalized.includes('contact@sigvitas.com')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Get In Touch\s*-\s*Sigvitas\s*<\/title>/i.test(page)
    && /<link\s+rel=["']canonical["']\s+href=["']https:\/\/sigvitas\.com\/get-in-touch\/["']/i.test(page)
    && normalized.includes('contact us')
    && normalized.includes('transform your ideas into reality with sigvitas')
    && normalized.includes('leading global provider of consulting and technology solutions')
    && normalized.includes('contact@sigvitas.com')
    && normalized.includes('rajarajeshwari nagar')
    && normalized.includes('mysore')
}

export const hasOfficialSitemapIndexSignal = (xml) => {
  const page = String(xml ?? '')
  const urls = new Set(extractSitemapUrls(page))

  return page.includes('XML Sitemap generated by Yoast SEO')
    && urls.has('https://sigvitas.com/post-sitemap.xml')
    && urls.has('https://sigvitas.com/page-sitemap.xml')
    && urls.has('https://sigvitas.com/portfolio-item-sitemap.xml')
    && ![...urls].some((url) => CAREER_LIKE_URL_PATTERN.test(url))
}

export const hasOfficialPageSitemapSignal = (xml) => {
  const page = String(xml ?? '')
  const urls = new Set(extractSitemapUrls(page))

  return page.includes('XML Sitemap generated by Yoast SEO')
    && urls.has('https://sigvitas.com/')
    && urls.has('https://sigvitas.com/about-us/')
    && urls.has('https://sigvitas.com/custom-software-engineering/')
    && urls.has('https://sigvitas.com/data-analytics/')
    && urls.has('https://sigvitas.com/our-capabilities/')
    && urls.has('https://sigvitas.com/get-in-touch/')
    && ![...urls].some((url) => CAREER_LIKE_URL_PATTERN.test(url))
}

export const hasOfficialPagesApiSignal = (jsonText) => {
  const entries = parsePagesApiEntries(jsonText)
  const publishEntries = entries.filter((entry) => String(entry?.status ?? '').toLowerCase() === 'publish')
  const slugs = new Set(
    publishEntries.map((entry) => normalizeWhitespace(entry?.slug).toLowerCase()).filter(Boolean),
  )

  return publishEntries.length > 0
    && slugs.has('home')
    && slugs.has('about-us')
    && slugs.has('get-in-touch')
    && slugs.has('our-capabilities')
    && slugs.has('data-analytics')
    && !publishEntries.some((entry) => pageEntryHasCareerLikeSignal(entry))
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(page?.status) === 404
    && /<title>\s*Page not found\s*-\s*Sigvitas\s*<\/title>/i.test(html)
    && normalized.includes('page not found')
    && normalized.includes('sigvitas')
    && normalized.includes('contact@sigvitas.com')
    && !hasFirstPartyCareerLikeLink(html)
    && !hasPublicJobsSignal(html)
}

export const isVerifiedLaunchingSoonCareerRoute = (page = {}) =>
  Number(page?.status) === 200
  && hasVerifiedLaunchingSoonCareerPlaceholder(page?.html)
  && !hasFirstPartyCareerLikeLink(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: HOMEPAGE_URL,
    alternateCareerPages: [...NO_PUBLIC_CAREERS_ROUTE_URLS],
    officialSurfaceUrls: [...OFFICIAL_SURFACE_URLS],
    adapter: 'script',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'verified-homepage-contact-sitemap-and-wordpress-page-index-validation',
    extractionStrategy: 'verified-first-party-marketing-surface-plus-missing-careers-routes-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: 'sigvitas.com',
  },
})

export const createSigvitasScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Sigvitas verified official homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html) || hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Sigvitas homepage now appears to expose a public jobs surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Sigvitas verified contact page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(contactPage.html) || hasFirstPartyCareerLikeLink(contactPage.html)) {
      throw new Error('Sigvitas contact page now appears to expose a public jobs surface')
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
    if (
      sitemapIndex.status !== 200
      || !hasOfficialSitemapIndexSignal(sitemapIndex.html)
      || hasPublicJobsSignal(sitemapIndex.html)
    ) {
      throw new Error('Sigvitas verified sitemap index no longer matches the known first-party surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (
      pageSitemap.status !== 200
      || !hasOfficialPageSitemapSignal(pageSitemap.html)
      || hasPublicJobsSignal(pageSitemap.html)
    ) {
      throw new Error('Sigvitas verified page sitemap no longer matches the known first-party surface')
    }

    const pagesApi = await fetchPage(PAGES_API_URL)
    if (
      pagesApi.status !== 200
      || !hasOfficialPagesApiSignal(pagesApi.html)
      || hasPublicJobsSignal(pagesApi.html)
    ) {
      throw new Error('Sigvitas verified pages API no longer matches the known first-party surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (
        isVerifiedMissingCareerRoute(routePage)
        || isVerifiedLaunchingSoonCareerRoute(routePage)
      ) {
        continue
      }

      {
        throw new Error(`Sigvitas verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSigvitasScraper().run(options)

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
