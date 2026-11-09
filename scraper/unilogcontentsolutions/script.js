import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import UNILOG_CONTENT_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = UNILOG_CONTENT_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const FOREIGN_LOCATION_PATTERN =
  /\b(united states|usa|philadelphia|wayne, pa|pennsylvania|europe|canada|uk|united kingdom)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugifyUrl = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    const segments = pathname.split('/').filter(Boolean)
    return segments.at(-1) || null
  } catch {
    return null
  }
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

const toCityList = (location) =>
  String(location ?? '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .filter((part) => !/^remote$/i.test(part))

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return false
  return !FOREIGN_LOCATION_PATTERN.test(normalized)
}

export const hasOfficialUnilogCareersSignals = (html = '') => {
  const page = String(html ?? '')

  return /Careers at Unilog/i.test(page)
    && /Build What(?:\u2019|â€™|')s Next in B2B Commerce\. Together\./i.test(page)
    && /Open Roles/i.test(page)
}

export const hasVerifiedCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && /challenges\.cloudflare\.com/i.test(page)
    && text.includes('Just a moment...')
    && (
      text.includes('Please enable JavaScript and cookies to continue')
      || text.includes('Enable JavaScript and cookies to continue')
    )
}

export const extractVisibleRoleCards = (html = '') => {
  const cards = []
  const seenJobIds = new Set()

  for (const match of String(html ?? '').matchAll(/<article\b[^>]*class=["'][^"']*\bjob-role-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const articleHtml = match[0]
    const title = normalizeWhitespace(articleHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const sourceUrl = normalizeWhitespace(articleHtml.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])
    const employmentType = normalizeWhitespace(articleHtml.match(/<p[^>]*>\s*(Full Time|Contract)\s*<\/p>/i)?.[1])
    const locationValues = Array.from(
      articleHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
      (entry) => normalizeWhitespace(entry[1]),
    ).filter(Boolean)
    const location = locationValues
      .filter((value) => value !== employmentType)
      .join(' / ')
      .replace(/\s+\/\s+\/\s+/g, ' / ')
      .trim()

    if (!title || !sourceUrl || !location || !isIndiaLocation(location)) continue

    const jobId = slugifyUrl(sourceUrl)
    if (!jobId || seenJobIds.has(jobId)) continue

    seenJobIds.add(jobId)
    cards.push({
      title,
      location,
      cities: toCityList(location),
      country: 'India',
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      jobId,
    })
  }

  return cards
}

export const isVerifiedCloudflareChallengedPage = (page = {}, requestedUrl) => {
  const html = getPageHtml(page)

  return Number(page.status) === 403
    && String(page.url || requestedUrl) === requestedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && hasVerifiedCloudflareChallengeSignal(html)
}

export const createUnilogContentSolutionsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage, fetchText } = {}) {
    const effectiveFetchPage = fetchPage || (fetchText
      ? async (url) => ({
        status: 200,
        url,
        headers: {},
        html: await fetchText(url),
      })
      : defaultFetchPage)

    const homepage = await effectiveFetchPage(OFFICIAL_HOMEPAGE_URL)
    if (!isVerifiedCloudflareChallengedPage(homepage, OFFICIAL_HOMEPAGE_URL)) {
      throw new Error('Unilog Content Solutions homepage no longer matches the verified Cloudflare-challenged first-party state')
    }

    const careersPage = await effectiveFetchPage(OFFICIAL_CAREERS_URL)
    const careersHtml = getPageHtml(careersPage)
    if (hasOfficialUnilogCareersSignals(careersHtml) || extractVisibleRoleCards(careersHtml).length > 0) {
      const jobs = extractVisibleRoleCards(careersHtml)
      const limitedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
      if (limitedJobs.length > 0) {
        throw new Error('Unilog Content Solutions careers route now appears to expose public jobs again')
      }
      throw new Error('Unilog Content Solutions careers route now appears to expose public jobs again')
    }

    if (!isVerifiedCloudflareChallengedPage(careersPage, OFFICIAL_CAREERS_URL)) {
      throw new Error('Unilog Content Solutions careers route no longer matches the verified Cloudflare-challenged first-party state')
    }

    return []
  },
})

export const run = async (options = {}) => createUnilogContentSolutionsScraper(options).run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
