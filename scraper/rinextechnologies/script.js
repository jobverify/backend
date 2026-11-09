import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'rinextechnologies'
export const COMPANY = 'Rinex Technologies'
export const HOMEPAGE_URL = 'https://rinex.ai/'
export const CAREER_URL = 'https://rinex.ai/career'
export const SITE_ORIGIN = 'https://rinex.ai'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeText = (value) => String(value ?? '')
  .replace(/\\\\x([0-9a-f]{2})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\\\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeText(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeText(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = SITE_ORIGIN) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const buildJobId = (title) => (normalizeWhitespace(title) || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeLocationText = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/[·•]/g, '/')
    .replace(/\s*\/\s*/g, ' / ')
}

const deriveState = (locationText) => {
  const normalized = normalizeLocationText(locationText)?.toLowerCase() || ''
  if (!normalized) return null

  const karnatakaCities = ['bengaluru', 'bangalore', 'mangaluru', 'mangalore']
  const locationParts = normalized
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (locationParts.length > 0 && locationParts.every((part) => karnatakaCities.some((city) => part.includes(city)))) {
    return 'Karnataka'
  }

  return null
}

const deriveCity = (locationText) => {
  const normalized = normalizeLocationText(locationText)
  if (!normalized || normalized.includes('/')) return null

  return normalized
}

const buildLocation = (locationText) => {
  const normalized = normalizeLocationText(locationText)
  const state = deriveState(normalized)

  if (!normalized) return state ? `${state}, India` : 'India'

  let location = normalized
  if (state && !new RegExp(`\\b${escapeRegex(state)}\\b`, 'i').test(location)) {
    location = `${location}, ${state}`
  }
  if (!/,\s*India$/i.test(location)) {
    location = `${location}, India`
  }

  return location
}

const extractParagraphs = (html) => [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSectionParagraphs = (html, heading, nextHeadings = []) => {
  const nextPattern = nextHeadings.map((value) => escapeRegex(value)).join('|')
  const boundary = nextPattern
    ? `(?=<h[1-6][^>]*>\\s*(?:${nextPattern})\\s*<\\/h[1-6]>|Rinex Technologies Private Limited|<\\/footer>|$)`
    : '(?=Rinex Technologies Private Limited|</footer>|$)'
  const sectionPattern = new RegExp(
    `<h[1-6][^>]*>\\s*${escapeRegex(heading)}\\s*<\\/h[1-6]>([\\s\\S]*?)${boundary}`,
    'i',
  )
  const sectionHtml = sectionPattern.exec(String(html ?? ''))?.[1] ?? ''

  return extractParagraphs(sectionHtml)
}

const buildJobDescription = ({
  overview,
  opportunity,
  responsibilities,
  requirements,
} = {}) => {
  const sections = [
    overview ? `Overview: ${overview}` : null,
    opportunity.length > 0 ? `Opportunity: ${opportunity.join(' ')}` : null,
    responsibilities.length > 0 ? `Responsibilities: ${responsibilities.join(' ')}` : null,
    requirements.length > 0 ? `Requirements: ${requirements.join(' ')}` : null,
  ].filter(Boolean)

  return normalizeWhitespace(sections.join(' '))
}

export const extractMainBundleUrl = (html) => {
  const match = String(html ?? '').match(/<script[^>]+src="([^"]*\/static\/js\/main\.[^"]+\.js)"/i)
  return toAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialHomepageShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Rinex Education\s*<\/title>/i.test(page)
    && /<div id="root"><\/div>/i.test(page)
    && /wa\.me\/\+917892745201\?text=Hello/i.test(page)
    && /\/static\/js\/main\.[a-f0-9]+\.js/i.test(page)
}

export const hasOfficialJobsBundleSignal = (bundleText) => {
  const bundle = String(bundleText ?? '')
  const normalized = normalizeWhitespace(bundle) || ''

  return normalized.includes('Rinex Technologies Private Limited')
    && normalized.includes('help@rinex.ai')
    && /\/job\/:jobrole/i.test(bundle)
    && /"role":"ROLE\s*\d+","jobTitle":"[^"]+","jobLocation":"[^"]+","immediateChip":"[^"]+"/i.test(bundle)
}

export const extractBundleRoles = (bundleText) => {
  if (!hasOfficialJobsBundleSignal(bundleText)) {
    throw new Error('verified Rinex Technologies jobs bundle no longer matches the trusted first-party surface')
  }

  const roles = []
  const seen = new Set()

  for (const match of String(bundleText ?? '').matchAll(
    /"role":"ROLE\s*\d+","jobTitle":"([^"]+)","jobLocation":"([^"]+)","immediateChip":"[^"]+"/g,
  )) {
    const title = normalizeWhitespace(match[1])
    if (!title) continue

    const dedupeKey = title.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const locationText = normalizeLocationText(match[2])

    roles.push({
      title,
      locationText,
      jobId: buildJobId(title),
      requisitionId: buildJobId(title),
      sourceUrl: buildJobUrl(title),
    })
  }

  if (roles.length === 0) {
    throw new Error('verified Rinex Technologies jobs bundle no longer exposes public same-domain openings')
  }

  return roles
}

export const buildJobUrl = (title) => `${SITE_ORIGIN}/job/${encodeURIComponent(normalizeWhitespace(title) || '')}`

export const hasOfficialJobDetailSignal = (html, listing = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const title = normalizeWhitespace(listing.title)
  const titlePattern = title
    ? new RegExp(`<h[1-6][^>]*>\\s*${escapeRegex(title)}\\s*<\\/h[1-6]>`, 'i')
    : /<h[1-6][^>]*>[\s\S]+?<\/h[1-6]>/i

  return titlePattern.test(page)
    && normalized.includes('Rinex Technologies Private Limited')
    && /Apply for this Role/i.test(page)
    && /<a[^>]+href="https?:\/\/[^"]+"[^>]*>\s*Apply for this Role\s*<\/a>/i.test(page)
    && /LOCATION/i.test(page)
}

export const isJavaScriptOnlyShell = (html) =>
  /You need to enable JavaScript to run this app\./i.test(normalizeWhitespace(html) || '')

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialJobDetailSignal(html, listing)) {
    throw new Error('verified Rinex Technologies job detail no longer matches the trusted first-party application surface')
  }

  const page = String(html ?? '')
  const title = stripTags(page.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]) || listing.title || null
  const locationText = stripTags(
    page.match(/<p\b[^>]*>\s*LOCATION\s*<\/p>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1],
  ) || listing.locationText || null
  const applyUrl = toAbsoluteUrl(
    page.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Apply for this Role\s*<\/a>/i)?.[1],
    listing.sourceUrl || SITE_ORIGIN,
  )
  const overview = stripTags(
    page.match(/Apply for this Role\s*<\/a>\s*<\/[^>]+>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1],
  )
  const opportunity = extractSectionParagraphs(page, 'Your opportunity', [
    "What you'll be doing",
    "What you'll bring",
    'Do you think we are a match?',
    'More job openings',
  ])
  const responsibilities = extractSectionParagraphs(page, "What you'll be doing", [
    "What you'll bring",
    'Do you think we are a match?',
    'More job openings',
  ])
  const requirements = extractSectionParagraphs(page, "What you'll bring", [
    'Do you think we are a match?',
    'More job openings',
  ])
  const location = buildLocation(locationText)
  const jobId = listing.jobId || buildJobId(title)

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: deriveCity(locationText),
    state: deriveState(locationText),
    country: 'India',
    jobId,
    requisitionId: listing.requisitionId || jobId,
    sourceUrl: listing.sourceUrl || buildJobUrl(title),
    applyUrl,
    employmentType: null,
    experienceRequired: normalizeWhitespace(
      buildJobDescription({ overview, opportunity, responsibilities, requirements })
        .match(/\b\d+\+?\s*years?\b/i)?.[0],
    ),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      overview,
      opportunity,
      responsibilities,
      requirements,
    }),
    remoteStatus: /remote|hybrid|work from home/i.test(location) ? 'Remote' : 'On-site',
  }
}

export const buildListingFallbackJob = (listing = {}) => {
  const title = normalizeWhitespace(listing.title)
  const location = buildLocation(listing.locationText)
  const jobId = listing.jobId || buildJobId(title)

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: deriveCity(listing.locationText),
    state: deriveState(listing.locationText),
    country: 'India',
    jobId,
    requisitionId: listing.requisitionId || jobId,
    sourceUrl: listing.sourceUrl || buildJobUrl(title),
    applyUrl: listing.sourceUrl || buildJobUrl(title),
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply via the Rinex Technologies job page.',
    remoteStatus: /remote|hybrid|work from home/i.test(location) ? 'Remote' : 'On-site',
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/javascript,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createRinexTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    maxJobs = null,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageShellSignal(homepageHtml)) {
      throw new Error('Rinex Technologies verified homepage shell no longer matches the trusted first-party surface')
    }

    const bundleUrl = extractMainBundleUrl(homepageHtml)
    if (!bundleUrl) {
      throw new Error('Rinex Technologies verified homepage shell no longer exposes the trusted main jobs bundle')
    }

    const bundleText = await fetchText(bundleUrl)
    const listings = extractBundleRoles(bundleText)
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0 ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      let detailHtml = await fetchText(listing.sourceUrl)
      let detail

      if (!hasOfficialJobDetailSignal(detailHtml, listing)) {
        if (isJavaScriptOnlyShell(detailHtml)) {
          detail = buildListingFallbackJob(listing)
        } else {
          throw new Error('verified Rinex Technologies job detail no longer matches the trusted first-party application surface')
        }
      } else {
        detail = extractJobDetail(detailHtml, listing)
      }

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        companyCareerPage: CAREER_URL,
        companyDomain: 'rinex.ai',
        atsPlatform: 'official-company-careers',
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createRinexTechnologiesScraper().run(options)

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
