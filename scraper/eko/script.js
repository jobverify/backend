import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EKO_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EKO_CATALOG.source
export const COMPANY = EKO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EKO_CATALOG.officialBrandName
export const VERIFIED_ON = EKO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EKO_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EKO_CATALOG
export const HOMEPAGE_URL = EKO_CATALOG.companyCareerPage
export const CORPORATE_HOMEPAGE_URL = EKO_CATALOG.corporateHomepageUrl
export const ROBOTS_TXT_URL = EKO_CATALOG.robotsTxtUrl
export const SITEMAP_URL = EKO_CATALOG.sitemapUrl
export const CORPORATE_ROBOTS_TXT_URL = EKO_CATALOG.corporateRobotsTxtUrl
export const CORPORATE_SITEMAP_URL = EKO_CATALOG.corporateSitemapUrl
export const CAREERS_ROUTE_URLS = [
  'https://eko.in/careers',
  'https://eko.in/career',
  'https://eko.in/jobs',
  'https://eko.in/join-us',
  'https://eko.in/work-with-us',
  'https://eko.in/openings',
]
export const CORPORATE_CAREERS_ROUTE_URLS = [
  'https://about.eko.in/careers',
  'https://about.eko.in/career',
  'https://about.eko.in/jobs',
  'https://about.eko.in/join-us',
  'https://about.eko.in/work-with-us',
  'https://about.eko.in/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
  /freshteam/i,
  /zohorecruit/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'eko.in' || hostname === 'www.eko.in' || hostname === 'about.eko.in'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:about\.)?eko\.in)?\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasCareerRouteInSitemap = (content) =>
  /https?:\/\/(?:about\.)?eko\.in\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|<|\?|#|$)/i.test(String(content ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Eko Bharat Ventures Private Limited \| The Leading Fintech Company in India\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Best way to send money and do Aadhaar based withdrawal')
    && normalized.includes('Checkout our new websites')
    && /https:\/\/about\.eko\.in/i.test(rawHtml)
    && normalized.includes('Banking & Financial institution')
}

export const hasOfficialCorporateHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const metaDescription =
    rawHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || rawHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || ''
  const descriptionHaystack = normalizeWhitespace(`${metaDescription} ${rawHtml}`) || ''

  return /<title>\s*Eko \| Financial Infrastructure for Micro-Entrepreneurs\s*<\/title>/i.test(rawHtml)
    && (
      /Financial infrastructure for micro-entrepreneurs across the developing world/i.test(rawHtml)
      || descriptionHaystack.includes('Financial infrastructure for micro-entrepreneurs across the developing world')
    )
    && descriptionHaystack.includes('Eko builds fintech infrastructure enabling micro-entrepreneurs, enterprises, and financial institutions to deliver digital financial services at scale.')
}

export const hasOfficialRobotsTxtSignal = (content) => {
  const text = String(content ?? '')

  return /User-agent:\s*\*/i.test(text)
    && /Disallow:\s*\/admin\//i.test(text)
    && /Disallow:\s*\/404\.html/i.test(text)
    && /Sitemap:\s*https:\/\/eko\.in\/sitemap\.xml/i.test(text)
}

export const hasOfficialSitemapSignal = (content) => {
  const text = String(content ?? '')

  return /<urlset/i.test(text)
    && /https:\/\/eko\.in\/about-us\//i.test(text)
    && /https:\/\/eko\.in\/retailer\//i.test(text)
    && /https:\/\/eko\.in\/developers\/eps\//i.test(text)
    && /https:\/\/eko\.in\//i.test(text)
}

export const hasOfficialCorporateRobotsTxtSignal = (content) => {
  const text = String(content ?? '')

  return /User-agent:\s*\*/i.test(text)
    && /Disallow:\s*\/\s*$/im.test(text)
}

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && !hasPublicJobsSignal(page.html)
  && !hasFirstPartyCareerLikeLink(page.html)

export const isMissingCorporateSitemap = (page = {}) =>
  Number(page.status) === 404
  && (() => {
    try {
      return new URL(page.url || '').hostname.toLowerCase() === 'about.eko.in'
    } catch {
      return false
    }
  })()
  && !hasPublicJobsSignal(page.html)

export const createEkoScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString() } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Eko verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Eko homepage now appears to expose public jobs')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Eko homepage now exposes a first-party careers or jobs link')
    }

    const corporateHomepage = await fetchPage(CORPORATE_HOMEPAGE_URL)
    if (corporateHomepage.status !== 200 || !hasOfficialCorporateHomepageSignal(corporateHomepage.html)) {
      throw new Error('Eko verified corporate homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(corporateHomepage.html)) {
      throw new Error('Eko corporate homepage now appears to expose public jobs')
    }

    if (hasFirstPartyCareerLikeLink(corporateHomepage.html)) {
      throw new Error('Eko corporate homepage now exposes a first-party careers or jobs link')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxt.status !== 200 || !hasOfficialRobotsTxtSignal(robotsTxt.html)) {
      throw new Error('Eko verified robots.txt surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(robotsTxt.html)) {
      throw new Error('Eko robots.txt now advertises a careers or jobs route')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html)) {
      throw new Error('Eko verified sitemap surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(sitemap.html)) {
      throw new Error('Eko sitemap now advertises a careers or jobs route')
    }

    const corporateRobotsTxt = await fetchPage(CORPORATE_ROBOTS_TXT_URL)
    if (corporateRobotsTxt.status !== 200 || !hasOfficialCorporateRobotsTxtSignal(corporateRobotsTxt.html)) {
      throw new Error('Eko verified corporate robots.txt surface no longer matches the known public surface')
    }

    const corporateSitemap = await fetchPage(CORPORATE_SITEMAP_URL)
    if (!isMissingCorporateSitemap(corporateSitemap)) {
      throw new Error(`Eko verified missing corporate sitemap changed: ${corporateSitemap.url || CORPORATE_SITEMAP_URL}`)
    }

    for (const routeUrl of [...CAREERS_ROUTE_URLS, ...CORPORATE_CAREERS_ROUTE_URLS]) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Eko verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: HOMEPAGE_URL, firstParty: true, listingComplete: false,
      pagesFetched: 6 + CAREERS_ROUTE_URLS.length + CORPORATE_CAREERS_ROUTE_URLS.length,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'first-party-pages-and-missing-careers-routes-do-not-prove-active-vacancy-inventory',
    })
  },
})

export const run = async (options = {}) => createEkoScraper().run(options)

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
