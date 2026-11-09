import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import EVENTUS_SECURITY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EVENTUS_SECURITY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CANONICAL_CAREERS_URL = PROVIDER_METADATA.canonicalCareerUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const NON_INDIA_LOCATION_PATTERN =
  /\b(uae|united arab emirates|dubai|abu dhabi|united states|usa|uk|united kingdom|singapore)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/:\s*/g, ': ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/aside|\/header|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<(p|div|li|ul|ol|section|article|aside|header|h[1-6]|span|strong)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = decodeHtml(value)
    .replace(/\s+/g, '')
    .trim()
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  if (!value) return null

  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts.at(-1) || null
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (NON_INDIA_LOCATION_PATTERN.test(normalized)) return false
  return true
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const cleanCityToken = (value) => normalizeWhitespace(value)
  .replace(/\boffice\b/gi, ' ')
  .replace(/\bon[- ]?site\b/gi, ' ')
  .replace(/\bhybrid\b/gi, ' ')
  .replace(/\bremote\b/gi, ' ')
  .replace(/\s*-\s*/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const deriveCity = (location) => {
  const tokens = String(location ?? '')
    .split(/[\/,]/)
    .map((token) => cleanCityToken(token))
    .filter(Boolean)

  return tokens.find((token) => !/^(india)$/i.test(token)) || null
}

const deriveRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location) || ''
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const buildJobDescription = (value) => stripTags(value) || null

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''

  return /eventus security/i.test(title)
    && /href=["']https:\/\/eventussecurity\.com\/careers\/["']/i.test(page)
    && /about us/i.test(page)
    && /contact us/i.test(page)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''

  return /^Cybersecurity Careers at Eventus - Join Our Mission$/i.test(title)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/eventussecurity\.com\/careers\/["']/i.test(page)
    && /Current Openings/i.test(page)
    && /Want to build the future in cyber security\? Join Our Team\./i.test(page)
    && /https:\/\/eventussecurity\.com\/careers\/strategic-account-manager\//i.test(page)
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''

  return / - Eventus Security$/i.test(title)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/eventussecurity\.com\/careers\/[^"']+\/["']/i.test(page)
    && />\s*Location\s*<\/div>/i.test(page)
    && />\s*Experience\s*<\/div>/i.test(page)
    && />\s*Job Description\s*<\/div>/i.test(page)
    && /Apply Now/i.test(page)
}

export const extractListings = (html) => {
  if (!hasOfficialCareersPageSignal(html)) {
    throw new Error('Eventus Security verified first-party careers surface changed; refusing to scrape')
  }

  const jobs = []
  const seen = new Set()

  const listingPattern = /<div[^>]*class=["'][^"']*\bct-div-block\b[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*\bct-text-block\b[^"']*["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>[\s\S]*?<div[^>]*class=["'][^"']*\bct-text-block\b[^"']*["'][^>]*>\s*Location:\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>[\s\S]*?<div[^>]*class=["'][^"']*\bct-text-block\b[^"']*["'][^>]*>\s*Experience:\s*(?:&nbsp;|\s)*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>[\s\S]*?<a[^>]+href=["']([^"']*\/careers\/[^"']+\/?)["'][^>]*>\s*Learn\s*More\s*<\/a>/gi

  for (const match of String(html ?? '').matchAll(listingPattern)) {
    const title = stripTags(match[1])
    const rawLocation = stripTags(match[2])
    const experienceRequired = stripTags(match[3])
    const sourceUrl = buildAbsoluteUrl(match[4], CAREERS_URL)
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !rawLocation || !sourceUrl || !jobId || seen.has(sourceUrl) || !isIndiaLocation(rawLocation)) {
      continue
    }

    const location = normalizeLocation(rawLocation)
    if (!location) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: deriveCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: experienceRequired || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: deriveRemoteStatus(location),
    })
  }

  if (jobs.length === 0) {
    throw new Error('Eventus Security verified first-party careers surface changed; refusing to scrape')
  }

  return jobs
}

const extractFieldValue = (html, label) => stripTags(
  String(html ?? '').match(
    new RegExp(`>\\s*${label}\\s*<\\/div>\\s*<div[^>]*class=["'][^"']*\\bcareer-side-details\\b[^"']*["'][^>]*>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i'),
  )?.[1],
)

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialJobDetailSignal(html)) {
    throw new Error('Eventus Security verified first-party job detail surface changed; refusing to scrape')
  }

  const page = String(html ?? '')
  const title = stripTags(page.match(/<h3\b[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/h3>/i)?.[1])
    || stripTags((extractTitle(page) || '').replace(/\s*-\s*Eventus Security$/i, ''))
    || listing.title
    || null
  const rawLocation = extractFieldValue(page, 'Location') || listing.location || null
  const location = normalizeLocation(rawLocation)
  const experienceRequired = extractFieldValue(page, 'Experience') || listing.experienceRequired || null
  const department = stripTags(
    page.match(/Department:\s*([^<]+)(?:<|$)/i)?.[1],
  ) || null
  const applyUrl = buildAbsoluteUrl(
    page.match(/<a[^>]*class=["'][^"']*\bcareer-modal-trigger\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/i)?.[1],
    listing.sourceUrl || CAREERS_URL,
  ) || listing.applyUrl || listing.sourceUrl || null
  const descriptionHtml = page.match(
    /<div[^>]*>\s*<span[^>]*class=["'][^"']*\boxy-stock-content-styles\b[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<\/div>\s*<a[^>]*class=["'][^"']*\bcareer-modal-trigger\b/i,
  )?.[1]
  const jobDescription = buildJobDescription(descriptionHtml)

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: deriveCity(location),
    country: 'India',
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    employmentType: listing.employmentType || null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: deriveRemoteStatus(location),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEventusSecurityScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Eventus Security verified homepage surface changed; refusing to scrape')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const listings = extractListings(careersHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createEventusSecurityScraper().run(options)

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
