import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NITOR_INFOTECH_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPENINGS_URL = PROVIDER_METADATA.jobsBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const TRUSTED_CAREERS_ORIGIN = new URL(CAREERS_URL).origin
const TRUSTED_OPENINGS_PATH = new URL(OPENINGS_URL).pathname.replace(/\/+$/, '') || '/'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n+/g, '\n')
  .trim()

const normalizeText = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const splitSkills = (value) => normalizeText(value)
  ?.split(',')
  .map((skill) => normalizeText(skill))
  .filter(Boolean)
  || []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeTrustedOpeningsUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''), CAREERS_URL)
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/'
    if (url.origin !== TRUSTED_CAREERS_ORIGIN || normalizedPath !== TRUSTED_OPENINGS_PATH) {
      return null
    }

    return `${url.origin}${normalizedPath}`
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => /india/i.test(String(value ?? '')) && !/\bcanada|united states|usa\b/i.test(String(value ?? ''))

const extractCity = (location) => normalizeText(String(location ?? '').split(',')[0])

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Careers at Nitor Infotech, an Ascendion Company/i.test(text)
    && extractOpeningsUrl(page) === OPENINGS_URL
}

export const extractOpeningsUrl = (html = '') =>
  [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => normalizeTrustedOpeningsUrl(match[1]))
    .find((url) => url === OPENINGS_URL) ?? null

export const hasOpeningsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Work With Us/i.test(text)
    && /class=["'][^"']*\bsec-part\b/i.test(page)
    && /class=["'][^"']*\bjob-title\b/i.test(page)
}

export const extractListingCards = (html = '') =>
  [...String(html ?? '').matchAll(
    /<div[^>]*class=["'][^"']*\bsec-part\b[^"']*["'][^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi,
  )]
    .map((match) => {
      const rawId = normalizeText(match[1])
      const cardHtml = match[2]
      const location = normalizeText(cardHtml.match(/<p[^>]*class=["'][^"']*\bjob-location\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null)
      if (!isIndiaLocation(location)) return null

      const title = normalizeText(cardHtml.match(/<h6[^>]*class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i)?.[1] ?? null)
      const jobId = rawId?.replace(/-section$/i, '') || slugify(title)
      if (!title || !jobId) return null

      return {
        title,
        location,
        city: extractCity(location),
        jobId,
        requisitionId: jobId,
        experienceRequired: normalizeText(cardHtml.match(/<p[^>]*class=["'][^"']*\bjob-experience\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null),
        requiredSkills: splitSkills(cardHtml.match(/<p[^>]*class=["'][^"']*\bjob-skill\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null),
        jobDescription: normalizeText(cardHtml.match(/<input[^>]*id=["']desc-text["'][^>]*value=["']([^"']*)["']/i)?.[1] ?? null),
      }
    })
    .filter(Boolean)

export const createNitorInfotechScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Nitor Infotech verified careers page no longer matches the trusted first-party surface')
    }

    const openingsUrl = extractOpeningsUrl(careersHtml)
    if (openingsUrl !== OPENINGS_URL) {
      throw new Error('Nitor Infotech verified careers page no longer resolves to the trusted openings page')
    }

    const openingsHtml = await fetchText(openingsUrl)
    if (!hasOpeningsPageSignal(openingsHtml)) {
      throw new Error('Nitor Infotech verified openings page no longer matches the trusted public jobs surface')
    }

    const jobs = extractListingCards(openingsHtml)
    if (jobs.length === 0) {
      throw new Error('Nitor Infotech verified openings page no longer exposes trusted public jobs cards')
    }

    return jobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: job.city,
      country: 'India',
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: OPENINGS_URL,
      applyUrl: OPENINGS_URL,
      employmentType: null,
      experienceRequired: job.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: job.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: OPENINGS_URL,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNitorInfotechScraper(options).run()

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
