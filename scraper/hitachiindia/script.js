import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchHitachiParadoxJobs, normalizeHitachiParadoxJob } from '../../scraper-support/shared/hitachiParadoxJobs.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SEARCH_PAGE_URL = 'https://careers.hitachi.com/search/hitachi-india-pvt-ltd/jobs/in/country/india'

const CAREERS_ORIGIN = 'https://careers.hitachi.com'
const COMPANY_NAME = 'HITACHI INDIA PVT. LTD'
const SOURCE = 'hitachiindia'
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
}
const NULLISH_SECTION_LABELS = [
  'Apply Now',
  'Share:',
]
const DESCRIPTION_STOP_LABELS = [
  'Skills Required:',
  'Minimum Qualification:',
  'Preferred Qualification:',
  'Qualifications:',
  ...NULLISH_SECTION_LABELS,
]
const SKILLS_STOP_LABELS = [
  'Desired Digital Skills:',
  'Experience:',
  'Minimum Qualification:',
  'Preferred Qualification:',
  'Qualifications:',
  'Language:',
  'Personality – Must Have:',
  ...NULLISH_SECTION_LABELS,
]
const QUALIFICATION_STOP_LABELS = [
  'Preferred Qualification:',
  'Skills Required:',
  'Experience:',
  ...NULLISH_SECTION_LABELS,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#39;/gi, '\'')
  .replace(/&apos;/gi, '\'')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&#x2013;/gi, '–')

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')),
)

const unique = (values) => [...new Set(values.filter(Boolean))]

const hasMeaningfulValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return Boolean(normalized && normalized !== ':')
}

const normalizeCompanyKey = (value) => normalizeWhitespace(value)?.toUpperCase() || null

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_ORIGIN).toString()
  } catch {
    return normalized
  }
}

const htmlToLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/?(?:article|div|h[1-6]|li|main|ol|p|section|ul)[^>]*>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractLabelValue = (lines, label) => {
  const pattern = new RegExp(`^${escapeRegex(label)}\\s*:?\\s*(.+)$`, 'i')
  const line = lines.find((value) => pattern.test(value))
  return normalizeWhitespace(line?.replace(pattern, '$1'))
}

const extractContextField = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<span[^>]*class=["'][^"']*hide[^"']*["'][^>]*>\\s*${escapeRegex(label)}\\s*:?\\s*<\\/span>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )
  const value = stripTags(match?.[1])
  return hasMeaningfulValue(value) ? value : null
}

const hasLabel = (value, label) => new RegExp(`^${escapeRegex(label)}$`, 'i').test(String(value ?? ''))

const extractSectionLines = (lines, label, stopLabels = []) => {
  const startIndex = lines.findIndex((value) => hasLabel(value, label))
  if (startIndex === -1) return []

  const collected = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (stopLabels.some((stopLabel) => hasLabel(line, stopLabel))) break
    collected.push(line)
  }

  return collected
}

const splitLocation = (location) => {
  const parts = unique(
    String(location ?? '')
      .split(',')
      .map((part) => normalizeWhitespace(part)),
  )

  return {
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts.at(-1) || null,
  }
}

const extractListingJobId = (sourceUrl) => normalizeWhitespace(
  String(sourceUrl ?? '').match(/\/jobs\/(\d+)(?:[-/?#]|$)/i)?.[1],
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const parsed = Date.parse(
    /[a-z]{3,9}\s+\d{1,2},\s+\d{4}/i.test(normalized)
      ? `${normalized} UTC`
      : normalized,
  )
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10)
}

const isBrowserFallbackError = (error) =>
  /HTTP 403|timed out|timeout|fetch failed|certificate|blocked/i.test(String(error?.message ?? error ?? ''))

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: DEFAULT_HEADERS,
  label: 'hitachiindia-page',
  timeoutMs: 15000,
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: DEFAULT_HEADERS,
  label: 'hitachiindia-text',
})

const defaultFetchImpl = (url, options = {}) => fetch(url, {
  method: options.method || 'GET',
  headers: {
    ...DEFAULT_HEADERS,
    ...(options.headers || {}),
  },
  redirect: options.redirect || 'follow',
})

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  headers: {},
  html: await fetchText(url),
})

export const buildSearchPageUrl = () => SEARCH_PAGE_URL

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = normalizeWhitespace(html) || ''

  return Number(page.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /challenges\.cloudflare\.com/i.test(html)
    && text.includes('Enable JavaScript and cookies to continue')
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
    && hasVerifiedCloudflareChallengeSignal(page)
}

export const extractListings = (html = '') => {
  const source = String(html ?? '')
  const linkPattern = /<a[^>]+href=["']([^"']*\/jobs\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  const matches = [...source.matchAll(linkPattern)]

  return matches
    .map((match, index) => {
      const nextIndex = matches[index + 1]?.index ?? source.length
      const contextHtml = source.slice((match.index ?? 0) + match[0].length, nextIndex)
      const contextLines = htmlToLines(contextHtml)
      const sourceUrl = toAbsoluteUrl(match[1])
      const title = stripTags(match[2])
      const location = extractContextField(contextHtml, 'Location') || extractLabelValue(contextLines, 'Location')
      const company = extractContextField(contextHtml, 'Company') || extractLabelValue(contextLines, 'Company')

      if (!title || !sourceUrl || !location) return null
      if (hasMeaningfulValue(company) && normalizeCompanyKey(company) !== COMPANY_NAME) return null
      if (!/\bindia\b/i.test(location)) return null

      const { city, state, country } = splitLocation(location)

      return {
        title,
        location,
        city,
        state,
        country,
        sourceUrl,
      }
    })
    .filter(Boolean)
}

const extractApplyHref = (html = '') => {
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(linkPattern)) {
    const href = toAbsoluteUrl(match[1])
    const text = stripTags(match[2])

    if (/^apply now$/i.test(text)) {
      return href
    }
  }

  return null
}

export const extractJobDetail = (html = '', listing = {}) => {
  const lines = htmlToLines(html)
  const location = listing.location || extractLabelValue(lines, 'Location')
  const { city, state, country } = splitLocation(location)

  return {
    title: listing.title || lines[0] || null,
    location,
    city: listing.city || city,
    state: listing.state || state,
    country: listing.country || country,
    jobId: extractListingJobId(listing.sourceUrl),
    requisitionId: extractLabelValue(lines, 'Job ID'),
    sourceUrl: listing.sourceUrl || null,
    applyUrl: extractApplyHref(html),
    department: extractLabelValue(lines, 'Profession (Job Category)'),
    employmentType: normalizeEmploymentType(extractLabelValue(lines, 'Job Schedule')),
    experienceRequired: extractLabelValue(lines, 'Job Type (Experience Level)'),
    postingDate: normalizePostingDate(extractLabelValue(lines, 'Date Posted')),
    closingDate: null,
    jobDescription: normalizeWhitespace(
      extractSectionLines(lines, 'Job Description:', DESCRIPTION_STOP_LABELS).join(' '),
    ),
    minimumQualification: normalizeWhitespace(
      extractSectionLines(lines, 'Minimum Qualification:', QUALIFICATION_STOP_LABELS).join(' '),
    ),
    preferredQualification: normalizeWhitespace(
      extractSectionLines(lines, 'Preferred Qualification:', NULLISH_SECTION_LABELS).join(' '),
    ),
    requiredSkills: unique(
      extractSectionLines(lines, 'Skills Required:', SKILLS_STOP_LABELS)
        .map((value) => normalizeWhitespace(value)?.toLowerCase()),
    ),
  }
}

export const normalizeApplyUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return normalized
  }
}

export const resolveApplyUrl = async (
  applyUrl,
  {
    fetchImpl = defaultFetchImpl,
    fetchBrowserFinalUrl,
  } = {},
) => {
  const requestUrl = toAbsoluteUrl(applyUrl)
  if (!requestUrl) return null

  let redirectedUrl

  try {
    const response = await fetchImpl(requestUrl, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
    })

    if (!response?.ok) {
      throw new Error(`HTTP ${response?.status ?? 'unknown'} for ${requestUrl}`)
    }

    redirectedUrl = response.url
      || response.headers?.get?.('location')
      || requestUrl
  } catch (error) {
    if (!fetchBrowserFinalUrl || !isBrowserFallbackError(error)) {
      throw error
    }

    redirectedUrl = await fetchBrowserFinalUrl(requestUrl)
  }

  return normalizeApplyUrl(toAbsoluteUrl(redirectedUrl))
}

export const createHitachiIndiaScraper = ({
  fetchPage = defaultFetchPage,
  fetchText = defaultFetchText,
  fetchImpl = defaultFetchImpl,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  } = {}) => ({
  async run({
    fetchPage: overrideFetchPage,
    fetchText: overrideFetchText,
    fetchBrowserText,
    fetchBrowserFinalUrl,
    fetchImpl: overrideFetchImpl,
    maxJobs: overrideMaxJobs = maxJobs,
    now = () => new Date().toISOString(),
    useLegacySearchPage = false,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const fetchApplyImpl = overrideFetchImpl || fetchImpl
    const browserTextFetcher = typeof fetchBrowserText === 'function' ? fetchBrowserText : null
    const browserApplyUrlFetcher =
      typeof fetchBrowserFinalUrl === 'function' ? fetchBrowserFinalUrl : null

    const fetchPageText = async (url) => {
      try {
        return await fetchTextImpl(url)
      } catch (error) {
        if (!browserTextFetcher || !isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    const fetchPageImpl = overrideFetchPage
      || (overrideFetchText ? createFetchPageFromText(fetchPageText) : fetchPage)

    const fetchCurrentJobs = async () => {
      const currentJobs = await fetchHitachiParadoxJobs({
        brand: 'Hitachi India Pvt. Ltd',
        country: 'India',
        legalName: COMPANY_NAME,
        fetchText: fetchPageText,
      })
      return currentJobs
        .slice(0, overrideMaxJobs || currentJobs.length)
        .map((job) => normalizeHitachiParadoxJob(job, { company: COMPANY_NAME, source: SOURCE, now }))
    }
    if (!useLegacySearchPage) return fetchCurrentJobs()

    const listingPageUrl = buildSearchPageUrl()
    const listingPage = await fetchPageImpl(listingPageUrl)
    if (Number(listingPage?.status) === 404) return fetchCurrentJobs()
    if (isVerifiedCloudflareChallengedPage(listingPage, listingPageUrl)) {
      return []
    }
    if (Number(listingPage?.status || 0) >= 400) {
      throw new Error(`HTTP ${listingPage.status} for ${listingPageUrl}`)
    }

    const listingHtml = getPageHtml(listingPage)
    const listings = extractListings(listingHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchPageText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      const finalApplyUrl = detail.applyUrl
        ? await resolveApplyUrl(detail.applyUrl, {
            fetchImpl: fetchApplyImpl,
            fetchBrowserFinalUrl: browserApplyUrlFetcher || undefined,
          })
        : null

      jobs.push({
        ...detail,
        applyUrl: finalApplyUrl || detail.applyUrl,
        company: COMPANY_NAME,
        link: finalApplyUrl || detail.applyUrl || detail.sourceUrl,
        source: SOURCE,
        scrapedAt: now(),
      })

      if (overrideMaxJobs && jobs.length >= overrideMaxJobs) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createHitachiIndiaScraper().run(options)

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
