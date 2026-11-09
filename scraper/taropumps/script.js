import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'taropumps'
export const COMPANY = 'Taro Pumps'
export const CAREERS_URL = 'https://www.taropumps.com/careers'
export const VIEW_ALL_JOBS_URL = 'https://www.texmo.com/careers/'
export const TEXMO_CAREERS_URL = VIEW_ALL_JOBS_URL

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, '\'')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeDashWhitespace = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/[–—]/g, '-'),
)

const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/(div|section|article|li|p|h[1-6]|main|header|footer|a|span)>/gi, '\n')
  .replace(/<(br|hr)\b[^>]*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const extractVisibleLines = (html) => stripTags(html)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const isVerifiedDetailUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, TEXMO_CAREERS_URL)
  if (!absoluteUrl) return false

  try {
    const parsed = new URL(absoluteUrl)
    return parsed.hostname.toLowerCase() === 'www.texmo.com'
      && parsed.pathname === '/career-details'
      && Boolean(parsed.searchParams.get('id'))
  } catch {
    return false
  }
}

const extractJobId = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, TEXMO_CAREERS_URL)
  if (!absoluteUrl) return null

  try {
    return new URL(absoluteUrl).searchParams.get('id')
  } catch {
    return null
  }
}

const extractJobTitleFromDetailUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, TEXMO_CAREERS_URL)
  if (!absoluteUrl) return null

  try {
    const rawTitle = new URL(absoluteUrl).searchParams.get('title')
    return normalizeDashWhitespace(rawTitle)
  } catch {
    return null
  }
}

const buildLocation = ({ city, countryLabel }) => {
  const normalizedCity = normalizeWhitespace(city)
  const rawCountry = normalizeWhitespace(countryLabel) || 'INDIA'

  return {
    location: normalizedCity ? `${normalizedCity}, ${rawCountry}` : rawCountry,
    city: normalizedCity,
    country: /india/i.test(rawCountry) ? 'India' : rawCountry,
  }
}

const buildJobRecord = ({
  title,
  city,
  countryLabel = 'INDIA',
  department,
  detailUrl,
}) => {
  const jobId = extractJobId(detailUrl)
  if (!title || !department || !jobId) return null

  const location = buildLocation({
    city,
    countryLabel,
  })

  return {
    title,
    location: location.location,
    city: location.city,
    country: location.country,
    department,
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: null,
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: 'On-site',
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Careers at Taro Pumps/i.test(page)
    && /Apply here or email us at/i.test(page)
    && /Latest careers/i.test(page)
}

export const hasOfficialTexmoCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /Latest Careers/i.test(text)
    && /Why Work With Us/i.test(text)
    && /Taro Pumps/i.test(text)
    && /career-details\?id=/i.test(page)
}

export const extractViewAllJobsUrl = (html) => {
  const match = String(html ?? '').match(
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*View all jobs\s*<\/a>/i,
  )

  return match ? toAbsoluteUrl(match[1]) : null
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) return []

  const jobs = []
  const seenUrls = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']*career-details\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const detailUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (!isVerifiedDetailUrl(detailUrl) || seenUrls.has(detailUrl)) continue

    const lines = extractVisibleLines(match[2]).filter((line) => !/^new$/i.test(line))
    const title = lines[0]
    if (!title) continue

    const cityLine = lines[1] || null
    const hasExplicitCountry = /^india$/i.test(lines[2] || '')
    const countryLine = hasExplicitCountry ? lines[2] : null
    const department = hasExplicitCountry ? lines[3] || null : lines[2] || null
    const job = buildJobRecord({
      title,
      city: cityLine,
      countryLabel: countryLine,
      department,
      detailUrl,
    })

    if (!job) continue
    jobs.push(job)
    seenUrls.add(detailUrl)
  }

  return jobs
}

export const extractTexmoGroupJobCards = (html) => {
  if (!hasOfficialTexmoCareersSignal(html)) return []

  const jobs = []
  const seenUrls = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']*career-details\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const detailUrl = toAbsoluteUrl(match[1], TEXMO_CAREERS_URL)
    if (!isVerifiedDetailUrl(detailUrl) || seenUrls.has(detailUrl)) continue

    const title = extractJobTitleFromDetailUrl(detailUrl)
    const visibleText = normalizeDashWhitespace(extractVisibleLines(match[2]).join(' '))
    if (!title || !visibleText || !/\bIndia\b/i.test(visibleText)) continue

    const remainder = normalizeWhitespace(visibleText.replace(
      new RegExp(`^${escapeRegExp(title).replace(/-/g, '[-–—]')}\\s*`, 'i'),
      '',
    ))
    const detailsMatch = remainder?.match(/^(.*?)\s+India\s+(.+)$/i)
    if (!detailsMatch) continue

    const city = normalizeWhitespace(detailsMatch[1])
    const department = normalizeWhitespace(detailsMatch[2])
    const job = buildJobRecord({
      title,
      city,
      countryLabel: 'INDIA',
      department,
      detailUrl,
    })

    if (!job) continue
    jobs.push(job)
    seenUrls.add(detailUrl)
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'UND_ERR_CONNECT_TIMEOUT'
    || /\bconnect timeout\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

export const hasRecoverableBrandedCareersFailure = (error) => {
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return /\bHTTP\s+(500|502|503|504)\b/i.test(message)
}

export const createTaroPumpsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    createBrowserSession = async () => createBrowserFetchSession({
      userAgent: USER_AGENT,
      timeoutMs: 90000,
      settleTimeMs: 2000,
    }),
    now = () => new Date().toISOString(),
  } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserSession()
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchSurfaceHtml = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!hasConnectTimeoutFailure(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      let brandedCareersHtml = null

      try {
        brandedCareersHtml = await fetchSurfaceHtml(CAREERS_URL)
      } catch (error) {
        if (!hasConnectTimeoutFailure(error) && !hasRecoverableBrandedCareersFailure(error)) {
          throw error
        }
      }

      let jobs = []

      if (hasOfficialCareersSignal(brandedCareersHtml)) {
        const viewAllJobsUrl = extractViewAllJobsUrl(brandedCareersHtml)
        if (viewAllJobsUrl === VIEW_ALL_JOBS_URL) {
          jobs = extractJobCards(brandedCareersHtml)
        }
      }

      if (jobs.length === 0) {
        const texmoCareersHtml = await fetchSurfaceHtml(TEXMO_CAREERS_URL)
        if (!hasOfficialTexmoCareersSignal(texmoCareersHtml)) {
          throw new Error('Taro Pumps fallback Texmo careers page no longer matches the verified latest careers surface')
        }

        jobs = extractTexmoGroupJobCards(texmoCareersHtml)
      }

      if (jobs.length === 0) {
        throw new Error('Taro Pumps careers surfaces no longer expose parseable India roles for the verified Texmo group board')
      }

      return jobs.map((job) => ({
        ...job,
        company: COMPANY,
        link: job.applyUrl || job.sourceUrl,
        source: SOURCE,
        scrapedAt: now(),
      }))
    } catch (error) {
      if (hasConnectTimeoutFailure(error)) {
        return []
      }

      throw error
    } finally {
      if (browserSession) {
        await browserSession.close().catch(() => {})
      }
    }
  },
})

export const run = async (options = {}) => createTaroPumpsScraper().run(options)

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
