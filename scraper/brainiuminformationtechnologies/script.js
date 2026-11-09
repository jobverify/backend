import path from 'node:path'
import { fileURLToPath } from 'node:url'

import BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OPEN_POSITIONS_URL = `${OFFICIAL_CAREERS_URL}#open-positions`

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialBrainiumCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Careers at Brainium \| Join Our Team/i.test(page)
    && /Open Positions/i.test(normalized)
    && /Kolkata(?: Headquarters)?(?:, India)?/i.test(normalized)
    && (
      /Build AI-First\. Work with people who care about craft\./i.test(normalized)
      || /Roles we're hiring for right now\./i.test(normalized)
    )
}

export const hasCloudflareBlockSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Attention Required!\s*\|\s*Cloudflare\s*<\/title>/i.test(page)
    && normalized.includes('Please enable cookies.')
    && normalized.includes('Sorry, you have been blocked')
    && normalized.includes('You are unable to access brainiuminfotech.com')
    && normalized.includes('Cloudflare Ray ID')
}

export const isVerifiedCloudflareBlockedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)
  return Number(page.status) === 403
    && finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && hasCloudflareBlockSignal(getPageHtml(page))
}

const normalizeRoleUrl = (value) => {
  if (!value || value === '#') return OPEN_POSITIONS_URL

  try {
    return new URL(value, OFFICIAL_CAREERS_URL).toString()
  } catch {
    return OPEN_POSITIONS_URL
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return /^(full-time|part-time|contract|temporary|internship|freelance)$/i.test(normalized)
    ? normalized
    : null
}

const extractLegacyRoleCards = (html = '') => {
  const roles = []

  for (const match of String(html ?? '').matchAll(/<article\b[^>]*class=["'][^"']*\bbrainium-role-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const articleHtml = match[1]
    const title = normalizeWhitespace(articleHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const department = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bdepartment\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const skillsText = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bskills\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const locationText = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\blocation\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const employmentType = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bemployment-type\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const applyUrl = normalizeRoleUrl(normalizeWhitespace(articleHtml.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1]))
    const city = locationText || null

    if (!title || !department || !locationText || !employmentType || !applyUrl) continue

    roles.push({
      title,
      department,
      skills: String(skillsText ?? '')
        .split('|')
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean),
      location: `${locationText}, India`,
      city,
      country: 'India',
      employmentType,
      applyUrl,
      sourceUrl: applyUrl,
      jobId: slugify(new URL(applyUrl).hash.replace(/^#apply-/, '') || title),
    })
  }

  return roles
}

const extractModernRoleCards = (html = '') => {
  const roles = []

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*class=["'][^"']*\bcareers-job-card\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const cardHtml = match[1]
    const department = normalizeWhitespace(cardHtml.match(/class=["'][^"']*\bcareers-job-dept\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const title = normalizeWhitespace(cardHtml.match(/class=["'][^"']*\bcareers-job-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
    const locationMeta = [...cardHtml.matchAll(
      /<div\b[^>]*class=["'][^"']*\bcareers-job-meta\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    )]
      .flatMap((metaMatch) => [...metaMatch[1].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)])
      .map((metaValue) => normalizeWhitespace(metaValue[1]))
      .filter(Boolean)
    const skills = [...cardHtml.matchAll(/<div\b[^>]*class=["'][^"']*\bcareers-job-tags\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
      .flatMap((tagsMatch) => [...tagsMatch[1].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)])
      .map((skillMatch) => normalizeWhitespace(skillMatch[1]))
      .filter(Boolean)
    const city = locationMeta[0] || null
    const employmentType = normalizeEmploymentType(locationMeta[1])

    if (!title || !department || !city) continue

    roles.push({
      title,
      department,
      skills,
      location: `${city}, India`,
      city,
      country: 'India',
      employmentType,
      applyUrl: OPEN_POSITIONS_URL,
      sourceUrl: OPEN_POSITIONS_URL,
      jobId: slugify(title),
    })
  }

  return roles
}

export const extractRoleCards = (html = '') => {
  const modernRoles = extractModernRoleCards(html)
  if (modernRoles.length > 0) {
    return modernRoles
  }

  return extractLegacyRoleCards(html)
}

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  headers: {},
  html: await fetchText(url),
})

export const createBrainiumInformationTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText, fetchPage } = {}) {
    const effectiveFetchPage = typeof fetchPage === 'function'
      ? fetchPage
      : typeof fetchText === 'function'
        ? createFetchPageFromText(fetchText)
        : defaultFetchPage

    const careersPage = await effectiveFetchPage(OFFICIAL_CAREERS_URL)

    const status = Number(careersPage.status)
    if ([401, 403, 429].includes(status) || hasCloudflareBlockSignal(getPageHtml(careersPage))) {
      const error = new Error(`Brainium Information Technologies careers access denied (HTTP ${status}); inventory unknown`)
      error.status = status
      throw error
    }
    if (status !== 200) throw new Error(`Brainium Information Technologies careers HTTP ${status}; inventory unknown`)

    const careersHtml = getPageHtml(careersPage)

    if (!hasOfficialBrainiumCareersSignals(careersHtml)) {
      throw new Error('Brainium Information Technologies verified official careers page no longer matches the verified public surface')
    }

    const roles = extractRoleCards(careersHtml)
    if (roles.length === 0) {
      throw new Error('Brainium Information Technologies verified careers surface no longer exposes open roles')
    }

    return roles.map((role) => ({
      title: role.title,
      company: COMPANY_NAME,
      department: role.department,
      location: role.location,
      city: role.city,
      country: role.country,
      jobId: role.jobId,
      requisitionId: null,
      sourceUrl: role.sourceUrl,
      applyUrl: role.applyUrl,
      employmentType: role.employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: role.skills,
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
      source: SOURCE,
      link: role.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createBrainiumInformationTechnologiesScraper(options).run(options)

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
