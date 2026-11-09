import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TRANSFORM_HUB_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TRANSFORM_HUB_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToText = (value) =>
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/li|\/ul|\/ol|\/h[1-6]|\/form|\/button)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|section|article|main|li|ul|ol|h[1-6]|form|button)\b[^>]*>/gi, '\n')
      .replace(/<\/a>/gi, '')
      .replace(/<a\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )

const stripTags = (value) => normalizeWhitespace(htmlToText(value))

const htmlToLines = (html) =>
  String(htmlToText(html) || '')
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isIndiaRelevantLocation = (value) => /pan india|navi mumbai|\bindia\b/i.test(value || '')

const formatLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/pan india/i.test(normalized)) return normalized
  if (/\bindia\b/i.test(normalized)) return normalized
  if (/^navi mumbai$/i.test(normalized)) return 'Navi Mumbai, India'
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/pan india/i.test(normalized)) return 'Pan India'
  return normalized.split(',')[0]?.trim() || normalized
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const text = (stripTags(html) || '').toLowerCase()
  const hasVerifiedRole = [
    'devsecops - senior engineer',
    'data analyst',
    'zoho developer',
  ].some((role) => text.includes(role))

  return text.includes('careers')
    && text.includes('transforming careers')
    && text.includes('current openings')
    && text.includes('if you can understand accountability')
    && hasVerifiedRole
}

const isSectionHeading = (value) => /^(current openings|responsibilities|skills|benefits of working at transformhub)$/i.test(value || '')

const isPotentialRoleTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || isSectionHeading(normalized)) return false
  return /^[A-Z0-9/&(), +.-]{4,}$/.test(normalized)
}

export const extractInlineJobs = (
  html,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const lines = htmlToLines(html)
  const openingsIndex = lines.findIndex((line) => /^current openings$/i.test(line))
  if (openingsIndex === -1) return []

  const jobs = []

  for (let index = openingsIndex + 1; index < lines.length; index += 1) {
    const title = lines[index]
    const nextLine = lines[index + 1] || null
    if (!isPotentialRoleTitle(title) || !nextLine || isSectionHeading(nextLine)) continue

    const rawLocation = normalizeWhitespace(nextLine.replace(/^location:\s*/i, ''))
    const descriptionLines = []

    index += 2
    while (index < lines.length) {
      const candidate = lines[index]
      const candidateNext = lines[index + 1] || null

      if (/^benefits of working at transformhub$/i.test(candidate)) {
        index -= 1
        break
      }

      if (isPotentialRoleTitle(candidate) && candidateNext && !isSectionHeading(candidateNext)) {
        index -= 1
        break
      }

      if (!isSectionHeading(candidate)) {
        descriptionLines.push(candidate)
      }
      index += 1
    }

    if (!isIndiaRelevantLocation(rawLocation)) {
      continue
    }

    const location = formatLocation(rawLocation)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      link: CAREERS_URL,
      applyUrl: CAREERS_URL,
      sourceUrl: CAREERS_URL,
      source: SOURCE,
      jobId: slugify(`${title}-${location}`),
      requisitionId: null,
      employmentType: null,
      experienceRequired: null,
      jobDescription: normalizeWhitespace(descriptionLines.join(' ')),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      remoteStatus: null,
      scrapedAt,
    })
  }

  return jobs
}

export const createTransformHubScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('TransformHub verified TransformHub careers page no longer matches the official first-party surface')
    }

    const jobs = extractInlineJobs(careersHtml, {
      scrapedAt: now(),
    }).map((job) => ({
      ...job,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))

    if (jobs.length === 0) {
      throw new Error('TransformHub verified first-party careers page no longer exposes normalized inline India jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createTransformHubScraper(options).run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
