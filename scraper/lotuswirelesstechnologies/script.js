import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { LOTUS_WIRELESS_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LOTUS_WIRELESS_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const APPLY_EMAIL = 'careers@lotuswireless.com'
export const COUNTRY = 'India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const JOB_CARD_PATTERN = /data-framer-name="([^"]*(?:Engineer|Developer|Manager|Analyst|Architect|Designer|Lead|Specialist|Technician)[^"]*)"[\s\S]*?data-framer-name="([^"]*(?:Employment|Internship|Contract)[^"]*)"[\s\S]*?<p[^>]*>([^<]+,\s*INDIA)<\/p>[\s\S]*?<p[^>]*>([A-Z][A-Z\s/&-]{3,})<\/p>/gi

const decodeHtmlEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;|\u2019/gi, "'")

const normalizeWhitespace = (value = '') =>
  decodeHtmlEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toTitleCase = (value = '') =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, char) => char.toUpperCase())

const slugify = (value = '') =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeEmploymentType = (value = '') => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value) || null
}

const normalizeDepartment = (value = '') => toTitleCase(value).replace(/\bAnd\b/g, 'and')

const normalizeLocation = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return COUNTRY

  const [city] = normalized.split(',')
  return `${toTitleCase(city)}, ${COUNTRY}`
}

const extractCity = (value = '') => normalizeLocation(value).split(',')[0] || null

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at Lotus Wireless\s*\|\s*Build Engineering Systems\s*<\/title>/i.test(rawHtml)
    && normalized.includes(`Apply at ${APPLY_EMAIL}`)
    && normalized.includes('Current Openings')
    && normalized.includes('Why Join LWT')
    && normalized.includes('Engineering-Led Environment')
}

export const extractOpeningCards = (html = '') => {
  const cards = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(JOB_CARD_PATTERN)) {
    const title = normalizeWhitespace(match[1])
    const employmentType = normalizeEmploymentType(match[2])
    const rawLocation = normalizeWhitespace(match[3])
    const department = normalizeDepartment(match[4])

    if (!title || !employmentType || !rawLocation || !department) {
      continue
    }

    const location = normalizeLocation(rawLocation)
    const key = `${title}|${location}|${employmentType}|${department}`.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    cards.push({
      title,
      employmentType,
      location,
      city: extractCity(rawLocation),
      department,
    })
  }

  return cards
}

export const hasPublicJobSignals = (html = '') => extractOpeningCards(html).length > 0

export const extractCareersOverview = (html = '') => {
  const source = String(html ?? '')
  const start = source.indexOf('Why Join LWT')
  const end = source.indexOf('Our Work Culture')
  if (start < 0) return null

  const slice = source.slice(start, end > start ? end : undefined)
  const normalized = normalizeWhitespace(slice)
  return normalized || null
}

export const createLotusWirelessTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Lotus Wireless careers page no longer matches the trusted first-party public surface')
    }

    const openings = extractOpeningCards(html)
    if (openings.length === 0) {
      return []
    }

    const jobDescription = extractCareersOverview(html)

    return openings.map((opening) => {
      const syntheticId = slugify(`${opening.title}-${opening.location}-${opening.department}`)

      return {
        title: opening.title,
        company: COMPANY,
        department: opening.department,
        location: opening.location,
        city: opening.city,
        country: COUNTRY,
        jobId: syntheticId,
        requisitionId: syntheticId,
        sourceUrl: CAREERS_URL,
        applyUrl: `mailto:${APPLY_EMAIL}`,
        employmentType: opening.employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: 'On-site',
      }
    })
  },
})

export const run = async (options = {}) => createLotusWirelessTechnologiesScraper().run(options)

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
