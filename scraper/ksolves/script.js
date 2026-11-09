import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { KSOLVES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = KSOLVES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ROLE_URLS = PROVIDER_METADATA.verifiedRoleUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toUniqueArray = (values) => [...new Set(values.filter(Boolean))]

const extractFirst = (html, pattern) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1])

const extractAttribute = (attributes, name) =>
  normalizeWhitespace(String(attributes ?? '').match(new RegExp(`${escapeRegExp(name)}="([^"]*)"`, 'i'))?.[1])

const toDisplayLocationPart = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(/\s+/)
    .map((part) => (/^[a-z]+$/.test(part) ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

const toIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parts = toUniqueArray(
    normalized
      .replace(/\s*&\s*/g, '/')
      .split(/[\/,]/)
      .map((part) => toDisplayLocationPart(part)),
  )

  const verifiedIndiaPlaces = /^(?:India|Noida|Indore|Pune|Chennai|Bengaluru|Bangalore|Hyderabad|Mumbai|Delhi|New Delhi|Gurugram|Gurgaon|Kolkata)$/i
  if (parts.length === 0 || parts.some((part) => !verifiedIndiaPlaces.test(part))) {
    throw new Error('Ksolves detail location cannot be verified within India')
  }
  return [...parts.filter((part) => !/^India$/i.test(part)), 'India'].join(', ')
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')?.[0] ?? null

const normalizeWorkMode = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null

  if (normalized === 'wfo' || normalized === 'on site' || normalized === 'onsite' || normalized === 'on-site') {
    return 'On-site'
  }

  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('wfh') || normalized.includes('work from home')) {
    return 'Remote'
  }

  return null
}

const extractMetaValue = (html = '', label = '') =>
  extractFirst(
    html,
    new RegExp(
      `<p[^>]*class=["'][^"']*ks-career-meta__label[^"']*["'][^>]*>\\s*${escapeRegExp(label)}\\s*<\\/p>\\s*<p[^>]*class=["'][^"']*ks-career-meta__value[^"']*["'][^>]*>([\\s\\S]*?)<\\/p>`,
      'i',
    ),
  )

const extractSectionBlock = (html = '', heading = '') => String(html ?? '').match(
  new RegExp(
    `<h2[^>]*class=["'][^"']*ks-career-section-heading[^"']*["'][^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h2>([\\s\\S]*?)(?=<h2[^>]*class=["'][^"']*ks-career-section-heading|<div[^>]*class=["'][^"']*ks-career-form-card|<\\/main>)`,
    'i',
  ),
)?.[1] ?? null

const extractBulletTexts = (sectionHtml = '') => {
  const cardTexts = [...String(sectionHtml ?? '').matchAll(
    /<p[^>]*class=["'][^"']*ks-career-bullet-list__text[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi,
  )]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  if (cardTexts.length > 0) return cardTexts

  const listTexts = [...String(sectionHtml ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  if (listTexts.length > 0) return listTexts

  const text = stripTags(sectionHtml)
  return text ? [text] : []
}

const extractListingExperience = (cardHtml = '') => {
  const tagsSection = String(cardHtml ?? '').match(
    /<div[^>]*class=["'][^"']*jobcard-tags[^"']*["'][^>]*>([\s\S]*?)$/i,
  )?.[1] ?? cardHtml

  const candidates = [...String(tagsSection ?? '').matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return candidates.find((candidate) => /\byears\b/i.test(candidate) || /mid-senior/i.test(candidate))
    || candidates.at(-1)
    || null
}

const extractRequiredSkills = (html = '') =>
  toUniqueArray([
    ...extractBulletTexts(extractSectionBlock(html, 'Required Skills')),
    ...extractBulletTexts(extractSectionBlock(html, 'Must-Have Skills')),
  ])

const extractJobDescription = (html = '') => {
  const lines = toUniqueArray([
    ...extractBulletTexts(extractSectionBlock(html, 'Job Overview')),
    ...extractBulletTexts(extractSectionBlock(html, 'Position Overview')),
    ...extractBulletTexts(extractSectionBlock(html, 'Role Overview')),
    ...extractBulletTexts(extractSectionBlock(html, 'Primary Responsibilities')),
    ...extractBulletTexts(extractSectionBlock(html, 'Roles and Responsibilities')),
    ...extractBulletTexts(extractSectionBlock(html, 'Key Responsibilities')),
  ])

  return lines.length > 0 ? lines.join('\n') : null
}

const createRequisitionId = (sourceUrl, title) => {
  try {
    const parsed = new URL(sourceUrl)
    const jobId = parsed.searchParams.get('jobid')
    if (jobId) return `${SOURCE}-${jobId}`
  } catch {
    // Fall through to the slug-based identifier.
  }

  const slug = slugify(title)
  return slug ? `${SOURCE}-${slug}` : null
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers\s*\|\s*Ksolves\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.ksolves\.com\/careers["']/i.test(page)
    && text.includes('Location')
    && text.includes('View and Apply Job')
    && text.includes('View Current Openings')
  }

export const extractListingCards = (html = '') => {
  const cards = [...String(html ?? '').matchAll(
    /<div[^>]+class=["'][^"']*\bjob-card-col\b[^"']*["']([^>]*)>([\s\S]*?)<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*\bjobcard-link\b[^"']*["'][^>]*>\s*View and Apply Job/gi,
  )]
    .map((match) => {
      const attributes = match[1]
      const cardHtml = match[2]

      return {
        title: extractFirst(
          cardHtml,
          /<h3[^>]*class=["'][^"']*\bjobcard-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i,
        ),
        sourceUrl: normalizeWhitespace(decodeHtml(match[3])),
        rawLocation: extractAttribute(attributes, 'data-location')?.toLowerCase() ?? null,
        experienceRequired: extractListingExperience(cardHtml),
        workMode: extractAttribute(attributes, 'data-jobtype')?.toLowerCase() ?? null,
      }
    })

  const expectedCardCount = [...String(html ?? '').matchAll(/<div\b[^>]*class=["']([^"']*)["'][^>]*>/gi)]
    .filter((match) => match[1].split(/\s+/).includes('job-card-col')).length
  if (cards.length !== expectedCardCount
    || cards.some((card) => !card.title || !card.sourceUrl || !card.rawLocation || !card.experienceRequired)
    || new Set(cards.map((card) => card.sourceUrl)).size !== cards.length) {
    throw new Error('Ksolves careers listing is incomplete: not every public job card was parsed')
  }
  for (const card of cards) {
    let url
    try { url = new URL(card.sourceUrl) } catch { /* Report the same first-party validation error below. */ }
    if (!url || url.protocol !== 'https:' || url.hostname !== 'www.ksolves.com'
      || url.pathname !== '/careers-form' || !/^\d+$/.test(url.searchParams.get('jobid') || '')) {
      throw new Error('Ksolves job card does not point to a verified first-party role URL')
    }
  }
  return cards
}

export const extractJobDetail = (html = '', listing = {}) => {
  const page = String(html ?? '')
  const title = extractFirst(
    page,
    /<h1[^>]*class=["'][^"']*\bks-career-job-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
  )
  const experienceRequired = extractMetaValue(page, 'Experience') || normalizeWhitespace(listing.experienceRequired)
  const rawLocation = extractMetaValue(page, 'Location') || normalizeWhitespace(listing.rawLocation)
  const location = toIndiaLocation(rawLocation)
  const remoteStatus = normalizeWorkMode(extractMetaValue(page, 'Work Mode') || listing.workMode)
  const jobDescription = extractJobDescription(page)
  const requiredSkills = extractRequiredSkills(page)
  const expectedTitle = normalizeWhitespace(listing.title)

  if (
    !title
    || !expectedTitle
    || title !== expectedTitle
    || !experienceRequired
    || !location
    || !/Apply for This Job/i.test(stripTags(page) || '')
  ) {
    throw new Error(`Ksolves detail page no longer matches the verified first-party role shell: ${listing.sourceUrl || 'unknown'}`)
  }

  return {
    title,
    location,
    city: extractCity(location),
    country: 'India',
    experienceRequired,
    remoteStatus,
    jobDescription,
    requiredSkills,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createKsolvesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Ksolves careers page no longer matches the verified first-party jobs surface')
    }

    const listings = extractListingCards(careersHtml)
    if (listings.length === 0) {
      throw new Error('Ksolves careers page no longer matches the verified first-party jobs surface')
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const scrapedAt = now()

    const jobs = []
    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      const requisitionId = createRequisitionId(listing.sourceUrl, detail.title)

      if (!requisitionId) {
        throw new Error(`Ksolves detail page no longer matches the verified first-party role shell: ${listing.sourceUrl}`)
      }

      jobs.push({
        title: detail.title,
        company: COMPANY,
        department: null,
        location: detail.location,
        city: detail.city,
        country: detail.country,
        jobId: requisitionId,
        requisitionId,
        sourceUrl: listing.sourceUrl,
        applyUrl: listing.sourceUrl,
        employmentType: null,
        experienceRequired: detail.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: detail.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: detail.remoteStatus,
        source: SOURCE,
        link: listing.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createKsolvesScraper().run(options)

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
