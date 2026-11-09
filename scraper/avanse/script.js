import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AVANSE_CATALOG } from './catalog.js'
import{createCurrentSurfaceScraper}from'../atomberg/currentSurface.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AVANSE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const NO_TRUST_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.avanse.com/careers',
  'https://www.avanse.com/careers/',
  'https://www.avanse.com/jobs',
  'https://www.avanse.com/jobs/',
  'https://www.avanse.com/work-with-us',
  'https://www.avanse.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripScripts = (html = '') => String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

const extractAnchorHrefs = (html = '') =>
  [...String(html ?? '').matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi)].map((match) => match[2].trim())

const isPlaceholderHref = (href = '') => {
  const normalized = String(href ?? '').trim().toLowerCase()
  return normalized === '' || normalized === '#' || normalized.startsWith('javascript:')
}

const isKnownNonJobApplicationHref = (href = '') => {
  try {
    const url = new URL(String(href ?? '').trim(), HOMEPAGE_URL)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '').toLowerCase()

    return (
      hostname === 'avanse.com'
      && (pathname === '/career' || pathname === '/apply-now')
    ) || (
      hostname === 'customerportal.avanse.com'
      && pathname === '/apply-now'
    )
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

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: createTimeoutSignal(url === JOBS_API_URL ? 20000 : 30000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } catch (error) {
    return {
      status: null,
      url,
      html: '',
      error,
    }
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Avanse Financial Services: NBFC Education Loan for Students\s*<\/title>/i.test(rawHtml)
    && /Avanse Financial Services/i.test(normalized)
    && /href=["']\/career["']/i.test(rawHtml)
}

export const extractCareersUrl = (html = '') => {
  const rawHtml = String(html ?? '')
  const match = /<a\b[^>]*href=(["'])(\/career|https:\/\/www\.avanse\.com\/career)\1/iu.exec(rawHtml)

  if (!match) {
    return null
  }

  return match[2].startsWith('http') ? match[2] : new URL(match[2], HOMEPAGE_URL).toString()
}

export const careerPageExposesTrustworthyPublicJobs = (html = '') => {
  const contentHtml = stripScripts(html)
  const hrefs = extractAnchorHrefs(contentHtml)
  const normalized = normalizeWhitespace(contentHtml)

  const hasRealApplyLink = hrefs.some((href) => {
    if (isPlaceholderHref(href) || isKnownNonJobApplicationHref(href)) {
      return false
    }

    return /(apply|job|career|opening|position|greenhouse|lever|workday|keka)/i.test(href)
  })

  return hasRealApplyLink
    && (/\bapply now\b/i.test(normalized) || /\bjob openings\b/i.test(normalized) || /\bopen positions?\b/i.test(normalized))
}

export const hasUnreliableJobsShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Career At Avanse Financial Services\s*<\/title>/i.test(rawHtml)
    && /<meta\s+name=["']description["']\s+content=["']Explore job opportunities for different roles and responsibilities at Avanse Financial Services["']/i.test(rawHtml)
    && /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.avanse\.com\/career["']/i.test(rawHtml)
    && /\bJob Openings\b/i.test(normalized)
    && /renderJobs\s*\(/i.test(rawHtml)
    && /\/public\/api\/getAllJobs/i.test(rawHtml)
    && /href=["']#["']/i.test(rawHtml)
    && !careerPageExposesTrustworthyPublicJobs(rawHtml)
}

const isTimeoutOrAbortError = (error) => {
  const text = [
    error?.name,
    error?.message,
    error?.code,
    error?.cause?.code,
  ].filter(Boolean).join(' ')

  return /(abort|timeout|timed\s*out|etimedout|und_err_connect_timeout)/i.test(text)
}

export const isVerifiedJobsApiGatewayTimeout = (page = {}, requestedUrl = JOBS_API_URL) => (
  Number(page?.status) === 504
  && String(page?.url ?? requestedUrl) === requestedUrl
  && /\b504 Gateway Time-out\b/i.test(String(page?.html ?? ''))
) || (
  String(page?.url ?? requestedUrl) === requestedUrl
  && isTimeoutOrAbortError(page?.error)
)

const normalizeRouteUrl = (value = '') => {
  try {
    const url = new URL(String(value ?? ''), HOMEPAGE_URL)
    url.hash = ''
    url.search = ''
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    return url.toString()
  } catch {
    return String(value ?? '').replace(/\/+$/, '')
  }
}

export const isVerifiedNoTrustPublicJobRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 404
  && normalizeRouteUrl(page?.url ?? requestedUrl) === normalizeRouteUrl(requestedUrl)
  && /(?:\b404 Not Found\b|\b404\s*-\s*Error\b|\bPage Not Found\b|unable to serve your request as the page you requested could not be found|Like The Fact That This Page Doesn't Exist)/i.test(String(page?.html ?? ''))
  && !careerPageExposesTrustworthyPublicJobs(page?.html ?? '')


export const createAvanseScraper=defaults=>createCurrentSurfaceScraper({source:SOURCE,url:CAREERS_URL,canonicalUrl:CAREERS_URL,title:/Career At Avanse Financial Services/i,companySignal:'Working at Avanse'},defaults)

export const run = async (options = {}) => createAvanseScraper().run(options)

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
