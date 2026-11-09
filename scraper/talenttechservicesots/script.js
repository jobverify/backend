import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'talenttechservicesots'
export const COMPANY = 'Talent Tech Services (OTS)'
export const HOMEPAGE_URL = 'https://talenttechservices.com/'
export const CONTACT_URL = 'https://talenttechservices.com/contact/'
export const ROBOTS_URL = 'https://talenttechservices.com/robots.txt'
export const SITEMAP_INDEX_URL = 'https://talenttechservices.com/wp-sitemap.xml'
export const PAGE_SITEMAP_URL = 'https://talenttechservices.com/wp-sitemap-posts-page-1.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://talenttechservices.com/careers',
  'https://talenttechservices.com/career',
  'https://talenttechservices.com/jobs',
  'https://talenttechservices.com/join-us',
  'https://talenttechservices.com/openings',
]
export const EXPECTED_PAGE_SITEMAP_URLS = [
  'https://talenttechservices.com/contact/',
  'https://talenttechservices.com/blog/',
  'https://talenttechservices.com/testimonial/',
  'https://talenttechservices.com/case-studies/',
  'https://talenttechservices.com/services/',
  'https://talenttechservices.com/about-us/',
  'https://talenttechservices.com/',
]

const EXPECTED_SITEMAP_INDEX_URLS = [
  'https://talenttechservices.com/wp-sitemap-posts-post-1.xml',
  'https://talenttechservices.com/wp-sitemap-posts-page-1.xml',
  'https://talenttechservices.com/wp-sitemap-taxonomies-category-1.xml',
  'https://talenttechservices.com/wp-sitemap-users-1.xml',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?talenttechservices\.com)?\/(?:careers?|jobs?|join-us|openings)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8211;|&#x2013;/gi, '-')
    .replace(/&#8217;|&#x2019;|&apos;|&rsquo;|&lsquo;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const isFirstPartyUrl = (value) =>
  /^https:\/\/talenttechservices\.com(?:\/|$)/i.test(String(value ?? ''))

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

export const hasUnexpectedCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /<title>\s*Talent Tech Services\s*<\/title>/i.test(raw)
    && /href=["'](?:https?:\/\/(?:www\.)?talenttechservices\.com)?\/about-us\/?["']/i.test(raw)
    && /href=["'](?:https?:\/\/(?:www\.)?talenttechservices\.com)?\/services\/?["']/i.test(raw)
    && /href=["'](?:https?:\/\/(?:www\.)?talenttechservices\.com)?\/contact\/?["']/i.test(raw)
    && normalized.includes('Smart IT Recruitment for a Digital World')
    && normalized.includes('Talent Techservices specializes in sourcing, screening, and placing high-quality IT professionals across technologies.')
    && normalized.includes('We provide end-to-end IT recruitment solutions, connecting businesses with skilled professionals across all technology domains.')
    && normalized.includes('Address : 30 N Gould St Ste R Sheridan, WY 82801')
    && normalized.includes('Email : info@talenttechservices.com')
  }

export const hasOfficialContactSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return (
    /<title>\s*Contact\s*(?:-|&#8211;|&ndash;|&#x2013;)\s*Talent Tech Services\s*<\/title>/i.test(raw)
    || normalized.includes('Contact - Talent Tech Services')
  )
    && normalized.includes('Contact & Reach Us For More Information')
    && normalized.includes('Connect with Talent Techservices today to hire top IT talent or boost your digital presence.')
    && normalized.includes('Location Address 30 N Gould St Ste R Sheridan, WY 82801')
    && normalized.includes('Phone Numbers Phone : +1213-451-5496')
    && normalized.includes('Email Address info@talenttechservices.com')
}

export const hasOfficialRobotsSignal = (text) => {
  const normalized = normalizeWhitespace(text)

  return normalized.includes('User-agent: *')
    && normalized.includes('Disallow: /wp-admin/')
    && normalized.includes('Allow: /wp-admin/admin-ajax.php')
    && normalized.includes('Sitemap: https://talenttechservices.com/wp-sitemap.xml')
}

export const hasOfficialSitemapIndexSignal = (xml) => {
  const raw = String(xml ?? '')
  const urls = extractSitemapUrls(raw)
  const urlSet = new Set(urls)

  return raw.includes('https://talenttechservices.com/wp-sitemap-index.xsl')
    && urls.length === EXPECTED_SITEMAP_INDEX_URLS.length
    && EXPECTED_SITEMAP_INDEX_URLS.every((url) => urlSet.has(url))
    && !urls.some((url) => /\b(careers?|jobs?|join-us|openings)\b/i.test(url))
}

export const hasExpectedPageSitemapSignal = (xml) => {
  const raw = String(xml ?? '')
  const urls = extractSitemapUrls(raw)
  const urlSet = new Set(urls)

  return raw.includes('https://talenttechservices.com/wp-sitemap.xsl')
    && urls.length === EXPECTED_PAGE_SITEMAP_URLS.length
    && EXPECTED_PAGE_SITEMAP_URLS.every((url) => urlSet.has(url))
    && !urls.some((url) => /\b(careers?|jobs?|join-us|openings)\b/i.test(url))
}

export const hasOfficialMissingCareersRouteSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return Number(page?.status) === 404
    && isFirstPartyUrl(page?.url)
    && normalized.includes('Page not found - Talent Tech Services')
    && normalized.includes("Oops! that page can't be found.")
    && normalized.includes('Maybe try one of the links below or a search?')
    && normalized.includes('Feel free to contact & reach us !')
    && !hasUnexpectedCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createTalentTechServicesOtsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !isFirstPartyUrl(homepage.url) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error(
        'Talent Tech Services (OTS) verified official homepage no longer matches the known first-party surface',
      )
    }
    if (hasUnexpectedCareerLikeLink(homepage.html)) {
      throw new Error(
        'Talent Tech Services (OTS) homepage now exposes a first-party careers route',
      )
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error(
        'Talent Tech Services (OTS) homepage now appears to expose a public jobs surface',
      )
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (
      contactPage.status !== 200
      || !isFirstPartyUrl(contactPage.url)
      || !hasOfficialContactSignal(contactPage.html)
    ) {
      throw new Error(
        'Talent Tech Services (OTS) verified contact page no longer matches the known first-party surface',
      )
    }
    if (hasUnexpectedCareerLikeLink(contactPage.html)) {
      throw new Error(
        'Talent Tech Services (OTS) contact page now exposes a first-party careers route',
      )
    }
    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error(
        'Talent Tech Services (OTS) contact page now appears to expose a public jobs surface',
      )
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (robots.status !== 200 || !isFirstPartyUrl(robots.url) || !hasOfficialRobotsSignal(robots.html)) {
      throw new Error(
        'Talent Tech Services (OTS) verified robots.txt no longer matches the known first-party contract',
      )
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
    if (
      sitemapIndex.status !== 200
      || !isFirstPartyUrl(sitemapIndex.url)
      || !hasOfficialSitemapIndexSignal(sitemapIndex.html)
    ) {
      throw new Error(
        'Talent Tech Services (OTS) verified sitemap index no longer matches the known first-party surface',
      )
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (
      pageSitemap.status !== 200
      || !isFirstPartyUrl(pageSitemap.url)
      || !hasExpectedPageSitemapSignal(pageSitemap.html)
      || hasPublicJobsSignal(pageSitemap.html)
    ) {
      throw new Error(
        'Talent Tech Services (OTS) verified page sitemap no longer matches the no-public-careers surface',
      )
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!hasOfficialMissingCareersRouteSignal(routePage)) {
        throw new Error(
          `Talent Tech Services (OTS) verified missing careers route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTalentTechServicesOtsScraper().run(options)

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
