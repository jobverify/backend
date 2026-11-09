import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import { CELKON_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = CELKON_CATALOG.source
export const COMPANY = CELKON_CATALOG.companyName
export const VERIFIED_ON = CELKON_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = CELKON_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = CELKON_CATALOG
export const LEGACY_HOMEPAGE_URL = CELKON_CATALOG.legacyHomepageUrl
export const HOMEPAGE_URL = CELKON_CATALOG.companyCareerPage
export const ABOUT_URL = CELKON_CATALOG.aboutPageUrl
export const CONTACT_URL = CELKON_CATALOG.contactPageUrl
export const PAGE_SITEMAP_URL = CELKON_CATALOG.pageSitemapUrl
export const CAREERS_ROUTE_URLS = [
  'https://celkongroup.com/careers/',
  'https://celkongroup.com/career/',
  'https://celkongroup.com/jobs/',
  'https://celkongroup.com/job/',
  'https://celkongroup.com/join-us/',
  'https://celkongroup.com/openings/',
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
  /\bview openings\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return null
  }
}

const extractTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '',
)

const isOfficialCurrentDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'celkongroup.com' || hostname === 'www.celkongroup.com'
  } catch {
    return false
  }
}

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

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?celkongroup\.com)?\/(?:career|careers|jobs?|join-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Celkon Group\s*<\/title>/i.test(rawHtml)
    && normalized.includes('build smarter. deliver faster.')
    && normalized.includes('trusted by government bodies, enterprises & institutions across india')
    && normalized.includes('celkon group transforms innovation into impact through world-class electronics manufacturing and purpose-driven technology.')
    && normalized.includes('info@celkonmobiles.com')
}

export const hasOfficialAboutSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /^About Us\s*-\s*Celkon Group$/i.test(extractTitle(rawHtml))
    && normalized.includes('why we are the best')
    && (
      normalized.includes("celkon began it's journey in 2009")
      || normalized.includes('at celkon group, we combine innovation, engineering excellence, and large-scale manufacturing to deliver world-class electronic solutions')
    )
    && normalized.includes('today, celkon stands as the no.1 supplier of mobile phones, tablets, and interactive flat panel displays for government initiatives in india')
}

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /^Contacts\s*-\s*Celkon Group$/i.test(extractTitle(rawHtml))
    && normalized.includes('contact us easily online')
    && normalized.includes('info@celkonmobiles.com')
    && normalized.includes('2/32, kavuri hills rd, cbi colony, madhapur, hyderabad, telangana 500033')
    && /\+91\s*905\s*2345678/.test(normalized)
}

export const pageSitemapHasCareerRoutes = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .some((url) => /\/(?:career|careers|jobs?|join-us|openings)(?:\/|$)/i.test(url))

export const hasVerifiedPageSitemapSignal = (xml) => {
  const rawXml = String(xml ?? '')
  const normalized = normalizeText(rawXml)

  return /<urlset\b/i.test(rawXml)
    && normalized.includes('https://celkongroup.com/')
    && normalized.includes('https://celkongroup.com/about-us/')
    && normalized.includes('https://celkongroup.com/contacts/')
    && !pageSitemapHasCareerRoutes(rawXml)
    && !hasPublicJobsSignal(rawXml)
}

export const isVerifiedLegacyHomepageRedirect = (page = {}) =>
  page.status === 200
  && normalizeUrl(page.url) === normalizeUrl(HOMEPAGE_URL)
  && hasOfficialHomepageSignal(page.html)
  && !hasPublicJobsSignal(page.html)
  && !hasFirstPartyCareerLikeLink(page.html)

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeText(rawHtml)

  return page.status === 404
    && isOfficialCurrentDomainUrl(page.url || '')
    && normalized.includes('page not found')
    && normalized.includes('celkon group')
    && normalized.includes("we're sorry, but the page you were looking for doesn't exist")
    && normalized.includes('404')
    && !hasPublicJobsSignal(rawHtml)
}

export const createCelkonScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const legacyHomepage = await fetchPage(LEGACY_HOMEPAGE_URL)
    if (!isVerifiedLegacyHomepageRedirect(legacyHomepage)) {
      throw new Error('Legacy Celkon homepage no longer redirects to the verified first-party surface')
    }

    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Celkon homepage no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Celkon homepage now appears to expose public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Celkon homepage now exposes a first-party careers or jobs link')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Celkon about page no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(aboutPage.html) || hasFirstPartyCareerLikeLink(aboutPage.html)) {
      throw new Error('Celkon about page now appears to expose a careers or jobs surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Celkon contact page no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(contactPage.html) || hasFirstPartyCareerLikeLink(contactPage.html)) {
      throw new Error('Celkon contact page now appears to expose a careers or jobs surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemapHasCareerRoutes(pageSitemap.html)) {
      throw new Error('Celkon page sitemap now exposes a careers-like route; implement a real scraper after re-verifying the official jobs surface')
    }
    if (pageSitemap.status !== 200 || !hasVerifiedPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Celkon page sitemap no longer matches the verified first-party no-careers surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingCareersRoute(careersRoute) || hasFirstPartyCareerLikeLink(careersRoute.html)) {
        throw new Error(`Celkon careers route changed materially or now exposes public jobs: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCelkonScraper().run(options)

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
