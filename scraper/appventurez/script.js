import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { APPVENTUREZ_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
const stripTags = (value) => normalizeWhitespace(stripComments(value).replace(/<[^>]+>/g, ' '))

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

export const hasOfficialCareersSignals = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Current Openings')
    && /#career_form/i.test(String(html ?? ''))
    && normalized.includes('jobs@appventurez.com')
    && normalized.includes('careers@appventurez.com')
}

const extractRoleCards = (html = '') => {
  const sanitized = stripComments(html)
  const cards = []
  const cardPattern =
    /<div\b[^>]*class=["'][^"']*\bgrayBackOpenJobs\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bgrayBackOpenJobs\b|<div\b[^>]*id=["']career_form["']|$)/gi

  for (const match of sanitized.matchAll(cardPattern)) {
    const cardHtml = match[1]
    const titleMatch = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
    const experienceMatch = cardHtml.match(/<p[^>]*>\s*Experience\s*:\s*([\s\S]*?)<\/p>/i)
    const locationMatch = cardHtml.match(/<p[^>]*>\s*Location\s*:\s*([\s\S]*?)<\/p>/i)
    const hasApplyAnchor = /<a\b[^>]+href=["']#career_form["'][^>]*>/i.test(cardHtml)

    const title = normalizeWhitespace(titleMatch?.[1])
    const experienceRequired = normalizeWhitespace(experienceMatch?.[1])
    const city = normalizeWhitespace(locationMatch?.[1])

    if (!title || !experienceRequired || !city || !hasApplyAnchor) continue

    const requisitionId = `${slugify(title)}-${slugify(city)}`
    const sourceUrl = `${CAREERS_URL}#${requisitionId}`

    cards.push({
      title,
      experienceRequired,
      city,
      location: formatLocation(city),
      requisitionId,
      sourceUrl,
    })
  }

  return cards
}

export const createAppventurezScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignals(careersHtml)) {
      throw new Error('The verified Appventurez careers page no longer matches the trusted first-party openings surface')
    }

    return extractRoleCards(careersHtml).map((card) => ({
      title: card.title,
      company: COMPANY,
      location: card.location,
      city: card.city,
      country: 'India',
      sourceUrl: card.sourceUrl,
      applyUrl: null,
      link: card.sourceUrl,
      jobId: card.requisitionId,
      requisitionId: card.requisitionId,
      experienceRequired: card.experienceRequired,
      sourceExperienceRequired: card.experienceRequired,
      experienceRequiredProvenance: 'source',
      employmentType: null,
      remoteStatus: null,
      jobDescription: null,
      preserveExistingSourceDescription: true,
      skipPublicExperienceEnrichment: true,
      publicExperienceChecked: true,
      source: SOURCE,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createAppventurezScraper(options).run(options)

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
