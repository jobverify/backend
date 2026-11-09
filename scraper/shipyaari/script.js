import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SHIPYAARI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SHIPYAARI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2013\u2014]/g, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripScriptsAndStyles = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const htmlToLines = (value) => decodeHtmlEntities(
  stripScriptsAndStyles(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const makeAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractLastPathSegment = (value) => {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matchesLabelPrefix = (line, label) => {
  const labelPattern = new RegExp(`^${escapeRegex(String(label ?? '').replace(/:\s*$/, ''))}\\s*:?(?:\\s+|$)`, 'i')
  return labelPattern.test(String(line ?? ''))
}

const extractFieldValue = (lines, label) => {
  const line = lines.find((entry) => matchesLabelPrefix(entry, label))
  if (!line) return null
  const labelPattern = new RegExp(`^${escapeRegex(String(label ?? '').replace(/:\s*$/, ''))}\\s*:?(?:\\s+|$)`, 'i')
  return normalizeWhitespace(line.replace(labelPattern, ''))
}

const extractSection = (lines, startLabel, endLabels = []) => {
  const startIndex = lines.findIndex((line) => matchesLabelPrefix(line, startLabel))
  if (startIndex < 0) return null

  const values = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endLabels.some((label) => matchesLabelPrefix(line, label))) break
    values.push(line)
  }

  return normalizeWhitespace(values.join(' '))
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  const withoutParens = normalized.replace(/\(.*?\)/g, '').trim()
  const firstPart = withoutParens.split(',')[0]?.trim()
  return firstPart || null
}

const formatLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const deriveRemoteStatus = (location) => (/remote/i.test(normalizeWhitespace(location) || '') ? 'Remote' : 'On-site')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'shipyaari-official',
  timeoutMs: 15000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (normalizeWhitespace(stripScriptsAndStyles(rawHtml)) || '').toLowerCase()

  return normalized.includes('careers in logistics, shipping and technology - shipyaari jobs')
    && normalized.includes('why join shipyaari?')
    && normalized.includes('join the crew')
  }

export const hasOfficialRoleDetailSignal = (html = '') => {
  const normalized = (normalizeWhitespace(stripScriptsAndStyles(html)) || '').toLowerCase()

  return normalized.includes('shipyaari')
    && (
      normalized.includes('job title:')
      || normalized.includes('job description -')
      || normalized.includes('key responsibilities')
    )
    && (
      normalized.includes('location:')
      || normalized.includes('job summary')
      || normalized.includes('scope of work')
      || normalized.includes('required skills')
      || normalized.includes('apply now')
    )
  }

export const extractRoleCardsFromHtml = (html = '') => {
  const rawHtml = String(html ?? '')
  const roleLinks = [...rawHtml.matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*(?:<span[^>]*>)?\s*Know More\s*(?:<\/span>)?\s*<\/a>/gi,
  )]
  const seen = new Set()

  return roleLinks
    .map((match) => {
      const detailUrl = makeAbsoluteUrl(match[1])
      if (!detailUrl || seen.has(detailUrl)) return null

      const context = rawHtml.slice(Math.max(0, match.index - 500), match.index)
      const headings = [...context.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
      const title = normalizeWhitespace(
        String(headings.at(-1)?.[1] ?? '').replace(/<[^>]+>/g, ' '),
      )
      if (!title) return null

      seen.add(detailUrl)
      return { title, detailUrl }
    })
    .filter(Boolean)
}

export const hasCurrentResumeOnlyCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (normalizeWhitespace(stripScriptsAndStyles(rawHtml)) || '').toLowerCase()

  return hasOfficialCareersPageSignal(rawHtml)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.shipyaari\.com\/careers\/["']/i.test(rawHtml)
    && normalized.includes('please share your resume with us at')
    && (
      /mailto:careers@shipyaari\.com/i.test(rawHtml)
      || /\/cdn-cgi\/l\/email-protection#[a-f0-9]+[^>]*>[\s\S]*?class=["']__cf_email__["']/i.test(rawHtml)
    )
    && normalized.includes('avn business solutions pvt ltd')
    && extractRoleCardsFromHtml(rawHtml).length === 0
}

export const extractJobFromRoleDetailHtml = (html = '', roleCard = {}, { scrapedAt } = {}) => {
  const lines = htmlToLines(html)
  const title =
    extractFieldValue(lines, 'Job Title')
    || normalizeWhitespace(lines.find((line) => /^Job Description\s*-/i.test(line))?.replace(/^Job Description\s*-\s*/i, ''))
    || extractFieldValue(lines, 'Position')
    || normalizeWhitespace(roleCard.title)
  const location = extractFieldValue(lines, 'Location')
  const sectionEndLabels = [
    'Key Responsibilities',
    'Key Responsibilities and Accountabilities',
    'Key Account Management',
    'Required Skills',
    'Ideal Profile',
    'Additional Responsibilities',
    'Apply Now',
  ]
  const summary =
    extractSection(lines, 'Job Summary', sectionEndLabels)
    || extractSection(lines, 'Scope of Work', sectionEndLabels)
  const responsibilities =
    extractSection(lines, 'Key Responsibilities and Accountabilities', [
      'Required Skills',
      'Ideal Profile',
      'Additional Responsibilities',
      'Apply Now',
    ])
    || extractSection(lines, 'Key Responsibilities', [
      'Required Skills',
      'Ideal Profile',
      'Additional Responsibilities',
      'Apply Now',
    ])
    || extractSection(lines, 'Key Account Management', [
      'Required Skills',
      'Ideal Profile',
      'Additional Responsibilities',
      'Apply Now',
    ])
  const requiredSkills = extractSection(lines, 'Required Skills', [
    'Ideal Profile',
    'Additional Responsibilities',
    'Apply Now',
  ])
  const idealProfile = extractSection(lines, 'Ideal Profile', [
    'Additional Responsibilities',
    'Apply Now',
  ])
  const detailUrl = makeAbsoluteUrl(roleCard.detailUrl || CAREERS_URL, CAREERS_URL) || CAREERS_URL
  const jobId = extractLastPathSegment(detailUrl) || slugify(title)

  if (!title || !jobId) return null

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location: formatLocation(location),
    city: extractCity(location),
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace([summary, responsibilities, requiredSkills, idealProfile].filter(Boolean).join(' ')),
    remoteStatus: deriveRemoteStatus(location),
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createShipyaariScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The official Shipyaari careers page no longer matches the verified public surface')
    }

    const roleCards = extractRoleCardsFromHtml(careersHtml)
    if (roleCards.length === 0) {
      if (hasCurrentResumeOnlyCareersSignal(careersHtml)) return []
      throw new Error('The official Shipyaari careers page no longer exposes the verified public role links')
    }

    const jobs = []

    for (const roleCard of roleCards) {
      try {
        const detailHtml = await fetchText(roleCard.detailUrl)
        if (!hasOfficialRoleDetailSignal(detailHtml)) continue

        const job = extractJobFromRoleDetailHtml(detailHtml, roleCard, { scrapedAt: now() })
        if (job) jobs.push(job)
      } catch {
        continue
      }
    }

    if (jobs.length === 0) {
      throw new Error('Shipyaari public role detail pages no longer match the verified official careers surface')
    }

    return jobs
  },
})

export const run = async (options = {}) => createShipyaariScraper().run(options)

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
