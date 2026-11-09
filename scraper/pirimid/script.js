import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { PIRIMID_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = PIRIMID_CATALOG.source
export const COMPANY = PIRIMID_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PIRIMID_CATALOG.officialBrandName
export const CAREERS_URL = PIRIMID_CATALOG.companyCareerPage
export const CAREERS_EMAIL = PIRIMID_CATALOG.officialCareersEmail
export const CAREERS_MAILTO_URL = `mailto:${CAREERS_EMAIL}`
export const VERIFIED_ON = PIRIMID_CATALOG.verifiedOn
export const PROVIDER_METADATA = PIRIMID_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
  .replace(/&mdash;|&#8212;|&#x2014;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const extractOpenPositionsSection = (html) =>
  String(html ?? '').match(
    /<div id=["']openPositions["'][^>]*>([\s\S]*?)(?:<!-- Open Positions Section End -->|<div class=["']container["']>\s*<h3>\s*<a href=["']mailto:careers@pirimidtech\.com|<\/body>)/i,
  )?.[1]
  || null

const normalizeLocationLabel = (value) => normalizeWhitespace(value)

const extractRemoteStatus = (locationLabel) => {
  const match = normalizeLocationLabel(locationLabel)?.match(/\[([^\]]+)\]/)
  const normalized = normalizeWhitespace(match?.[1])?.toLowerCase()
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const normalizeLocation = (locationLabel) => {
  const normalized = normalizeLocationLabel(locationLabel)
  if (!normalized) {
    return {
      locationLabel: null,
      location: null,
      city: null,
      country: 'India',
      remoteStatus: null,
    }
  }

  const city = normalizeWhitespace(normalized.replace(/\s*\[[^\]]+\]\s*/g, ''))
  return {
    locationLabel: normalized,
    location: city ? `${city}, India` : null,
    city: city || null,
    country: 'India',
    remoteStatus: extractRemoteStatus(normalized),
  }
}

const toAbsoluteAnchorUrl = (anchorId) => {
  const normalized = normalizeWhitespace(anchorId)?.replace(/^#/, '')
  return normalized ? new URL(`#${normalized}`, CAREERS_URL).toString() : CAREERS_URL
}

export const hasOfficialPirimidCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Pirimid Fintech\s*<\/title>/i.test(page)
    && /Interested\?\s*We're Hiring/i.test(decodeHtml(page))
    && /id=["']openPositions["']/i.test(page)
    && /Open Positions/i.test(page)
    && /careers@pirimidtech\.com/i.test(page)
}

export const extractListings = (html) => {
  const section = extractOpenPositionsSection(html)
  if (!section) {
    throw new Error('verified Pirimid careers page no longer exposes the trusted open positions section')
  }

  const jobs = []

  for (const match of section.matchAll(
    /<div class=["']panel panel-default["'][^>]*>[\s\S]*?<span class=["']pmd-card-title-text["']>\s*([\s\S]*?)\s*<\/span>\s*<br[^>]*>\s*<span class=["']pmd-card-subtitle-text["']>\s*([\s\S]*?)\s*<\/span>[\s\S]*?<div class=["']panel-body["']>\s*([\s\S]*?)\s*<\/div>[\s\S]*?<a[^>]+href=["']#([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const bodyHtml = match[3]
    const applyAnchorId = normalizeWhitespace(match[4])
    const openingsCount = Number.parseInt(
      normalizeWhitespace(
        bodyHtml.match(/No\.\s*of Openings:\s*<span>\s*(\d+)\s*<\/span>/i)?.[1] ?? '',
      ) || '',
      10,
    )

    const locationInfo = normalizeLocation(match[2])
    const requiredSkills = [...bodyHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)
    const jobDescription = stripTags(bodyHtml)
    const jobId = slugify(title)

    if (!title || !locationInfo.location || !applyAnchorId || !jobDescription || !jobId) {
      continue
    }

    jobs.push({
      title,
      locationLabel: locationInfo.locationLabel,
      location: locationInfo.location,
      city: locationInfo.city,
      country: locationInfo.country,
      openingsCount: Number.isFinite(openingsCount) ? openingsCount : null,
      sourceUrl: `${CAREERS_URL}#openPositions`,
      applyUrl: toAbsoluteAnchorUrl(applyAnchorId),
      jobId,
      requisitionId: jobId,
      jobDescription,
      requiredSkills,
      remoteStatus: locationInfo.remoteStatus,
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPirimidScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialPirimidCareersSignal(careersHtml)) {
      throw new Error('verified Pirimid careers page no longer matches the trusted first-party surface')
    }

    const listings = extractListings(careersHtml)
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings

    return selectedJobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: job.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      remoteStatus: job.remoteStatus,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPirimidScraper(options).run(options)

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
