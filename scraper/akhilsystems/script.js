import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import AKHIL_SYSTEMS_CATALOG from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeCareerModels } from './nativeJobs.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AKHIL_SYSTEMS_CATALOG.source
export const COMPANY = AKHIL_SYSTEMS_CATALOG.companyName
export const VERIFIED_AT = AKHIL_SYSTEMS_CATALOG.verifiedOn
export const HOMEPAGE_URL = AKHIL_SYSTEMS_CATALOG.officialHomepageUrl
export const CAREERS_ALIAS_URL = AKHIL_SYSTEMS_CATALOG.officialHomepageCareerUrl
export const CAREERS_URL = AKHIL_SYSTEMS_CATALOG.canonicalCareersUrl
export const ACCEPTED_CAREERS_URLS = [...new Set([
  CAREERS_ALIAS_URL.replace(/\/$/, ''),
  CAREERS_ALIAS_URL,
  CAREERS_URL.replace(/\/$/, ''),
  CAREERS_URL,
])]

const ACCEPTED_HOMEPAGE_URLS = [
  HOMEPAGE_URL.replace(/\/$/, ''),
  HOMEPAGE_URL,
]

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
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

const extractTitle = (html = '') =>
  stripTags(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
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
    headers: BROWSER_HEADERS,
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
  const text = stripTags(page) || ''

  return /^(?:Healthcare Software Solutions\s*\|\s*Hospital Information System\s*\|\s*Akhil Systems|India's Leading Hospital Management Software - Akhil Systems)$/i.test(extractTitle(page) || '')
    && text.includes('Akhil Systems Pvt. Ltd.')
    && /Hospital (?:Management )?Information Systems?/i.test(text)
    && /\bCareer\b/i.test(text)
}

export const extractHomepageCareerUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1]
    const label = stripTags(match[2])
    if (label !== 'Career') continue

    return toAbsoluteUrl(href, HOMEPAGE_URL)
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const title = extractTitle(page)
  const canonical = page.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]

  return title === 'Careers at Akhil Systems - Join Our Healthcare Mission'
    && (!canonical || isAcceptedCareersUrl(canonical))
    && text.includes('Join our mission to transform healthcare through innovation and technology.')
    && text.includes('Filter on Jobs')
    && /class=["'][^"']*\bbox-career-show\b[^"']*["']/i.test(page)
}

export const extractCareerListings = (html) => {
  html = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /Designation:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?Job Location:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?Experience Level:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?No\.\s*of Opening:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/gi,
  )) {
    const title = stripTags(match[1])
    const location = stripTags(match[2])
    const experienceRequired = stripTags(match[3])
    const openings = stripTags(match[4])

    if (!title || !location || !experienceRequired || !openings) continue

    jobs.push({
      title,
      location,
      experienceRequired,
      openings,
    })
  }

  return jobs
}

const normalizeIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  if (/\bIndia\b/i.test(location)) return location
  return `${location}, India`
}

const deriveCity = (location) => {
  const normalizedLocation = normalizeIndiaLocation(location)
  const scopedCity = getValidIndiaCityForJob({
    country: 'India',
    location: normalizedLocation,
  })
  if (scopedCity) return scopedCity

  const baseCity = normalizeWhitespace(location)?.split(',')[0]?.trim()
  return normalizeCity(baseCity || normalizedLocation)
}

const inferRemoteStatus = (location) => {
  const normalizedLocation = normalizeWhitespace(location)?.toLowerCase() || ''
  if (normalizedLocation.includes('remote')) return 'Remote'
  if (normalizedLocation.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const normalizeListing = (listing, { now }) => {
  const title = normalizeWhitespace(listing?.title)
  const rawLocation = normalizeWhitespace(listing?.location)
  const location = normalizeIndiaLocation(rawLocation)
  const jobId = slugify(`${title}-${rawLocation}`)

  if (!title || !rawLocation || !location || !jobId) {
    return null
  }

  return {
    title,
    company: COMPANY,
    location,
    city: deriveCity(rawLocation),
    country: 'India',
    link: CAREERS_URL,
    applyUrl: CAREERS_URL,
    sourceUrl: CAREERS_URL,
    source: SOURCE,
    jobId,
    requisitionId: jobId,
    department: null,
    employmentType: null,
    experienceRequired: normalizeWhitespace(listing?.experienceRequired),
    jobDescription: listing?.jobDescription || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: inferRemoteStatus(rawLocation),
    scrapedAt: now(),
  }
}

export const createAkhilSystemsScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    now = defaultNow,
  } = {}) {
    const fetchApiOnlyPage = async (url) => {
      try {
        return await fetchPage(url)
      } catch (error) {
        throw new Error(`Akhil Systems API-only migration could not fetch ${url}: ${error.message}`)
      }
    }

    const homepage = await fetchApiOnlyPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !isAcceptedHomepageUrl(homepage.url)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Akhil Systems verified official homepage no longer matches the trusted first-party surface')
    }

    const homepageCareerUrl = extractHomepageCareerUrl(homepage.html)
    if (!isAcceptedCareersUrl(homepageCareerUrl)) {
      throw new Error('Akhil Systems verified homepage Career navigation changed materially')
    }

    const careersPage = await fetchApiOnlyPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !isAcceptedCareersUrl(careersPage.url)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Akhil Systems verified official careers surface changed materially')
    }

    const nativeModels = await readNativeCareerModels(careersPage.html, { baseUrl: CAREERS_URL, fetchPage: fetchApiOnlyPage })
    const listings = extractCareerListings(careersPage.html)
    if (nativeModels && (nativeModels.length !== listings.length || nativeModels.some(model => !listings.some(listing => listing.title === model.title && listing.location === model.location)))) {
      throw new Error('Akhil Systems native model and rendered listings disagree')
    }
    const seenJobIds = new Set()
    const jobs = (nativeModels || listings)
      .map((listing) => normalizeListing(listing, { now }))
      .filter((job) => job && !seenJobIds.has(job.jobId) && seenJobIds.add(job.jobId))

    if (jobs.length === 0) {
      throw new Error('Akhil Systems verified careers page no longer exposes trusted first-party job cards')
    }

    if (!nativeModels) return jobs
    return attachInventoryEvidence(jobs, { status: 'complete-inventory', surface: CAREERS_URL,
      firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: nativeModels.length,
      indiaFacetCount: jobs.length, verifiedAt: now(), reason: 'current-rendered-cards-reconciled-with-complete-static-native-client-models' })
  },
})

export const run = async (options = {}) => createAkhilSystemsScraper(options).run(options)

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
