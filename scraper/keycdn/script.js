import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KEYCDN_CATALOG as PROVIDER_METADATA } from './catalog.js'

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
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
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

const resolveUrl = (value, baseUrl = CAREERS_URL) => {
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

const extractAnchors = (html = '', baseUrl = CAREERS_URL) => Array.from(
  String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, label]) => ({
    href: resolveUrl(href, baseUrl),
    label: normalizeWhitespace(label),
  }),
)

export const hasVerifiedCareersPageSignal = (html = '') => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)

  return [
    "Careers at KeyCDN | We're hiring! | KeyCDN",
    'Careers - KeyCDN',
  ].includes(title)
    && (
      normalized.includes('We are looking for smart and enthusiastic people who work hard and have fun while doing so.')
      || normalized.includes('We are looking for smart and enthusiastic people to help us build a world-class CDN.')
    )
    && normalized.includes('Remote first company')
    && normalized.includes('Made in Switzerland')
}

export const hasLinkedTrustworthyPublicJobsSurface = (html = '', baseUrl = CAREERS_URL) => {
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

const verifyCareersPage = (page) => {
  if (page.status !== 200 || normalizeComparableUrl(page.url) !== normalizeComparableUrl(CAREERS_URL)) {
    throw new Error('KeyCDN careers page no longer resolves to the verified first-party page')
  }

  if (hasLinkedTrustworthyPublicJobsSurface(page.html, CAREERS_URL)) {
    throw new Error(`KeyCDN public jobs surface now appears reachable: ${page.url}`)
  }

  if (!hasVerifiedCareersPageSignal(page.html)) {
    throw new Error('KeyCDN verified careers page no longer matches the trusted first-party sentinel')
  }
}

export const createKeycdnScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    verifyCareersPage(careersPage)
    return []
  },
})

export const run = async (options = {}) => createKeycdnScraper().run(options)

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
