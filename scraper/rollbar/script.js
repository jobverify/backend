import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROLLBAR_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const TRUSTWORTHY_PUBLIC_JOBS_TEXT_PATTERN =
  /\b(current openings|open positions|open roles|job openings|search jobs|view jobs|see all jobs|apply now|apply here)\b/i
const TRUSTWORTHY_PUBLIC_JOBS_URL_PATTERN =
  /(?:myworkdayjobs|greenhouse|lever|ashby|smartrecruiters|jobvite|recruitee|breezy|recruiterflow|icims|dayforcehcm|applytojob|\/(?:jobs|careers)(?:\/|$|\?))/i

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.jobsPageUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_ANCHOR_URL = PROVIDER_METADATA.homepageCareersAnchorUrl
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export { PROVIDER_METADATA }

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|a|footer|main|nav)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? '')
}

const resolveUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return String(value ?? '')
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const extractAnchors = (html = '', baseUrl = HOMEPAGE_URL) => Array.from(
  String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, label]) => ({
    href: resolveUrl(href, baseUrl),
    label: normalizeWhitespace(label),
  }),
)

export const hasOfficialHomepageSignal = (html = '') => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)
  const anchors = extractAnchors(html, HOMEPAGE_URL)

  const legacyHomepage = /^Rollbar \| Error logging & tracking(?: service)? for software teams$/i.test(title || '')
    && normalized.includes('Every error. Every release.')
    && normalized.includes('Under control.')
    && normalized.includes('Code-first observability that connects errors, replays, and releases in one place.')
  const currentHomepage = title === 'Rollbar | Error Tracking Tool That Fixes Errors Too'
    && normalized.includes('Every production error, found and fixed.')
    && normalized.includes('Rollbar is code-first observability.')

  return (legacyHomepage || currentHomepage)
    && anchors.some((anchor) => anchor.label === 'Careers' && anchor.href === CAREERS_ANCHOR_URL)
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)
  const anchors = extractAnchors(html, ABOUT_PAGE_URL)

  return title === 'About Us: Meet the Rollbar Team | Rollbar'
    && normalized.includes('We build what we believe in.')
    && normalized.includes('Life at Rollbar.')
    && normalized.includes('Benefits.')
    && normalized.includes(
      'Join the Rollbar Team and help developers build better software faster, together.',
    )
    && anchors.some((anchor) => anchor.label === 'Contact us' && anchor.href === CONTACT_PAGE_URL)
}

export const hasLinkedTrustworthyPublicJobsSurface = (html = '', baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(html)
  if (TRUSTWORTHY_PUBLIC_JOBS_TEXT_PATTERN.test(normalized)) {
    return true
  }

  return extractAnchors(html, baseUrl).some((anchor) =>
    TRUSTWORTHY_PUBLIC_JOBS_TEXT_PATTERN.test(anchor.label)
      || TRUSTWORTHY_PUBLIC_JOBS_URL_PATTERN.test(anchor.href),
  )
}

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

const verifyHomepagePage = (page) => {
  if (page.status !== 200 || normalizeComparableUrl(page.url) !== normalizeComparableUrl(HOMEPAGE_URL)) {
    throw new Error('Rollbar homepage no longer resolves to the verified first-party homepage')
  }

  if (!hasOfficialHomepageSignal(page.html)) {
    throw new Error('Rollbar verified homepage no longer matches the trusted first-party surface')
  }

  if (hasLinkedTrustworthyPublicJobsSurface(page.html, HOMEPAGE_URL)) {
    throw new Error(`Rollbar public jobs surface now appears reachable: ${page.url}`)
  }
}

const verifyCareersPage = (page) => {
  if (page.status !== 200 || normalizeComparableUrl(page.url) !== normalizeComparableUrl(ABOUT_PAGE_URL)) {
    throw new Error('Rollbar careers route no longer resolves to the verified about page')
  }

  if (hasLinkedTrustworthyPublicJobsSurface(page.html, ABOUT_PAGE_URL)) {
    throw new Error(`Rollbar public jobs surface now appears reachable: ${page.url}`)
  }

  if (!hasOfficialAboutPageSignal(page.html)) {
    throw new Error('Rollbar verified about page no longer matches the trusted first-party careers sentinel')
  }
}

const verifyJobsRoute = (page) => {
  if (page.status !== 200 || normalizeComparableUrl(page.url) !== normalizeComparableUrl(HOMEPAGE_URL)) {
    throw new Error('Rollbar jobs route no longer resolves to the verified homepage shell')
  }

  if (!hasOfficialHomepageSignal(page.html)) {
    throw new Error('Rollbar jobs route no longer resolves to the verified homepage surface')
  }

  if (hasLinkedTrustworthyPublicJobsSurface(page.html, HOMEPAGE_URL)) {
    throw new Error(`Rollbar public jobs surface now appears reachable: ${page.url}`)
  }
}

export const createRollbarScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepagePage = await fetchPage(HOMEPAGE_URL)
    verifyHomepagePage(homepagePage)

    const careersPage = await fetchPage(CAREERS_URL)
    verifyCareersPage(careersPage)

    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    verifyJobsRoute(jobsPage)

    return []
  },
})

export const run = async (options = {}) => createRollbarScraper().run(options)

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
