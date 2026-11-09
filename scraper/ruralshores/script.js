import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import RURALSHORES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FOREIGN_LOCATION_PATTERN =
  /\b(singapore|uae|united arab emirates|dubai|united states|usa|canada|united kingdom|uk|germany|france|poland|ireland|australia|netherlands|malaysia|indonesia|japan|vietnam)\b/i

export const PROVIDER_METADATA = RURALSHORES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const LEGACY_MISSING_ROUTE_URLS = [
  'https://www.ruralshores.com/career.html',
  'https://www.ruralshores.com/careers',
  'https://www.ruralshores.com/career',
  'https://www.ruralshores.com/jobs',
]

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextValue = decoded
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')

    if (nextValue === decoded) break
    decoded = nextValue
  }

  return decoded
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2022]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const parseCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return parts[0] || null
}

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return false
  if (FOREIGN_LOCATION_PATTERN.test(normalized)) return false
  return true
}

const extractMetaValues = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)

const extractTagValues = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)

const extractVisibleReferenceId = (metaValues = []) =>
  metaValues
    .map((value) => value.match(/\bID:\s*(RSBS\/REC\/\d+)/i)?.[1] || null)
    .find(Boolean) || null

export const hasOfficialRuralShoresCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const isLegacyJobBoard =
    extractTitle(page) === 'Career - RuralShores'
    && /Current Openings/i.test(page)
    && /class=["'][^"']*\bjobcard\b/i.test(page)
    && /mailto:careers@ruralshores\.com/i.test(page)
    && />\s*careers@ruralshores\.com\s*</i.test(page)
  const isCurrentTalentNetworkShell =
    extractTitle(page) === 'Careers - RuralShores'
    && /Build a Rewarding Career with RuralShores/i.test(page)
    && /Join Our Talent Network/i.test(page)
    && /href="\/career\.aspx"/i.test(page)
    && /mailto:careers@ruralshores\.com/i.test(page)
    && />\s*careers@ruralshores\.com\s*</i.test(page)

  return isLegacyJobBoard || isCurrentTalentNetworkShell
}

export const extractVisibleJobCards = (html = '') => {
  const seenJobIds = new Set()
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<article\b[^>]*class=["'][^"']*\bjobcard\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
  )) {
    const articleHtml = match[0]
    const bodyHtml = match[1]
    const slug = normalizeWhitespace(articleHtml.match(/data-job-id=["']([^"']+)["']/i)?.[1])
    const title = normalizeWhitespace(
      bodyHtml.match(/<h3\b[^>]*class=["'][^"']*\bjobcard__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1],
    )
    const metaHtml = bodyHtml.match(/<div\b[^>]*class=["'][^"']*\bjobcard__meta\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
    const metaValues = extractMetaValues(metaHtml)
    const experienceRequired = metaValues.find((value) => /\byears?\b/i.test(value)) || null
    const requisitionId = extractVisibleReferenceId(metaValues)
    const location = metaValues.find(
      (value) => value !== experienceRequired && value !== `ID: ${requisitionId}` && !/\bID:\b/i.test(value),
    ) || null
    const jobDescription = normalizeWhitespace(
      bodyHtml.match(/class=["'][^"']*\bjobcard__desc\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i)?.[1],
    )
    const tagsHtml = bodyHtml.match(/<div\b[^>]*class=["'][^"']*\bjobcard__tags\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
    const requiredSkills = extractTagValues(tagsHtml)
    const applyUrl = normalizeWhitespace(bodyHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1])
    const sourceUrl = slug ? `${OFFICIAL_CAREERS_URL}#${slug}` : OFFICIAL_CAREERS_URL
    const jobId = requisitionId || slug

    if (!slug || !title || !location || !jobId || seenJobIds.has(jobId)) continue
    if (!isIndiaLocation(location)) continue

    seenJobIds.add(jobId)
    jobs.push({
      slug,
      title,
      location,
      city: parseCity(location),
      country: 'India',
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      experienceRequired,
      jobDescription,
      requiredSkills,
    })
  }

  return jobs
}

export const createRuralShoresScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialRuralShoresCareersSignals(careersHtml)) {
      throw new Error('RuralShores verified official careers page no longer matches the verified public surface')
    }

    const jobs = extractVisibleJobCards(careersHtml)
    if (jobs.length === 0) {
      return []
    }

    const limitedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return limitedJobs.map((job) => ({
      title: job.title,
      company: COMPANY_NAME,
      department: null,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: job.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: job.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createRuralShoresScraper(options).run(options)

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
