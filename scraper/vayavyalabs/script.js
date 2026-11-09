import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vayavyalabs'
export const COMPANY = 'Vayavya Labs'
export const HOMEPAGE_URL = 'https://vayavyalabs.com/'
export const CAREERS_URL = 'https://vayavyalabs.com/careers/'

const COMPANY_DOMAIN = 'vayavyalabs.com'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CATEGORY_TO_DEPARTMENT = {
  'agentic-ai': 'Agentic AI',
  'career-automotive': 'Automotive',
  'career-communications-connectivity': 'Communications & Connectivity',
  'eda-semiconductors': 'EDA & Semiconductors',
  'non-technical': 'Non-Technical',
}

const CITY_METADATA = {
  belagavi: { city: 'Belagavi', state: 'Karnataka' },
  bengaluru: { city: 'Bengaluru', state: 'Karnataka' },
  bangalore: { city: 'Bengaluru', state: 'Karnataka' },
}

const repairMojibake = (value) => {
  const normalized = String(value ?? '')
  if (!/[ÃÂâ]/.test(normalized)) return normalized

  try {
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8')
    return repaired.includes('\uFFFD') ? normalized : repaired
  } catch {
    return normalized
  }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/[\s\S]*/, (match) => repairMojibake(match))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00c2/g, '')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const dedupe = (values) => {
  const seen = new Set()
  const output = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || seen.has(normalized.toLowerCase())) continue
    seen.add(normalized.toLowerCase())
    output.push(normalized)
  }

  return output
}

const normalizeDepartment = (classNames = '') => {
  const normalized = String(classNames ?? '')
    .split(/\s+/)
    .map((value) => value.trim().toLowerCase())
    .find((value) => CATEGORY_TO_DEPARTMENT[value])

  return normalized ? CATEGORY_TO_DEPARTMENT[normalized] : null
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i)
  if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]} Years`

  const plusMatch = normalized.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/i)
  if (plusMatch) return `${plusMatch[1]} Years`

  return normalized
}

const normalizeMailtoUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || !normalized.toLowerCase().startsWith('mailto:')) return null

  const email = normalized.match(/^mailto:([^?]+)/i)?.[1]
  if (!email) return null

  const subject = normalized.match(/[?&]subject=([^&]+)/i)?.[1]
  return subject
    ? `mailto:${email}?subject=${subject}`
    : `mailto:${email}`
}

const extractPublishedDate = (html) => {
  const match = String(html ?? '').match(/article:published_time" content="(\d{4}-\d{2}-\d{2})T/i)
  return match?.[1] || null
}

const extractLabeledField = (html, label) => {
  const pattern = new RegExp(`<strong>${label}:<\\/strong>\\s*([\\s\\S]*?)(?:<\\/p>|<br\\s*\\/?>)`, 'i')
  return stripTags(String(html ?? '').match(pattern)?.[1])
}

const extractListItems = (html) => Array.from(
  String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi),
  (match) => stripTags(match[1]),
).filter(Boolean)

const getLocationMetadata = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: 'India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  const rawSegments = normalized
    .split('/')
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)

  const uniqueCities = dedupe(rawSegments
    .map((segment) => segment.split(',')[0]?.trim())
    .map((segment) => {
      const normalizedCity = normalizeCity(segment)
      const metadata = normalizedCity ? CITY_METADATA[normalizedCity.toLowerCase()] : null
      return metadata?.city || normalizedCity
    }))

  const stateCandidates = dedupe(rawSegments.flatMap((segment) => {
    const values = []
    if (/karnataka/i.test(segment)) values.push('Karnataka')
    const firstSegment = segment.split(',')[0]?.trim()
    const normalizedCity = normalizeCity(firstSegment)
    const metadata = normalizedCity ? CITY_METADATA[normalizedCity.toLowerCase()] : null
    if (metadata?.state) values.push(metadata.state)
    return values
  }))

  const state = stateCandidates.length === 1 ? stateCandidates[0] : null
  const city = uniqueCities.length === 1 ? uniqueCities[0] : null
  const locationParts = []

  if (uniqueCities.length > 0) {
    locationParts.push(uniqueCities.join(' / '))
  } else if (normalized) {
    locationParts.push(normalized)
  }

  if (state && !locationParts.some((item) => item.toLowerCase().includes(state.toLowerCase()))) {
    locationParts.push(state)
  }

  if (!locationParts.some((item) => /india/i.test(item))) {
    locationParts.push('India')
  }

  return {
    location: locationParts.join(', '),
    city,
    state,
    country: 'India',
  }
}

const extractPrimaryDetailContent = (html) => {
  const match = String(html ?? '').match(
    /elementor-widget-text-editor[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>\s*<\/div>[\s\S]*?elementor-widget-button/i,
  )

  return match?.[1] || null
}

const extractExperienceFromBody = (contentText) => {
  const normalized = normalizeWhitespace(contentText)
  if (!normalized) return null

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i)
    || normalized.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/i)

  return match ? normalizeExperience(match[0]) : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Home\s*-\s*Vayavya Labs Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/vayavyalabs\.com\/"\s*\/?>/i.test(page)
    && /Vayavya Labs Pvt\. Ltd\./i.test(page)
    && /href="https:\/\/vayavyalabs\.com\/careers\/"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Vayavya Labs Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/vayavyalabs\.com\/careers\/"\s*\/?>/i.test(page)
    && /Current Openings/i.test(page)
    && /href="https:\/\/vayavyalabs\.com\/current_opening\//i.test(page)
    && /Vayavya Labs Pvt\. Ltd\./i.test(page)
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Vayavya Labs verified careers page no longer matches the trusted first-party surface')
  }

  const cards = Array.from(
    String(html ?? '').matchAll(
      /<div class="premium-blog-post-outer-container ([^"]*\bcurrent-openings\b[^"]*)"[\s\S]*?<a href="([^"]+)" target="_self"[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?<p class="premium-blog-post-content">([\s\S]*?)<\/p>/gi,
    ),
    (match) => {
      const sourceUrl = toAbsoluteUrl(match[2], CAREERS_URL)
      const title = stripTags(match[3])
      const summary = stripTags(match[4])

      if (!sourceUrl || !title || !summary) return null

      return {
        title,
        sourceUrl,
        department: normalizeDepartment(match[1]),
        summary,
      }
    },
  ).filter(Boolean)

  if (cards.length === 0) {
    throw new Error('Vayavya Labs careers page no longer exposes first-party current opening cards')
  }

  return Array.from(
    new Map(cards.map((card) => [card.sourceUrl, card])).values(),
  )
}

export const extractJobDetail = (card, html) => {
  const page = String(html ?? '')
  if (!/Vayavya Labs Pvt\. Ltd\./i.test(page)) {
    throw new Error(`Vayavya Labs detail page no longer verifies the exact first-party company identity for ${card.sourceUrl}`)
  }

  const canonicalUrl = toAbsoluteUrl(
    page.match(/<link rel="canonical" href="([^"]+)"/i)?.[1],
    card.sourceUrl,
  )
  if (canonicalUrl && canonicalUrl !== card.sourceUrl) {
    throw new Error(`Vayavya Labs detail page canonical changed for ${card.sourceUrl}`)
  }

  const contentHtml = extractPrimaryDetailContent(page)
  if (!contentHtml) {
    throw new Error(`Vayavya Labs detail page no longer exposes the verified primary job content block for ${card.sourceUrl}`)
  }

  const title = stripTags(page.match(/<h2 style="padding-top:15px;">([\s\S]*?)<\/h2>/i)?.[1]) || card.title
  const locationValue = extractLabeledField(contentHtml, 'Location')
  const locationMeta = getLocationMetadata(locationValue)
  const minimumQualification = extractLabeledField(contentHtml, 'Education Requirement')
  const experienceRequired = normalizeExperience(extractLabeledField(contentHtml, 'Experience'))
    || extractExperienceFromBody(stripTags(contentHtml))
  const applyUrl = normalizeMailtoUrl(
    page.match(/<a class="elementor-button[^"]*" href="([^"]+)"/i)?.[1],
  )
  const requiredSkills = extractListItems(contentHtml)
  const requisitionId = slugify(new URL(card.sourceUrl).pathname.split('/').filter(Boolean).pop())
  const jobDescription = stripTags(contentHtml)

  if (!title || !requisitionId || !jobDescription) {
    throw new Error(`Vayavya Labs detail page no longer exposes stable job metadata for ${card.sourceUrl}`)
  }

  return {
    title,
    company: COMPANY,
    department: card.department,
    location: locationMeta.location,
    city: locationMeta.city,
    state: locationMeta.state,
    country: locationMeta.country,
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId,
    sourceUrl: card.sourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: extractPublishedDate(page),
    closingDate: null,
    jobDescription,
    remoteStatus: 'On-site',
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createVayavyaLabsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Vayavya Labs verified homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const cards = extractJobCards(careersHtml)

    const jobs = await Promise.all(cards.map(async (card) => {
      const detailHtml = await fetchText(card.sourceUrl)
      const detail = extractJobDetail(card, detailHtml)

      return {
        ...detail,
        source: SOURCE,
        link: detail.sourceUrl,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        scrapedAt: now(),
      }
    }))

    if (jobs.length === 0) {
      throw new Error('Vayavya Labs verified first-party careers surface returned no public jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createVayavyaLabsScraper().run(options)

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
