import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'brainstormforce'
export const COMPANY = 'Brainstorm Force'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_URL = 'https://brainstormforce.com/join/'
export const JOB_PAGE_PREFIX = 'https://brainstormforce.com/join/'
export const APPLICATION_FORMS_BASE_URL = 'https://forms.brainstormforce.com/'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-public-job-pages-and-branded-application-forms'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://brainstormforce.com/join/ was the live exact-name Brainstorm Force careers surface, that it exposed public same-origin role pages under https://brainstormforce.com/join/, and that current India-targeted roles with working detail pages including Product Manager and Senior Laravel Developer handed applicants to Brainstorm Force application forms on https://forms.brainstormforce.com/. This scraper validates the verified first-party careers surface, keeps only India-tagged listings, and excludes stale cards that redirect away from their advertised detail pages.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'

const REQUIRED_SURFACE_PATTERNS = [
  /<title>\s*Join\s*-\s*Brainstorm Force\s*<\/title>/i,
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/brainstormforce\.com\/join\/["']/i,
  /\bLet(?:’|')s Build the Future of Digital Business Together\b/i,
  /\bWork Remotely From Anywhere\b/i,
  /\bApply Now\b/i,
]

const CAREERS_CARD_PATTERN =
  /<p[^>]*color:#000f32[^>]*>\s*([\s\S]*?)\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?title="Join">\s*([\s\S]*?)\s*<\/p>[\s\S]*?title="Join">\s*([\s\S]*?)\s*<\/p>[\s\S]*?<a[^>]+href="(https:\/\/brainstormforce\.com\/join\/[^"#?]+\/)"[^>]*aria-label="Apply Now"/gi

const APPLY_URL_PATTERN =
  /<a[^>]+href="(https:\/\/forms\.brainstormforce\.com\/[^"#\s<>]+)"[^>]*aria-label="Apply Now"/i

const DETAIL_TITLE_PATTERN = /<h1[^>]*>\s*(?:<div[^>]*>)?\s*([\s\S]*?)\s*(?:<\/div>)?\s*<\/h1>/i

const decodeHtml = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/<br\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeHtml(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const buildJobId = (url) => {
  try {
    const pathnameParts = new URL(url).pathname.split('/').filter(Boolean)
    return pathnameParts.at(-1) || null
  } catch {
    return null
  }
}

const isIndiaLocation = (location) => /\bindia\b/i.test(normalizeWhitespace(location) || '')

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full-time' || normalized === 'full time') return 'Full-time'
  return normalizeWhitespace(value)
}

const isBrainstormForceJobPage = (url) => {
  try {
    const parsed = new URL(String(url ?? ''))
    return parsed.origin === 'https://brainstormforce.com'
      && parsed.pathname.startsWith('/join/')
      && parsed.pathname !== '/join/'
  } catch {
    return false
  }
}

const isTrustedApplyUrl = (url) => {
  try {
    const parsed = new URL(String(url ?? ''))
    return parsed.protocol === 'https:' && parsed.hostname === 'forms.brainstormforce.com'
  } catch {
    return false
  }
}

export const hasOfficialCareersPageSignal = (html = '') =>
  REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const extractCareersListings = (html = '') => {
  const listings = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(CAREERS_CARD_PATTERN)) {
    const title = stripTags(match[1])
    const description = stripTags(match[2])
    const location = normalizeWhitespace(match[3])
    const employmentType = normalizeEmploymentType(match[4])
    const sourceUrl = normalizeWhitespace(match[5])

    if (!title || !description || !location || !employmentType || !sourceUrl) continue
    if (employmentType !== 'Full-time') continue
    if (!isBrainstormForceJobPage(sourceUrl)) continue
    if (/^\d+\+?$/.test(title)) continue

    const key = normalizeComparableUrl(sourceUrl)
    if (seen.has(key)) continue
    seen.add(key)

    listings.push({
      title,
      description,
      location,
      employmentType,
      sourceUrl,
      jobId: buildJobId(sourceUrl),
      isIndiaRole: isIndiaLocation(location),
    })
  }

  return listings
}

export const extractDetailApplyUrl = (html = '') => normalizeWhitespace(
  String(html ?? '').match(APPLY_URL_PATTERN)?.[1] || null,
)

export const extractDetailHeading = (html = '') => stripTags(
  String(html ?? '').match(DETAIL_TITLE_PATTERN)?.[1] || null,
)

export const detailPageHasExpectedSignals = (html = '', listing = {}) => {
  const heading = extractDetailHeading(html)
  const applyUrl = extractDetailApplyUrl(html)
  const text = stripTags(html) || ''

  return heading === listing.title
    && isTrustedApplyUrl(applyUrl)
    && /\bJob Summary\b/i.test(text)
    && /\bApply Now\b/i.test(text)
    && (
      /\bAbout the Role\b/i.test(text)
      || /\bWhat you will be doing\b/i.test(text)
      || /\bWhat You Need to Know\b/i.test(text)
      || /\bRequired Skills and Qualifications\b/i.test(text)
    )
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const timeoutSignal = AbortSignal.timeout(15000)
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    url: response.url,
    html: await response.text(),
  }
}

const toJob = (listing, { applyUrl, scrapedAt }) => ({
  title: listing.title,
  company: COMPANY,
  department: null,
  location: listing.location,
  city: null,
  country: 'India',
  jobId: listing.jobId,
  requisitionId: listing.jobId,
  sourceUrl: listing.sourceUrl,
  applyUrl,
  employmentType: listing.employmentType,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: listing.description,
  remoteStatus: 'Remote',
  source: SOURCE,
  link: applyUrl,
  scrapedAt,
})

export const createBrainstormForceScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString(), signal } = {}) {
    const fetchCheckedPage = async url => {
      signal?.throwIfAborted()
      try {
        const page = await fetchPage(url, { signal })
        signal?.throwIfAborted()
        return page
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const careersPage = await fetchCheckedPage(CAREERS_URL)

    if (
      normalizeComparableUrl(careersPage?.url) !== normalizeComparableUrl(CAREERS_URL)
      || !hasOfficialCareersPageSignal(careersPage?.html)
    ) {
      throw new Error('Brainstorm Force verified official careers surface changed materially')
    }

    const listings = extractCareersListings(careersPage.html)
    if (listings.length === 0) {
      throw new Error('Brainstorm Force careers page no longer exposes the verified public role-card contract')
    }

    const indiaListings = listings.filter((listing) => listing.isIndiaRole)
    if (indiaListings.length === 0) {
      throw new Error('Brainstorm Force careers page no longer exposes India-targeted public role cards')
    }

    const scrapedAt = now()
    const jobs = []

    for (const listing of indiaListings) {
      const detailPage = await fetchCheckedPage(listing.sourceUrl)

      if (
        normalizeComparableUrl(detailPage?.url) !== normalizeComparableUrl(listing.sourceUrl)
        || !detailPageHasExpectedSignals(detailPage?.html, listing)
      ) {
        continue
      }

      const applyUrl = extractDetailApplyUrl(detailPage.html)
      if (!isTrustedApplyUrl(applyUrl)) continue

      jobs.push(toJob(listing, { applyUrl, scrapedAt }))
    }

    if (jobs.length === 0) {
      throw new Error(
        'Brainstorm Force no longer exposes any trustworthy India-targeted public role pages with branded application forms',
      )
    }

    return jobs
  },
})

export const run = async (options = {}) => createBrainstormForceScraper().run(options)

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
