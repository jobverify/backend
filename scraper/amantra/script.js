import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { AMANTRA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMANTRA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`
export const VERIFIED_ROLE_URLS = [...PROVIDER_METADATA.verifiedRoleUrls]
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const INDIA_LOCATION_PATTERN = /^(.+?),\s*India$/i
const WORKPLACE_TYPE_PATTERN = /^(On-site|Remote|Hybrid)$/i
const EMPLOYMENT_TYPE_PATTERN = /^(Full-time|Part-time|Contract|Internship)$/i

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

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractCanonicalUrl = (html = '') =>
  normalizeUrl(
    String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '',
  ) || null

const extractMetaDescription = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1],
  )

const extractAnchorUrls = (html = '', baseUrl = CAREERS_URL) =>
  [...String(html ?? '').matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1], baseUrl))
    .filter(Boolean)

const uniqueUrls = (values) => [...new Set(values)]

const extractRoleTitle = (html = '') => {
  const firstH1 = normalizeWhitespace(
    String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  )

  if (firstH1) return firstH1

  const firstHeading = normalizeWhitespace(
    String(html ?? '').match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1],
  )

  if (firstHeading) return firstHeading

  const pageTitle = extractTitle(html)
  if (!pageTitle?.startsWith('Amantra - ')) return null

  return normalizeWhitespace(pageTitle.replace(/^Amantra\s*-\s*/i, ''))
}

const extractVisibleParagraphs = (html = '') =>
  [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractRoleHeaderMetadata = (html = '') => {
  const title = extractRoleTitle(html)
  const text = stripTags(html) || ''

  if (title) {
    const escapedTitle = escapeRegex(title)
    const headerMatch = text.match(new RegExp(
      `${escapedTitle}\\s+${escapedTitle}\\s+(.+?)\\s+(On-site|Remote|Hybrid)\\s+([A-Za-z][A-Za-z\\s,-]*?)(?:,\\s*India)?\\s+(Full-time|Part-time|Contract|Internship)\\b`,
      'i',
    ))

    if (headerMatch) {
      return {
        department: normalizeWhitespace(headerMatch[1]),
        workplaceType: normalizeWhitespace(headerMatch[2]),
        location: normalizeWhitespace(
          /India/i.test(headerMatch[3]) ? headerMatch[3] : `${headerMatch[3]}, India`,
        ),
        employmentType: normalizeWhitespace(headerMatch[4]),
      }
    }
  }

  const paragraphs = extractVisibleParagraphs(html)
  const workplaceIndex = paragraphs.findIndex((value) => WORKPLACE_TYPE_PATTERN.test(value))
  const employmentType = paragraphs.find((value) => EMPLOYMENT_TYPE_PATTERN.test(value)) || null
  const indiaLocation = paragraphs.find((value) => INDIA_LOCATION_PATTERN.test(value))
  const nearbyLocation = workplaceIndex >= 0
    ? paragraphs.slice(workplaceIndex + 1).find((value) => (
      value
      && !WORKPLACE_TYPE_PATTERN.test(value)
      && !EMPLOYMENT_TYPE_PATTERN.test(value)
      && !/^View All$/i.test(value)
    ))
    : null

  return {
    department: null,
    workplaceType: paragraphs[workplaceIndex] || null,
    location: indiaLocation || (nearbyLocation ? (/^India$/i.test(nearbyLocation) ? 'India' : `${nearbyLocation}, India`) : null),
    employmentType,
  }
}

const extractLocation = (html = '') =>
  extractRoleHeaderMetadata(html).location || null

const extractWorkplaceType = (html = '') =>
  extractRoleHeaderMetadata(html).workplaceType || null

const extractEmploymentType = (html = '') =>
  extractRoleHeaderMetadata(html).employmentType || null

const extractSectionHtml = (html = '', heading) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h3[^>]*>\\s*${escapeRegex(heading)}\\s*<\\/h3>([\\s\\S]*?)(?=<h3[^>]*>|<footer\\b|$)`,
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

  return paragraphs.length > 0 ? paragraphs : (
    [stripTags(sectionHtml)].filter(Boolean)
  )
}

const appendParagraphSection = (parts, heading, lines) => {
  if (lines.length === 0) return
  if (parts.length > 0) parts.push('')
  parts.push(heading)
  parts.push(...lines)
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

const getLocationParts = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return { location: null, city: null, country: null }
  }

  if (/^India$/i.test(normalized)) {
    return { location: 'India', city: null, country: 'India' }
  }

  const match = normalized.match(INDIA_LOCATION_PATTERN)
  if (!match) {
    return {
      location: `${normalized}, India`,
      city: normalized,
      country: 'India',
    }
  }

  return {
    location: `${normalizeWhitespace(match[1])}, India`,
    city: normalizeWhitespace(match[1]),
    country: 'India',
  }
}

const findExperienceLine = (items) =>
  items.find((item) => /\b\d+(?:\+\s*)?(?:-\d+)?\s+years?\b/i.test(item) || /\b\d+-\d+\s+years?\b/i.test(item))
  || null

const findMinimumQualification = (items) =>
  items.find((item) => /\b(bachelor|master|degree)\b/i.test(item)) || null

const findPreferredQualification = (items) =>
  items.find((item) => /added advantage|preferred/i.test(item)) || null

export const extractCareerRoleUrls = (html = '') => uniqueUrls(
  extractAnchorUrls(html, CAREERS_URL).filter((url) => /^https:\/\/www\.amantra\.ai\/careers\/[a-z0-9\-()]+$/i.test(url)),
)

export const extractCareerRoleUrlsFromSitemap = (xml = '') => uniqueUrls(
  [...String(xml ?? '').matchAll(/https:\/\/www\.amantra\.ai\/careers\/[a-z0-9\-()]+/gi)]
    .map((match) => normalizeUrl(match[0])),
)

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return extractTitle(page) === 'AI Agents for Enterprise | Agentic AI Platform | Amantra'
    && extractCanonicalUrl(page) === normalizeUrl(HOMEPAGE_URL)
    && extractAnchorUrls(page, HOMEPAGE_URL).includes(CAREERS_URL)
    && /Amantra AI/i.test(page)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const description = extractMetaDescription(page) || ''

  return extractTitle(page) === 'Join Our AI Innovation Team | Amantra'
    && extractCanonicalUrl(page) === CAREERS_URL
    && description.includes('Join Amantra AI')
    && description.includes('Explore open roles')
    && /careers#jobs-openings/i.test(page)
    && extractCareerRoleUrls(page).length > 0
}

export const hasOfficialRoleDetailSignal = (html = '', roleUrl = null) => {
  const page = String(html ?? '')

  return extractTitle(page)?.startsWith('Amantra - ')
    && (!roleUrl || extractCanonicalUrl(page) === normalizeUrl(roleUrl))
    && Boolean(extractRoleTitle(page))
    && getLocationParts(extractLocation(page)).country === 'India'
    && WORKPLACE_TYPE_PATTERN.test(extractWorkplaceType(page) || '')
    && EMPLOYMENT_TYPE_PATTERN.test(extractEmploymentType(page) || '')
    && /<h3[^>]*>\s*Responsibilities\s*<\/h3>/i.test(page)
    && /<h3[^>]*>\s*Requirements\s*<\/h3>/i.test(page)
    && /<h3[^>]*>\s*Preferred Qualifications\s*<\/h3>/i.test(page)
    && /<h3[^>]*>\s*How to Apply\s*<\/h3>/i.test(page)
    && new RegExp(escapeRegex(APPLICATION_EMAIL), 'i').test(page)
}

export const extractRoleDetail = (html = '', roleUrl) => {
  const title = extractRoleTitle(html)
  const locationParts = getLocationParts(extractLocation(html))
  const responsibilities = extractSectionListItems(extractSectionHtml(html, 'Responsibilities'))
  const requirements = extractSectionListItems(extractSectionHtml(html, 'Requirements'))
  const preferredQualifications = extractSectionListItems(
    extractSectionHtml(html, 'Preferred Qualifications'),
  )
  const aboutLines = extractSectionParagraphs(extractSectionHtml(html, 'About us'))
  const howToApplyLines = extractSectionParagraphs(extractSectionHtml(html, 'How to Apply'))
    .map((line) => line.replace(/\s+/g, ' ').trim())
  const summary = extractMetaDescription(html)
  const experienceRequired = findExperienceLine(requirements) || findExperienceLine(preferredQualifications)
  const minimumQualification = findMinimumQualification(preferredQualifications)
  const preferredQualification = findPreferredQualification(preferredQualifications)

  const descriptionParts = []
  if (summary) descriptionParts.push(summary)
  appendParagraphSection(descriptionParts, 'About us', aboutLines)
  appendListSection(descriptionParts, 'Responsibilities', responsibilities)
  appendListSection(descriptionParts, 'Requirements', requirements)
  appendListSection(descriptionParts, 'Preferred Qualifications', preferredQualifications)
  appendListSection(descriptionParts, 'How to Apply', howToApplyLines)

  return {
    title,
    company: COMPANY,
    department: null,
    location: locationParts.location,
    city: locationParts.city,
    country: 'India',
    jobId: getRoleSlug(roleUrl),
    requisitionId: getRoleSlug(roleUrl),
    sourceUrl: normalizeUrl(roleUrl),
    applyUrl: APPLICATION_URL,
    employmentType: extractEmploymentType(html),
    workplaceType: extractWorkplaceType(html),
    experienceRequired,
    minimumQualification,
    preferredQualification,
    requiredSkills: requirements.filter((item) => item !== experienceRequired),
    postingDate: null,
    closingDate: null,
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

export const createAmantraScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = null,
  roleUrlsToFetch = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Amantra verified homepage no longer matches the trusted public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Amantra verified careers page no longer matches the trusted public surface')
    }

    const currentRoleUrls = extractCareerRoleUrls(careersHtml)
    const sitemapXml = await fetchText(SITEMAP_URL)
    const sitemapRoleUrls = extractCareerRoleUrlsFromSitemap(sitemapXml)
    const sitemapRoleUrlSet = new Set(sitemapRoleUrls)
    if (sitemapRoleUrls.length !== currentRoleUrls.length
      || currentRoleUrls.some((url) => !sitemapRoleUrlSet.has(url))) {
      throw new Error('Amantra verified sitemap role set no longer matches the trusted public surface')
    }

    const verifiedRoleUrlSet = new Set(currentRoleUrls)
    const requestedRoleUrls = roleUrlsToFetch || currentRoleUrls
    const selectedRoleUrls = requestedRoleUrls.filter((url) => verifiedRoleUrlSet.has(normalizeUrl(url)))

    if (selectedRoleUrls.length !== requestedRoleUrls.length) {
      throw new Error('Amantra requested role subset includes unverified role URLs')
    }

    const roleUrls = Number.isInteger(maxJobs) ? selectedRoleUrls.slice(0, maxJobs) : selectedRoleUrls
    const jobs = []

    for (const roleUrl of roleUrls) {
      const detailHtml = await fetchText(roleUrl)
      if (!hasOfficialRoleDetailSignal(detailHtml, roleUrl)) {
        throw new Error(`Amantra verified role detail no longer matches the trusted public surface: ${roleUrl}`)
      }

      const job = extractRoleDetail(detailHtml, roleUrl)
      jobs.push({
        ...job,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createAmantraScraper().run(options)

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
