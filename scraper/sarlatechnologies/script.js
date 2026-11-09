import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SARLA_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_LANDING_PAGE_URL = PROVIDER_METADATA.verifiedCareerLandingPageUrl
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const NON_INDIA_LOCATION_PATTERN =
  /\b(uae|united arab emirates|dubai|abu dhabi|united states|usa|uk|united kingdom|singapore)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/header|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<(p|div|li|ul|ol|section|article|header|h[1-6]|span|strong)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => stripTags(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || null

const buildAbsoluteUrl = (value, baseUrl = CURRENT_OPENINGS_URL) => {
  const normalized = decodeHtml(value).trim()
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

export const looksLikeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  return !NON_INDIA_LOCATION_PATTERN.test(normalized)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (!looksLikeIndiaLocation(normalized)) return normalized
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractFieldValue = (html, label) => {
  const headingMatch = String(html ?? '').match(
    new RegExp(`<h[1-6][^>]*>\\s*${label}:?\\s*<\\/h[1-6]>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`, 'i'),
  )
  if (headingMatch?.[1]) return stripTags(headingMatch[1]) || null

  const match = String(html ?? '').match(new RegExp(`${label}:\\s*([\\s\\S]*?)<`, 'i'))
  return stripTags(match?.[1]) || null
}

const extractListItems = (html, heading) => {
  const match = String(html ?? '').match(
    new RegExp(`<h2[^>]*>\\s*${heading}\\s*<\\/h2>[\\s\\S]*?<ul[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'),
  )

  if (!match?.[1]) return []

  return Array.from(match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers at Sarla Technologies \| Explore Current Job Openings\s*<\/title>/i.test(page)
    && text.includes('Current Openings')
    && /https:\/\/sarlatech\.com\/job\/sicam-engineer-substation-automation\//i.test(page)
    && /https:\/\/sarlatech\.com\/job\/scms-engineer\//i.test(page)
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const title = extractTitle(page) || ''

  return /\s-\sSarla Technologies$/i.test(title)
    && text.includes('Qualification:')
    && text.includes('Experience:')
    && (text.includes('Base Location:') || text.includes('Job location:'))
}

export const extractListings = (html = '') => {
  if (!hasOfficialCurrentOpeningsSignal(html)) {
    throw new Error('Sarla Technologies verified current openings page no longer matches the trusted first-party surface')
  }

  const jobs = []
  const seen = new Set()

  const listingBlocks = [
    ...String(html ?? '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi),
    ...String(html ?? '').matchAll(/<div[^>]+class=["'][^"']*\bbusiness-box\b[^"']*["'][^>]*>([\s\S]*?<a[^>]+href=["'][^"']*\/job\/[^"']+["'][^>]*>\s*Apply Now\s*<\/a>[\s\S]*?)<\/div>\s*<\/div>/gi),
  ]

  for (const block of listingBlocks) {
    const article = block[1]
    const title = stripTags(article.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
    const minimumQualification = stripTags(article.match(/Qualification:\s*([^<]+)/i)?.[1])
    const experienceRequired = stripTags(article.match(/Experience:\s*([^<]+)/i)?.[1])
    const sourceUrl = buildAbsoluteUrl(article.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1])
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !minimumQualification || !experienceRequired || !sourceUrl || !jobId || seen.has(sourceUrl)) {
      continue
    }

    seen.add(sourceUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: null,
      city: null,
      country: null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length === 0) {
    throw new Error('Sarla Technologies verified current openings page no longer matches the trusted first-party surface')
  }

  return jobs
}

export const extractJobDetail = (html = '', listing = {}) => {
  if (!hasOfficialJobDetailSignal(html)) {
    throw new Error('Sarla Technologies verified first-party job detail page no longer matches the trusted surface')
  }

  const title = stripTags(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
    || stripTags((extractTitle(html) || '').replace(/\s*-\s*Sarla Technologies$/i, ''))
    || listing.title
    || null
  const minimumQualification = extractFieldValue(html, 'Qualification') || listing.minimumQualification || null
  const experienceRequired = extractFieldValue(html, 'Experience') || listing.experienceRequired || null
  const rawLocation = extractFieldValue(html, 'Base Location') || extractFieldValue(html, 'Job location') || null
  const location = normalizeLocation(rawLocation)
  const responsibilities = extractListItems(html, 'Job Role/Responsibilities')
  const requiredSkills = extractListItems(html, 'Requirement').concat(extractListItems(html, 'Skill sets'))
  const travel = extractFieldValue(html, 'Travel')
  const detailSections = []

  if (responsibilities.length > 0) {
    detailSections.push(`Job Role/Responsibilities: ${responsibilities.join(' | ')}`)
  }
  if (requiredSkills.length > 0) {
    detailSections.push(`Requirement: ${requiredSkills.join(' | ')}`)
  }
  if (travel) {
    detailSections.push(`Travel: ${travel}`)
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: deriveCity(location),
    country: location && looksLikeIndiaLocation(location) ? 'India' : null,
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: detailSections.join(' ') || null,
    remoteStatus: 'On-site',
  }
}

export const createSarlaTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const openingsHtml = await fetchText(CURRENT_OPENINGS_URL)
    const listings = extractListings(openingsHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      if (!detail.location || !looksLikeIndiaLocation(detail.location)) {
        continue
      }

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

export const run = async (options = {}) => createSarlaTechnologiesScraper().run(options)

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
