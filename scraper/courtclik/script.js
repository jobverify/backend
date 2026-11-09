import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'courtclik'
export const COMPANY = 'Courtclik'
export const HOMEPAGE_URL = 'https://www.courtclick.com/'
export const CAREERS_URL = 'https://www.courtclick.com/career'
export const CAREERS_API_URL = 'https://www.courtclick.com/api/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const createFetchTimeoutSignal = (timeoutMs = FETCH_TIMEOUT_MS) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&apos;|&rsquo;/gi, "'")
  .replace(/&mdash;|&ndash;/gi, '-')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeMarkup = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/\u2019/g, "'")
    .replace(/[\u2013\u2014]/g, '-'),
)

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/[\u2013\u2014]/g, '-'),
)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createFetchTimeoutSignal(),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()
  return /<title>\s*(?:Court Click:\s*India's Smartest Case Tracking App for Lawyers and Litigants|Court Click \(CourtClick\)\s*-\s*Case Tracking App for India)\s*<\/title>/i.test(markup)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.courtclick\.com\/?["']/i.test(markup)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["'](?:Court Click\s*-\s*Legal Case Management App for Lawyers\s*&\s*Litigants|Court Click \(CourtClick\)\s*-\s*Case Tracking App for India)["']/i.test(markup)
    && text.includes('manage your legal journey anytime, anywhere')
    && text.includes('court click is a modern legal-tech platform designed to simplify how people track & manage court cases')
    && text.includes('digilaw legal software pvt ltd. doing business as court click')
}

export const hasOfficialCareersSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()
  return /<title>\s*Careers at Court Click\s*-\s*Join Our Legal-Tech Team(?:\s*\|\s*Court Click)?\s*<\/title>/i.test(markup)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.courtclick\.com\/career["']/i.test(markup)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Explore open roles at Court Click\.\s*Join our mission to transform India's legal-tech industry\.\s*See current openings and apply today\.["']/i.test(markup)
    && text.includes('build the future of legaltech')
    && text.includes('join a team building a more accessible, transparent, and efficient legal system for everyone.')
    && text.includes('open roles at court click')
    && text.includes('explore opportunities to grow, build, and make real impact.')
    && text.includes('digilaw legal software pvt ltd. doing business as court click')
}

export const hasZeroRolesEmptyState = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()

  return markup.includes('class="open-roles"')
    && markup.includes('placeholder="Search for job roles"')
    && text.includes('no roles found')
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
  /recruitcrm/i,
  /class=["'][^"']*\b(job-card|role-card|opening-card)\b/i,
  /<a\b[^>]*>\s*(apply now|apply here|view details|view opening|submit application)\s*<\/a>/i,
  /<button\b[^>]*>\s*(apply now|apply here|view details|submit application)\s*<\/button>/i,
]

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizeMarkup(html)))

export const createCourtclikScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Courtclik verified official homepage no longer matches the verified first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Courtclik verified official careers page no longer matches the verified first-party surface')
    }

    // The server-rendered empty state precedes the client's GET /api/careers.
    const apiPage = await fetchPage(CAREERS_API_URL)
    let records
    try {
      records = JSON.parse(String(apiPage?.html ?? ''))
    } catch {
      throw new Error('Courtclik careers API inventory is malformed or unavailable')
    }
    if (apiPage?.status !== 200 || apiPage?.url !== CAREERS_API_URL || !Array.isArray(records)) {
      throw new Error('Courtclik careers API inventory is malformed or unavailable')
    }
    const ids = new Set()
    const jobs = []
    for (const record of records) {
      const id = normalizeWhitespace(record?.id)
      const title = normalizeWhitespace(record?.title)
      const location = normalizeWhitespace(record?.tags?.location)
      if (!id || ids.has(id) || !title || !location || !normalizeWhitespace(record.description)
        || !normalizeWhitespace(record.keyRequirements) || !normalizeWhitespace(record.tags?.mode)
        || !normalizeWhitespace(record.tags?.type)) {
        throw new Error('Courtclik careers API inventory contains malformed or duplicate roles')
      }
      ids.add(id)
      const city = getValidIndiaCityForJob({ location })
      if (!city || city === 'Remote') {
        if (/\b(?:United Kingdom|United States|Singapore|Canada|Australia|Germany|UAE)\b/i.test(location)) continue
        throw new Error('Courtclik careers API role location is outside the verified India scope: ' + location)
      }
      jobs.push({
        jobId: id, requisitionId: id, title, company: COMPANY, source: SOURCE,
        location: /\bindia\b/i.test(location) ? location : location + ', India', city, country: 'India',
        department: null, employmentType: normalizeWhitespace(record.tags.mode),
        remoteStatus: normalizeWhitespace(record.tags.type), experienceRequired: null,
        minimumQualification: null, preferredQualification: null, requiredSkills: [],
        postingDate: null, closingDate: null,
        jobDescription: stripTags(record.description) + ' Requirements: ' + stripTags(record.keyRequirements),
        sourceUrl: CAREERS_URL, applyUrl: CAREERS_URL, link: CAREERS_URL,
        scrapedAt: new Date().toISOString(),
      })
    }
    return attachInventoryEvidence(jobs, {
      status: 'complete-inventory', surface: CAREERS_API_URL, firstParty: true,
      listingComplete: true, pagesFetched: 1, reportedTotal: records.length,
      indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString(),
      reason: 'verified-official-pages-and-complete-careers-api-array',
    })
  },
})

export const run = async (options = {}) => createCourtclikScraper().run(options)

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
