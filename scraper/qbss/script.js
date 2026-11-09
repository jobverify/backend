import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { QBSS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = QBSS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_CAREERS_URL = PROVIDER_METADATA.legacyCareerPage
export const WORKING_AT_URL = PROVIDER_METADATA.workingAtUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
}

const REQUIRED_SURFACE_PATTERNS = [
  /\bgrow professionally\. contribute meaningfully\. succeed together\./i,
  /\bjobs at continuserve\b/i,
  /\bjobs at our clients\b/i,
  /\bjob openings\b/i,
  /\bview our open positions\b/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const stripTagsWithLineBreaks = (value = '') =>
  decodeEntities(String(value))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|main|header|footer|li|ul|ol|tr|table|h[1-6])>/gi, '\n')
    .replace(/<(td|th)\b[^>]*>/gi, '\t')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildChromiumLaunchArgs = () =>
  process.env.PUPPETEER_DISABLE_SANDBOX ? ['--no-sandbox'] : []

const normalizeCareerUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    const parsed = new URL(value, baseUrl)
    const pathname = parsed.pathname.replace(/\/+$/, '')
    const match = pathname.match(/^\/careers\/([a-z0-9-]+)$/i)

    if (!match) return null

    return `https://continuserve.com/careers/${match[1].toLowerCase()}/`
  } catch {
    return null
  }
}

const extractFirstMatch = (value = '', pattern) => {
  const match = String(value ?? '').match(pattern)
  return normalizeWhitespace(match?.[1] || null)
}

const extractHeading = (html = '') => {
  const h1 = extractFirstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1) return h1

  const title = extractFirstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return title ? title.replace(/\s*-\s*continuserve\s*$/i, '').trim() : null
}

const extractCareerDetailFields = (html = '') => {
  const entries = {}
  const pattern = /<tr\b[^>]*>\s*<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const key = normalizeWhitespace(match[1])
    const value = normalizeWhitespace(match[2])
    if (!key || !value) continue
    entries[key] = value
  }

  return entries
}

const extractParagraphDescription = (html = '') => {
  const beforeDetails = String(html ?? '').split(/<h[1-6]\b[^>]*>\s*details\s*<\/h[1-6]>/i)[0]
  const paragraphs = [...beforeDetails.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((value) => !/^(required experience|work mode|shift)\s*:/i.test(value))

  return paragraphs.length > 0 ? paragraphs.join(' ') : null
}

const extractLabeledValue = (html = '', label) => {
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:\\s*([^\\n\\r<]+)`, 'i')
  return extractFirstMatch(stripTagsWithLineBreaks(html), pattern)
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/remote/.test(normalized)) return 'Remote'
  if (/hybrid/.test(normalized)) return 'Hybrid'
  if (/on[- ]?site|office/.test(normalized)) return 'On-site'
  return null
}

export const assertVerifiedContinuServeSurface = (listingUrl = CAREERS_URL, html = '') => {
  const normalizedUrl = normalizeWhitespace(listingUrl)
  const surfaceText = normalizeText(html)

  if (
    normalizedUrl
    && /^https?:\/\/continuserve\.com\/careers\/?(?:[?#].*)?$/i.test(normalizedUrl)
    && REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(surfaceText))
  ) {
    return
  }

  throw new Error(
    'QBSS verified ContinuServe careers surface changed; review the rebrand contract before updating the scraper.',
  )
}

export const extractContinuServeDetailUrls = (html = '') => {
  const detailUrls = []
  const seen = new Set()
  const hrefPattern = /href=["']([^"']+)["']/gi

  for (const match of String(html ?? '').matchAll(hrefPattern)) {
    const normalizedUrl = normalizeCareerUrl(match[1])
    if (!normalizedUrl || seen.has(normalizedUrl)) continue
    seen.add(normalizedUrl)
    detailUrls.push(normalizedUrl)
  }

  return detailUrls
}

export const extractContinuServeJob = ({
  url,
  html,
  scrapedAt,
} = {}) => {
  const normalizedUrl = normalizeCareerUrl(url)
  const title = extractHeading(html)
  const details = extractCareerDetailFields(html)
  const company = normalizeWhitespace(details.Company)
  const division = normalizeWhitespace(details.Division)
  const country = normalizeWhitespace(details.Country)
  const type = normalizeWhitespace(details.Type)

  if (!normalizedUrl || !title) return null
  if (company !== OFFICIAL_BRAND_NAME) return null
  if (!/^india$/i.test(country || '')) return null
  if (!/^jobs at continuserve$/i.test(type || '')) return null

  const jobId = normalizedUrl.match(/\/careers\/([a-z0-9-]+)\//i)?.[1] || null
  if (!jobId) return null

  return {
    title,
    company: COMPANY,
    department: division || null,
    location: country,
    city: null,
    state: null,
    country,
    jobId,
    requisitionId: jobId,
    sourceUrl: normalizedUrl,
    applyUrl: normalizedUrl,
    employmentType: null,
    experienceRequired: extractLabeledValue(html, 'Required Experience'),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: extractParagraphDescription(html),
    remoteStatus: normalizeRemoteStatus(extractLabeledValue(html, 'Work Mode')),
    source: SOURCE,
    link: normalizedUrl,
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: REQUEST_HEADERS,
  label: SOURCE,
  timeoutMs: 20000,
})

export const loadLiveCareersContractFromHttp = async ({
  fetchText = defaultFetchText,
} = {}) => {
  const listingHtml = await fetchText(CAREERS_URL)
  const detailUrls = extractContinuServeDetailUrls(listingHtml)
  const detailPages = []

  for (const detailUrl of detailUrls) {
    detailPages.push({
      url: detailUrl,
      html: await fetchText(detailUrl),
    })
  }

  return {
    listingUrl: CAREERS_URL,
    listingHtml,
    detailPages,
  }
}

const defaultLoadLiveCareersContract = async () => loadLiveCareersContractFromHttp()

export const createQbssScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    loadLiveCareersContract = defaultLoadLiveCareersContract,
    now: overrideNow,
  } = {}) {
    const contract = await loadLiveCareersContract()

    assertVerifiedContinuServeSurface(contract?.listingUrl || CAREERS_URL, contract?.listingHtml || '')

    const detailUrls = extractContinuServeDetailUrls(contract?.listingHtml || '')
    const detailPages = Array.isArray(contract?.detailPages) ? contract.detailPages : []
    const detailHtmlByUrl = new Map(
      detailPages
        .map((page) => [normalizeCareerUrl(page?.url), page?.html])
        .filter(([normalizedUrl, html]) => normalizedUrl && typeof html === 'string'),
    )

    if (detailUrls.length === 0) {
      throw new Error('QBSS ContinuServe careers surface no longer exposes the verified detail-page contract.')
    }

    const scrapedAt = (overrideNow || now)()

    return detailUrls
      .map((detailUrl) => {
        const detailHtml = detailHtmlByUrl.get(detailUrl)
        if (typeof detailHtml !== 'string') {
          throw new Error(`Missing verified QBSS detail page for ${detailUrl}`)
        }

        return extractContinuServeJob({
          url: detailUrl,
          html: detailHtml,
          scrapedAt,
        })
      })
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createQbssScraper().run(options)

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
