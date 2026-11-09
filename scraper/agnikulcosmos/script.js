import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { AGNIKUL_COSMOS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AGNIKUL_COSMOS_CATALOG.source
export const COMPANY = AGNIKUL_COSMOS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AGNIKUL_COSMOS_CATALOG.officialBrandName
export const VERIFIED_ON = AGNIKUL_COSMOS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AGNIKUL_COSMOS_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AGNIKUL_COSMOS_CATALOG
export const HOMEPAGE_URL = AGNIKUL_COSMOS_CATALOG.homepageUrl
export const CAREERS_URL = AGNIKUL_COSMOS_CATALOG.companyCareerPage
export const APPLICATION_EMAIL = AGNIKUL_COSMOS_CATALOG.applicationEmail
export const APPLICATION_URL = AGNIKUL_COSMOS_CATALOG.applicationUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalizeCity(normalized.split(',')[0]?.trim() || normalized)
}

const normalizeApplyUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /^mailto:/i.test(normalized)
    ? `mailto:${normalized.replace(/^mailto:/i, '').toLowerCase()}`
    : normalized
}

const getRolesSection = (html) => String(html ?? '').match(
  /<h2\b[^>]*>\s*Job Openings\s*<\/h2>([\s\S]*?)<h2\b[^>]*>\s*This is #lifeatAgnikul\s*<\/h2>/i,
)?.[1] || null

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Join Agnikul Cosmos \|\s*Careers in Space Technology\s*&amp;\s*Innovation\s*<\/title>/i.test(page)
    && /<h1\b[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /<h2\b[^>]*>\s*Job Openings\s*<\/h2>/i.test(page)
    && /Would you like to be part of the team\?/i.test(page)
    && /To apply,\s*send a mail to/i.test(page)
    && /mailto:humancapital@agnikul\.in/i.test(page)
    && getRolesSection(page) !== null
}

const TITLE_PATTERN =
  /<h2\b[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>\s*([^<]+?)\s*<\/h2>/gi
const METADATA_PATTERN =
  /<h3\b[^>]*class=["'][^"']*elementor-icon-box-title[^"']*["'][^>]*>\s*<span[^>]*>\s*([^<]+?)\s*<\/span>\s*<\/h3>/gi

export const extractOpenPositions = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('Agnikul Cosmos careers page no longer matches the verified Agnikul Cosmos careers surface')
  }

  const rolesSection = getRolesSection(html)
  if (!rolesSection) {
    throw new Error('Agnikul Cosmos careers page no longer exposes the verified public role-card section')
  }

  const titles = [...rolesSection.matchAll(TITLE_PATTERN)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
  const metadataValues = [...rolesSection.matchAll(METADATA_PATTERN)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
  const applyUrls = [...rolesSection.matchAll(/href=["'](mailto:[^"']+)["']/gi)]
    .map((match) => normalizeApplyUrl(match[1]))
    .filter(Boolean)

  if (titles.length === 0 || metadataValues.length !== titles.length * 2 || !applyUrls.includes(APPLICATION_URL)) {
    throw new Error('Agnikul Cosmos careers page no longer exposes the verified public role-card structure')
  }

  return titles.map((title, index) => {
    const location = normalizeLocation(metadataValues[index * 2])
    const employmentType = normalizeWhitespace(metadataValues[index * 2 + 1])
    const city = deriveCity(location)
    const identity = slugify(`${title}-${location}`)

    if (!location || !employmentType || !identity) {
      throw new Error('Agnikul Cosmos careers page no longer exposes complete public role-card metadata')
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state: null,
      country: 'India',
      jobId: `${SOURCE}-${identity}`,
      requisitionId: `${SOURCE}-${identity}`,
      sourceUrl: CAREERS_URL,
      applyUrl: APPLICATION_URL,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    }
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAgnikulCosmosScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    return extractOpenPositions(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createAgnikulCosmosScraper().run(options)

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
