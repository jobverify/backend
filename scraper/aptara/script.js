import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { APTARA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = APTARA_CATALOG.source
export const COMPANY = APTARA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = APTARA_CATALOG.officialBrandName
export const VERIFIED_ON = APTARA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = APTARA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = APTARA_CATALOG
export const HOMEPAGE_URL = APTARA_CATALOG.homepageUrl
export const CAREERS_URL = APTARA_CATALOG.companyCareerPage
export const APPLY_ANCHOR_URL = APTARA_CATALOG.applyAnchorUrl

const ACCEPTED_HOMEPAGE_URLS = [
  HOMEPAGE_URL,
  HOMEPAGE_URL.replace(/\/$/, ''),
]

const ACCEPTED_CAREERS_URLS = [
  CAREERS_URL,
  CAREERS_URL.replace(/\/$/, ''),
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const isAcceptedHomepageUrl = (value) =>
  ACCEPTED_HOMEPAGE_URLS.some((candidate) => sameUrl(value, candidate))

const isAcceptedCareersUrl = (value) =>
  ACCEPTED_CAREERS_URLS.some((candidate) => sameUrl(value, candidate))

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
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
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Digital Content Transformation\s*&amp;\s*AI Learning Solutions\s*<\/title>/i.test(page)
    && /Aptara Corp Logo/i.test(page)
    && /href=["']https:\/\/www\.aptaracorp\.com\/careers\/["']/i.test(page)
    && /CAREERS/i.test(page)
}

export const extractHomepageCareerUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    const label = stripTags(match[2])

    if (label?.toUpperCase() === 'CAREERS' && href) {
      return href
    }
  }

  const fallback = String(html ?? '').match(/href=["'](https:\/\/www\.aptaracorp\.com\/careers\/)["']/i)?.[1]
  return normalizeWhitespace(fallback)
}

const getOpeningsSection = (html) => String(html ?? '').match(
  /<h2\b[^>]*>\s*Latest Job\s*<\/h2>([\s\S]*?)<(?:section|div)\b[^>]*id=["']applynow["']/i,
)?.[1] || null

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers:\s*Build Your Future in Digital Transformation\s*<\/title>/i.test(page)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.aptaracorp\.com\/careers\/["']/i.test(page)
    && /<h1\b[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /<h2\b[^>]*>\s*Latest Job\s*<\/h2>/i.test(page)
    && /Submit Your Resume/i.test(page)
    && /File Upload/i.test(page)
    && /href=["']#applynow["']/i.test(page)
    && getOpeningsSection(page) !== null
}

const normalizeIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  if (/\bIndia\b/i.test(location)) return location
  return `${location}, India`
}

const deriveCity = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  const scopedCity = getValidIndiaCityForJob({
    location: normalizedLocation,
  })

  if (scopedCity) return scopedCity

  const baseCity = normalizeWhitespace(location)?.split(',')[0]?.trim()
  return normalizeCity(baseCity || normalizedLocation)
}

export const isIndiaListing = (location) => Boolean(
  getValidIndiaCityForJob({
    location: normalizeWhitespace(location),
  }),
)

const parseEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'contract') return 'Contract'
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized === 'internship') return 'Internship'
  return normalizeWhitespace(value)
}

const parseRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return 'On-site'
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'on-site' || normalized === 'onsite') return 'On-site'
  return 'On-site'
}

const extractTitleMetadata = (value) => {
  let title = normalizeWhitespace(value)
  let remoteStatus = 'On-site'
  let employmentType = null

  if (!title) {
    return { title: null, remoteStatus, employmentType }
  }

  const employmentMatch = title.match(/^(.*?)(?:\s*-\s*(Contract|Full(?:-|\s)time|Part(?:-|\s)time|Internship))$/i)
  if (employmentMatch) {
    title = normalizeWhitespace(employmentMatch[1])
    employmentType = parseEmploymentType(employmentMatch[2])
  }

  const modeSuffixMatch = title.match(/^(.*?)(?:\s*-\s*(Remote|Hybrid|On-site))$/i)
  if (modeSuffixMatch) {
    title = normalizeWhitespace(modeSuffixMatch[1])
    remoteStatus = parseRemoteStatus(modeSuffixMatch[2])
  } else {
    const modeParenMatch = title.match(/^(.*?)\s*\((Remote|Hybrid|On-site)\)$/i)
    if (modeParenMatch) {
      title = normalizeWhitespace(modeParenMatch[1])
      remoteStatus = parseRemoteStatus(modeParenMatch[2])
    }
  }

  return {
    title,
    remoteStatus,
    employmentType,
  }
}

const CARD_PATTERN =
  /<h3\b[^>]*class=["'][^"']*fusion-title-heading[^"']*["'][^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div\b[^>]*class=["'][^"']*fusion-li-item-content[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/gi

export const extractCareerListings = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('Aptara verified official careers surface changed materially')
  }

  const openingsSection = getOpeningsSection(html)
  if (!openingsSection) {
    throw new Error('Aptara verified official careers surface changed materially')
  }

  const jobs = []
  const seenJobIds = new Set()

  for (const match of openingsSection.matchAll(CARD_PATTERN)) {
    const titleMetadata = extractTitleMetadata(stripTags(match[1]))
    const rawLocation = stripTags(match[2])
    const applyUrl = toAbsoluteUrl(match[3], CAREERS_URL)
    const city = rawLocation
      ? getValidIndiaCityForJob({
        location: normalizeWhitespace(rawLocation),
      })
      : null

    if (!titleMetadata.title || !rawLocation || applyUrl !== APPLY_ANCHOR_URL || !city) {
      continue
    }

    const location = normalizeIndiaLocation(rawLocation)
    const identity = slugify(`${titleMetadata.title}-${location}`)
    if (!location || !identity || seenJobIds.has(identity)) {
      continue
    }

    seenJobIds.add(identity)
    jobs.push({
      title: titleMetadata.title,
      company: COMPANY,
      department: null,
      location,
      city: deriveCity(rawLocation),
      state: null,
      country: 'India',
      jobId: `${SOURCE}-${identity}`,
      requisitionId: `${SOURCE}-${identity}`,
      sourceUrl: CAREERS_URL,
      applyUrl: APPLY_ANCHOR_URL,
      employmentType: titleMetadata.employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: titleMetadata.remoteStatus,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Aptara verified careers page no longer exposes trusted first-party India role cards')
  }

  return jobs
}

export const createAptaraScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    now = defaultNow,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !isAcceptedHomepageUrl(homepage.url)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Aptara verified official homepage no longer matches the trusted first-party surface')
    }

    const homepageCareerUrl = extractHomepageCareerUrl(homepage.html)
    if (!isAcceptedCareersUrl(homepageCareerUrl)) {
      throw new Error('Aptara verified homepage careers navigation changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !isAcceptedCareersUrl(careersPage.url)
      || !hasOfficialCareersSurface(careersPage.html)
    ) {
      throw new Error('Aptara verified official careers surface changed materially')
    }

    return extractCareerListings(careersPage.html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAptaraScraper(options).run(options)

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
