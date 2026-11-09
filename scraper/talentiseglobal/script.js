import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'talentiseglobal'
export const COMPANY = 'TALENTISE GLOBAL'
export const HOMEPAGE_URL = 'https://talentiseglobal.com/'
export const CAREERS_URL = 'https://talentiseglobal.com/careers'
export const CANDIDATE_LOGIN_URL = 'https://talentiseglobal.com/front/login'
export const CANDIDATE_SIGNUP_URL = 'https://talentiseglobal.com/student-registration'

const OFFICIAL_TITLE = 'Talentise Global Pvt. Ltd'
const CAREERS_TITLE = 'TGPL | Careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'Home',
  'Who We Are',
  'Services',
  'Talent Acquisition & Related Solutions',
  'Employer Branding Strategies',
  'Examination Management Systems',
  'Learning & Development Services',
  'Testimonials',
]

const CAREERS_SIGNALS = [
  'Latest Career Opportunities',
]

const DETAIL_LABELS = {
  qualification: 'Qualification :',
  department: 'Department :',
  experience: 'Experience :',
  location: 'Job Location :',
  employmentType: 'Employment Type :',
  description: 'Job Description :',
}

const PUBLIC_JOB_LISTINGS_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bcareer opportunities\b/i,
  /\bjob id\b/i,
  /\bjob location\b/i,
  /\bapply now\b/i,
  /\/career-details\//i,
]

const BASIC_ENTITY_MAP = new Map([
  ['&nbsp;', ' '],
  ['&amp;', '&'],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&rsquo;', "'"],
  ['&#8217;', "'"],
  ['&#x2019;', "'"],
  ['&quot;', '"'],
])

const decodeBasicEntities = (value) => {
  let result = String(value ?? '')

  for (const [entity, replacement] of BASIC_ENTITY_MAP.entries()) {
    result = result.replace(new RegExp(entity, 'gi'), replacement)
  }

  return result
}

const normalizeWhitespace = (value) => decodeBasicEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtmlToText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '')

const getAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractAnchorUrls = (html, baseUrl) =>
  [...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => getAbsoluteUrl(match[1], baseUrl))
    .filter(Boolean)

const hasAllSignals = (html, signals) => {
  const normalizedText = stripHtmlToText(html).toLowerCase()
  return signals.every((signal) => normalizedText.includes(normalizeWhitespace(signal).toLowerCase()))
}

const hasRequiredLinks = (html, baseUrl, requiredUrls) => {
  const anchorUrls = extractAnchorUrls(html, baseUrl)
  return requiredUrls.every((requiredUrl) => anchorUrls.includes(requiredUrl))
}

const DETAIL_LABEL_VALUES = Object.values(DETAIL_LABELS)

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFieldValue = (text, label) => {
  const otherLabels = DETAIL_LABEL_VALUES.filter((value) => value !== label).map((value) => escapeRegExp(value))
  const pattern = new RegExp(
    `${escapeRegExp(label)}\\s*([\\s\\S]*?)(?=\\s+(?:${otherLabels.join('|')})|$)`,
    'i',
  )

  return normalizeWhitespace(text.match(pattern)?.[1] ?? '') || null
}

export const hasUnexpectedCareerOrAtsLink = (html, baseUrl = HOMEPAGE_URL) =>
  extractAnchorUrls(html, baseUrl)
    .some((absoluteUrl) => /lever|greenhouse|ashbyhq|workable|myworkdayjobs|smartrecruiters|jobvite/i.test(absoluteUrl))

export const hasPublicJobListingsSignal = (html) =>
  PUBLIC_JOB_LISTINGS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) =>
  extractTitle(html) === OFFICIAL_TITLE
  && hasAllSignals(html, HOMEPAGE_SIGNALS)
  && hasRequiredLinks(html, HOMEPAGE_URL, [
    CANDIDATE_LOGIN_URL,
    CAREERS_URL,
  ])
  && (
    hasRequiredLinks(html, HOMEPAGE_URL, [CANDIDATE_SIGNUP_URL])
    || hasRequiredLinks(html, HOMEPAGE_URL, ['https://talentiseglobal.com/talent-pro-register'])
  )

export const hasPublicCareersSignal = (html) =>
  extractTitle(html) === CAREERS_TITLE
  && hasAllSignals(html, CAREERS_SIGNALS)
  && extractAnchorUrls(html, CAREERS_URL).some((url) => /\/career-details\//i.test(url))

export const extractCareerListings = (html) => {
  const listings = []
  const seen = new Set()
  const page = String(html ?? '')

  for (const match of page.matchAll(/href=["']([^"']*\/career-details\/[^"']+)["']/gi)) {
    const detailUrl = getAbsoluteUrl(match[1], CAREERS_URL)
    if (!detailUrl || seen.has(detailUrl)) continue
    seen.add(detailUrl)

    const contextStart = Math.max(0, (match.index ?? 0) - 2000)
    const context = page.slice(contextStart, (match.index ?? 0) + 400)
    const headingMatches = [...context.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    const textDivMatches = [...context.matchAll(/<(?:div|p)[^>]*>([\s\S]*?)<\/(?:div|p)>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const title = normalizeWhitespace(headingMatches.at(-1)?.[1] ?? '')
    const location = textDivMatches
      .filter((value) => value && !/teacher|read more|career opportunities/i.test(value))
      .at(-1)
      || null

    if (!title) continue

    listings.push({
      title,
      location: location || null,
      detailUrl,
    })
  }

  return listings
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full')) return 'Full-time'
  if (normalized.includes('part')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const buildIndiaLocation = (value) => {
  const city = normalizeWhitespace(value)
  if (!city) return 'India'
  return /india$/i.test(city) ? city : `${city}, India`
}

export const extractCareerDetail = (html, listing = {}) => {
  const text = stripHtmlToText(html)
  const title = extractTitle(html) || listing.title || null
  const city = extractFieldValue(text, DETAIL_LABELS.location) || listing.location || null

  return {
    title,
    department: extractFieldValue(text, DETAIL_LABELS.department),
    experienceRequired: extractFieldValue(text, DETAIL_LABELS.experience),
    location: buildIndiaLocation(city),
    city: normalizeWhitespace(city),
    employmentType: normalizeEmploymentType(extractFieldValue(text, DETAIL_LABELS.employmentType)),
    minimumQualification: extractFieldValue(text, DETAIL_LABELS.qualification),
    jobDescription: extractFieldValue(text, DETAIL_LABELS.description),
    applyUrl: listing.detailUrl || null,
    sourceUrl: listing.detailUrl || null,
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createTalentiseGlobalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Talentise Global verified official homepage no longer matches the known public surface')
    }
    if (hasUnexpectedCareerOrAtsLink(homepage.html, HOMEPAGE_URL)) {
      throw new Error('Talentise Global homepage now points to an unexpected ATS or careers surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasPublicCareersSignal(careersPage.html)) {
      throw new Error('Talentise Global verified public careers page no longer matches the known public surface')
    }

    const listings = extractCareerListings(careersPage.html)
    if (listings.length === 0) {
      throw new Error('Talentise Global verified public careers page no longer exposes public career details')
    }

    const jobs = []
    for (const listing of listings) {
      const detailPage = await fetchPage(listing.detailUrl)
      const detail = extractCareerDetail(detailPage.html, listing)

      if (detailPage.status !== 200 || !detail.title || !detail.location || !detail.jobDescription) {
        throw new Error(`Talentise Global career detail page changed materially: ${listing.detailUrl}`)
      }

      jobs.push({
        title: detail.title,
        company: COMPANY,
        department: detail.department,
        location: detail.location,
        city: detail.city,
        state: null,
        country: 'India',
        workplaceType: null,
        jobId: listing.detailUrl.split('/').at(-1) || detail.title,
        requisitionId: listing.detailUrl.split('/').at(-1) || detail.title,
        sourceUrl: detail.sourceUrl,
        applyUrl: detail.applyUrl,
        link: detail.applyUrl,
        source: SOURCE,
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        minimumQualification: detail.minimumQualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createTalentiseGlobalScraper().run(options)

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
