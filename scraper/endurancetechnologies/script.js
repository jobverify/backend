import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { ENDURANCE_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ENDURANCE_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_PORTAL_URL = PROVIDER_METADATA.jobPortalUrl
export const VERIFIED_JOB_URLS = PROVIDER_METADATA.verifiedJobUrls
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const DEFAULT_TIMEOUT_MS = 120000

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#x27;/gi, "'")
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|span|a)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/[•●▪◦]/g, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const absoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const sameUrl = (left, right) => {
  try {
    const leftUrl = new URL(String(left ?? ''))
    const rightUrl = new URL(String(right ?? ''))
    leftUrl.hash = ''
    rightUrl.hash = ''
    return leftUrl.toString().replace(/\/$/, '') === rightUrl.toString().replace(/\/$/, '')
  } catch {
    return String(left ?? '').replace(/\/$/, '') === String(right ?? '').replace(/\/$/, '')
  }
}

const uniqueStrings = (values) => {
  const seen = new Set()
  const output = []

  for (const value of values) {
    const normalized = normalizeText(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

const slugify = (value) => normalizeWhitespace(value)
  .replace(/[–—]/g, '-')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const titleCaseWithoutPrefix = (value) => normalizeText(value)?.replace(/^Job Opening for\s*/i, '') || null

const toTextLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|span|a)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/[•●▪◦]/g, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '\n')
  .replace(/\u00a0/g, ' ')
  .split('\n')
  .map((line) => normalizeText(line))
  .filter(Boolean)

const parseLocation = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeText(part)).filter(Boolean)
  const firstPart = parts[0] || normalized
  const city = normalizeCity(firstPart) || firstPart
  const state = parts.find((part) => /maharashtra/i.test(part))
    || (/\bpune\b/i.test(normalized) ? 'Maharashtra' : null)
  const country = parts.find((part) => /india/i.test(part)) || 'India'

  return {
    location: [city, state, country].filter(Boolean).join(', ') || normalized,
    city: city || null,
    state: state || null,
    country: country || null,
  }
}

const findFirstMatch = (patterns, value) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    if (match?.[1]) return normalizeText(match[1])
  }

  return null
}

const buildJobIdFromUrl = (value, fallbackTitle = '') => {
  try {
    const slug = decodeURIComponent(new URL(value).pathname.split('/').filter(Boolean).at(-1) || fallbackTitle)
    return `${SOURCE}-${slugify(slug)}`
  } catch {
    return `${SOURCE}-${slugify(fallbackTitle || 'role')}`
  }
}

const buildDescriptionSection = (heading, lines) => {
  if (!lines.length) return []

  return [
    heading,
    ...lines.map((line) => `- ${line}`),
  ]
}

const extractListItemsFromFragment = (html = '') => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTagsToText(match[1]))
  .filter(Boolean)

const extractTabbedSectionLinesFromHtml = (html = '', sectionId) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<div\\s+id=["']${sectionId}["'][^>]*class=["'][^"']*tab_content[^"']*["'][^>]*>([\\s\\S]*?)<div\\s+class=["'][^"']*readmorebtn[^"']*["']`,
      'i',
    ),
  )

  return uniqueStrings(extractListItemsFromFragment(match?.[1]))
}

const extractSectionLines = (lines, heading, stopHeadings = []) => {
  const startIndex = lines.findIndex((line) => sameUrl(line, heading) || line.toLowerCase() === heading.toLowerCase())
  if (startIndex === -1) return []

  const stopSet = new Set(stopHeadings.map((value) => value.toLowerCase()))
  const collected = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    const normalized = line.toLowerCase()

    if (stopSet.has(normalized)) break
    if (normalized === 'explore more' || normalized === 'quick enquiry') break
    if (normalized === 'read more' || normalized === 'apply now') continue
    collected.push(line)
  }

  return uniqueStrings(collected)
}

const extractResponsibilityLines = (html = '', lines = toTextLines(html)) => {
  const tabLines = extractTabbedSectionLinesFromHtml(html, 'respo')
  if (tabLines.length > 0) return tabLines
  return extractSectionLines(lines, 'Job Responsibilities', ['Job Qualifications'])
}

const extractQualificationLines = (html = '', lines = toTextLines(html)) => {
  const tabLines = extractTabbedSectionLinesFromHtml(html, 'qualification')
  if (tabLines.length > 0) return tabLines
  return extractSectionLines(lines, 'Job Qualifications')
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('unleash your potential')
    && normalized.includes('i am interested in')
    && normalized.includes('life at endurance')
    && sameUrl(extractJobPortalUrl(html), JOB_PORTAL_URL)
}

export const extractJobPortalUrl = (html = '') => {
  const match = String(html ?? '').match(/href=["']([^"']*\/(?:careers\/)?job-portal\/?)["']/i)
  return absoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialJobPortalSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return normalized.includes('current opening')
    && normalized.includes('drop your cv here')
    && normalized.includes('apply now')
    && /href=["'][^"']*\/career\/[^"']+["']/i.test(rawHtml)
}

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    Referer: HOMEPAGE_URL,
  },
  label: SOURCE,
  timeoutMs: DEFAULT_TIMEOUT_MS,
})

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = normalizeWhitespace(html) || ''

  return Number(page.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /challenges\.cloudflare\.com/i.test(html)
    && text.includes('Enable JavaScript and cookies to continue')
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
    && hasVerifiedCloudflareChallengeSignal(page)
}

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  headers: {},
  html: await fetchText(url),
})

export const collectListingCandidates = (html = '', baseUrl = JOB_PORTAL_URL) => [...String(html ?? '').matchAll(
  /<li\b[^>]*class="[^"]*job-card[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
)]
  .map((match) => {
    const block = match[1]
    const paragraphs = [...String(block).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((paragraphMatch) => stripTagsToText(paragraphMatch[1]))
      .filter(Boolean)

    return {
      title: stripTagsToText(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]),
      experience: paragraphs[0] || null,
      designation: paragraphs[1] || null,
      location: paragraphs[2] || null,
      sourceUrl: absoluteUrl(block.match(/<a[^>]+href="([^"]+)"[^>]*>/i)?.[1], baseUrl),
    }
  })
  .filter((candidate) => candidate.title && candidate.sourceUrl)

export const normalizeListingCandidate = (candidate = {}) => {
  const sourceUrl = absoluteUrl(candidate.sourceUrl, JOB_PORTAL_URL)
  const title = titleCaseWithoutPrefix(candidate.title)
  const experienceRequired = normalizeText(candidate.experience)
    || findFirstMatch([/(\d+\s*Years?)/i], candidate.text)
  const designation = normalizeText(candidate.designation)
    || findFirstMatch([/(Assistant Manager)/i], candidate.text)
  const { location, city, state, country } = parseLocation(candidate.location || candidate.text)

  if (!sourceUrl || !title || !location) return null

  const jobId = buildJobIdFromUrl(sourceUrl, title)

  return {
    title,
    company: COMPANY,
    designation,
    experienceRequired,
    location,
    city,
    state,
    country,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    department: null,
    employmentType: null,
    jobDescription: null,
  }
}

const extractDetailTitle = (html, listing = {}) =>
  titleCaseWithoutPrefix(findFirstMatch([/<h1[^>]*>([\s\S]*?)<\/h1>/i], html) || listing.title)

export const hasOfficialJobDetailSignal = (html = '', listing = {}) => {
  const lines = toTextLines(html)
  const title = extractDetailTitle(html, listing)
  const responsibilityLines = extractResponsibilityLines(html, lines)
  const qualificationLines = extractQualificationLines(html, lines)

  return Boolean(title)
    && lines.includes(title)
    && lines.some((line) => line.toLowerCase() === 'apply now')
    && responsibilityLines.length > 0
    && qualificationLines.length > 0
}

export const extractJobDetail = (html = '', listing = {}) => {
  if (!hasOfficialJobDetailSignal(html, listing)) {
    throw new Error('Endurance Technologies verified job detail no longer matches the trusted first-party surface')
  }

  const lines = toTextLines(html)
  const title = extractDetailTitle(html, listing)
  const designation = normalizeText(listing.designation)
    || findFirstMatch([/(Assistant Manager)/i], lines.join('\n'))
  const experienceRequired = normalizeText(listing.experienceRequired)
    || findFirstMatch([/(\d+\s*Years?)/i], lines.join('\n'))
  const { location, city, state, country } = parseLocation(
    listing.location || findFirstMatch([/(Pune(?:,\s*Maharashtra(?:,\s*India)?)?)/i], lines.join('\n')),
  )
  const responsibilityLines = extractResponsibilityLines(html, lines)
  const qualificationLines = extractQualificationLines(html, lines)
  const jobDescription = [
    ...buildDescriptionSection('Job Responsibilities', responsibilityLines),
    '',
    ...buildDescriptionSection('Job Qualifications', qualificationLines),
  ].join('\n')

  return {
    title,
    company: COMPANY,
    designation,
    department: listing.department || null,
    location,
    city,
    state,
    country,
    jobId: listing.jobId || buildJobIdFromUrl(listing.sourceUrl, title),
    requisitionId: listing.requisitionId || buildJobIdFromUrl(listing.sourceUrl, title),
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: listing.employmentType || null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: uniqueStrings([
      ...responsibilityLines,
      ...qualificationLines,
    ]),
    postingDate: null,
    closingDate: null,
    jobDescription,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const createEnduranceTechnologiesScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage,
    fetchText,
  } = {}) {
    const effectiveFetchPage = typeof fetchPage === 'function'
      ? fetchPage
      : typeof fetchText === 'function'
        ? createFetchPageFromText(fetchText)
        : defaultFetchPage

    const careersPage = await effectiveFetchPage(CAREERS_URL)
    if (isVerifiedCloudflareChallengedPage(careersPage, CAREERS_URL)) {
      return []
    }

    const careersHtml = getPageHtml(careersPage)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Endurance Technologies careers page no longer matches the verified first-party surface')
    }

    const jobPortalUrl = extractJobPortalUrl(careersHtml)
    if (!sameUrl(jobPortalUrl, JOB_PORTAL_URL)) {
      throw new Error('Endurance Technologies careers page no longer exposes the verified first-party job portal handoff')
    }

    const jobPortalPage = await effectiveFetchPage(jobPortalUrl)
    if (isVerifiedCloudflareChallengedPage(jobPortalPage, jobPortalUrl)) {
      return []
    }

    const jobPortalHtml = getPageHtml(jobPortalPage)
    if (!hasOfficialJobPortalSignal(jobPortalHtml)) {
      throw new Error('Endurance Technologies job portal no longer matches the verified first-party public surface')
    }

    const listings = uniqueStrings(
      collectListingCandidates(jobPortalHtml, jobPortalUrl)
        .map((candidate) => JSON.stringify(normalizeListingCandidate(candidate)))
        .filter((value) => value !== 'null'),
    ).map((serialized) => JSON.parse(serialized))

    if (listings.length === 0) {
      throw new Error('Endurance Technologies job portal no longer exposes parseable first-party public openings')
    }

    const limitedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings

    const jobs = []

    for (const listing of limitedListings) {
      const detailPage = await effectiveFetchPage(listing.sourceUrl)
      if (isVerifiedCloudflareChallengedPage(detailPage, listing.sourceUrl)) {
        return []
      }

      const detailHtml = getPageHtml(detailPage)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createEnduranceTechnologiesScraper(options).run()

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
