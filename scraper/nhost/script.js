import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = {
  source: 'nhost',
  companyName: 'Nhost',
  companyCareerPage: 'https://nhost.io/careers',
  companyDomain: 'nhost.io',
  atsPlatform: 'official-first-party-careers-page',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://nhost.io/careers exposed one first-party role page for Senior Software Engineer, Backend & Operations, with a Remote, Full-time detail page and direct application instructions via careers@nhost.io.',
}

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const APPLICATION_EMAIL = 'careers@nhost.io'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`
export const VERIFIED_ROLE_URLS = [
  'https://nhost.io/careers/senior-software-engineer-backend-operations',
]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const EXPERIENCE_PATTERN = /\b\d+\+\s+years?\b|\b\d+-\d+\s+years?\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, ' ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const trimTrailingSlash = (value) => String(value ?? '').replace(/\/+$/, '')

const normalizeUrl = (value) => trimTrailingSlash(String(value ?? ''))

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return normalizeUrl(new URL(value, baseUrl).toString())
  } catch {
    return null
  }
}

const uniqueUrls = (values) => [...new Set(values)]

const extractAnchorUrls = (html = '', baseUrl = CAREERS_URL) =>
  [...String(html ?? '').matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1], baseUrl))
    .filter(Boolean)

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractRoleTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])

const extractSectionHtml = (html = '', heading) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h2[^>]*>\\s*${escapeRegex(heading)}\\s*<\\/h2>([\\s\\S]*?)(?=<h2[^>]*>|<footer\\b|$)`,
      'i',
    ),
  )

  return match?.[1] || ''
}

const extractSectionListItems = (sectionHtml = '') =>
  [...String(sectionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractSectionParagraphs = (sectionHtml = '') => {
  const paragraphs = [...String(sectionHtml ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return paragraphs.length > 0 ? paragraphs : [stripTags(sectionHtml)].filter(Boolean)
}

const appendListSection = (parts, heading, items) => {
  if (items.length === 0) return
  if (parts.length > 0) parts.push('')
  parts.push(heading)
  items.forEach((item) => parts.push(`- ${item}`))
}

const getRoleSlug = (roleUrl) => {
  try {
    return normalizeWhitespace(new URL(roleUrl).pathname.split('/').filter(Boolean).at(-1))
  } catch {
    return null
  }
}

const getDepartment = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(
      /<(?:p|div|span)[^>]*>\s*([^<]{1,160}?)\s*<\/(?:p|div|span)>\s*<h1/i,
    )?.[1],
  )

const getParagraphs = (html = '') =>
  [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const getLeadMetadataItems = (html = '') => {
  const leadSection = String(html ?? '').match(
    /<h1[^>]*>[\s\S]*?<\/h1>([\s\S]*?)<a\b[^>]+href=["']mailto:[^"']+/i,
  )?.[1] || ''

  return [...leadSection.matchAll(/<(p|div|span)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripTags(match[2]))
    .filter(Boolean)
}

const findMetadataToken = (html = '', pattern, normalize) => {
  for (const item of getLeadMetadataItems(html)) {
    const match = item.match(pattern)
    if (match?.[1]) {
      return normalize(match[1])
    }
  }

  return null
}

const normalizeWorkplaceType = (value = '') => {
  const normalized = String(value).toLowerCase()
  if (normalized === 'on-site' || normalized === 'onsite') return 'On-site'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  return null
}

const normalizeEmploymentType = (value = '') => {
  const normalized = String(value).toLowerCase()
  if (normalized === 'full-time') return 'Full-time'
  if (normalized === 'part-time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  if (normalized === 'internship') return 'Internship'
  return null
}

const getWorkplaceType = (html = '') =>
  findMetadataToken(html, /\b(Remote|Hybrid|On-site)\b/i, normalizeWorkplaceType)

const getEmploymentType = (html = '') =>
  findMetadataToken(
    html,
    /\b(Full-time|Part-time|Contract|Internship)\b/i,
    normalizeEmploymentType,
  )

const findExperienceLine = (items = []) =>
  items.find((item) => EXPERIENCE_PATTERN.test(item)) || null

export const extractCareerRoleUrls = (html = '') => uniqueUrls(
  extractAnchorUrls(html, CAREERS_URL)
    .filter((url) => /^https:\/\/nhost\.io\/careers\/[a-z0-9-]+$/i.test(url)),
)

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''
  const expectedRoleCountLabel = VERIFIED_ROLE_URLS.length === 1
    ? '1 open role'
    : `${VERIFIED_ROLE_URLS.length} open roles`

  return extractTitle(page) === 'Careers and Open Positions | Nhost'
    && normalized.includes('Build the future of application development with us')
    && normalized.includes('Remote, global, async')
    && normalized.includes('Open positions')
    && normalized.includes(expectedRoleCountLabel)
    && new RegExp(escapeRegex(APPLICATION_EMAIL), 'i').test(page)
    && JSON.stringify(extractCareerRoleUrls(page)) === JSON.stringify(VERIFIED_ROLE_URLS)
}

export const hasOfficialRoleDetailSignal = (html = '', roleUrl = null) => {
  const page = String(html ?? '')
  const title = extractRoleTitle(page)
  const slug = getRoleSlug(roleUrl)

  return extractTitle(page)?.includes('Nhost')
    && Boolean(title)
    && (!slug || VERIFIED_ROLE_URLS.some((url) => getRoleSlug(url) === slug))
    && /All open positions/i.test(page)
    && /\bRemote\b/i.test(stripTags(page) || '')
    && /\bFull-time\b/i.test(stripTags(page) || '')
    && /<h2[^>]*>\s*About the role\s*<\/h2>/i.test(page)
    && /<h2[^>]*>\s*What will you do\?\s*<\/h2>/i.test(page)
    && /<h2[^>]*>\s*What are we looking for\?\s*<\/h2>/i.test(page)
    && /<h2[^>]*>\s*How to apply\s*<\/h2>/i.test(page)
    && new RegExp(escapeRegex(APPLICATION_URL), 'i').test(page)
    && new RegExp(escapeRegex(APPLICATION_EMAIL), 'i').test(page)
}

export const extractRoleDetail = (html = '', roleUrl) => {
  const title = extractRoleTitle(html)
  const responsibilities = extractSectionListItems(extractSectionHtml(html, 'What will you do?'))
  const requirements = extractSectionListItems(extractSectionHtml(html, 'What are we looking for?'))
  const niceToHaves = extractSectionListItems(extractSectionHtml(html, 'Nice to haves'))
  const whatWeOffer = extractSectionListItems(extractSectionHtml(html, 'What we offer'))
  const aboutParagraphs = extractSectionParagraphs(extractSectionHtml(html, 'About the role'))
  const howToApply = extractSectionParagraphs(extractSectionHtml(html, 'How to apply'))
  const experienceRequired = findExperienceLine(requirements)
  const requiredSkills = requirements.filter((item) => item !== experienceRequired)
  const preferredQualification = niceToHaves[0] || null

  const descriptionParts = []
  if (aboutParagraphs.length > 0) {
    descriptionParts.push(aboutParagraphs[0])
  }
  appendListSection(descriptionParts, 'What will you do?', responsibilities)
  appendListSection(descriptionParts, 'What are we looking for?', requirements)
  appendListSection(descriptionParts, 'Nice to haves', niceToHaves)
  appendListSection(descriptionParts, 'What we offer', whatWeOffer)
  appendListSection(descriptionParts, 'How to apply', howToApply)

  return {
    title,
    company: COMPANY,
    department: getDepartment(html),
    location: 'Remote',
    city: null,
    state: null,
    country: 'Global',
    jobId: getRoleSlug(roleUrl),
    requisitionId: getRoleSlug(roleUrl),
    sourceUrl: normalizeUrl(roleUrl),
    applyUrl: APPLICATION_URL,
    employmentType: getEmploymentType(html),
    workplaceType: getWorkplaceType(html),
    experienceRequired,
    minimumQualification: null,
    preferredQualification,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    remoteStatus: 'Remote',
    jobDescription: descriptionParts.join('\n'),
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

export const createNhostScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = null,
  roleUrlsToFetch = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Nhost verified careers page no longer matches the trusted public surface')
    }

    const verifiedRoleUrlSet = new Set(VERIFIED_ROLE_URLS.map((url) => normalizeUrl(url)))
    const requestedRoleUrls = roleUrlsToFetch || VERIFIED_ROLE_URLS
    const normalizedRequestedRoleUrls = requestedRoleUrls.map((url) => normalizeUrl(url))
    const selectedRoleUrls = normalizedRequestedRoleUrls.filter((url) => verifiedRoleUrlSet.has(url))

    if (selectedRoleUrls.length !== normalizedRequestedRoleUrls.length) {
      throw new Error('Nhost requested role subset includes unverified role URLs')
    }

    const roleUrls = Number.isInteger(maxJobs) ? selectedRoleUrls.slice(0, maxJobs) : selectedRoleUrls
    const jobs = []

    for (const roleUrl of roleUrls) {
      const detailHtml = await fetchText(roleUrl)
      if (!hasOfficialRoleDetailSignal(detailHtml, roleUrl)) {
        throw new Error(`Nhost verified role detail no longer matches the trusted public surface: ${roleUrl}`)
      }

      const job = extractRoleDetail(detailHtml, roleUrl)
      jobs.push({
        ...job,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createNhostScraper(options).run(options)

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
