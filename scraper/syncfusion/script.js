import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SYNCFUSION_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SYNCFUSION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const VERIFIED_JOB_DETAIL_URLS = [...PROVIDER_METADATA.verifiedJobDetailUrls]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const RELEVANT_JOB_PATH = /^\/careers\/[^/]+\/$/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u2019/g, "'")

const stripScriptsAndStyles = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  stripScriptsAndStyles(value).replace(/<[^>]+>/g, ' '),
)

const htmlToLines = (value) => decodeHtmlEntities(
  stripScriptsAndStyles(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|form)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const makeAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractFirstHeading = (html = '') => normalizeWhitespace(
  stripTags(String(html ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
)

const extractFieldValue = (lines, label) => {
  const lowerLabel = label.toLowerCase()
  const line = lines.find((entry) => entry.toLowerCase().startsWith(lowerLabel))
  if (!line) return null
  return normalizeWhitespace(line.slice(label.length))
}

const extractSectionLines = (lines, startLabel, endLabels = []) => {
  const startIndex = lines.findIndex((line) => line.toLowerCase() === startLabel.toLowerCase())
  if (startIndex < 0) return []

  const values = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endLabels.some((label) => line.toLowerCase() === label.toLowerCase())) break
    values.push(line)
  }

  return values
}

const extractLastPathSegment = (value) => {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const extractApplyUrl = (html = '', detailUrl) =>
  makeAbsoluteUrl(
    String(html ?? '').match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*(?:I(?:'|\u2019|&#8217;|&#x27;)?m Interested)\s*<\/a>/i)?.[1],
    detailUrl,
  ) || detailUrl

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const detectRemoteStatus = (html = '') =>
  /work-from-home option/i.test(stripTags(html) || '') ? 'Hybrid' : 'On-site'

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = (stripTags(html) || '').toLowerCase()

  return normalized.includes('syncfusion career')
    && normalized.includes('there are no current openings')
    && normalized.includes('relevant jobs')
    && normalized.includes('.net developer (fresher)')
    && normalized.includes('location: chennai, india')
    && normalized.includes("i'm interested")
}

export const getRelevantJobsSectionHtml = (html = '') => {
  const rawHtml = String(html ?? '')
  const lowerHtml = rawHtml.toLowerCase()
  const startIndex = lowerHtml.indexOf('relevant jobs')
  if (startIndex < 0) return null

  const endIndex = lowerHtml.indexOf('our recruitment process', startIndex)
  if (endIndex < 0) return rawHtml.slice(startIndex)

  return rawHtml.slice(startIndex, endIndex)
}

export const extractRelevantJobCards = (html = '') => {
  const cards = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = makeAbsoluteUrl(match[1], CAREERS_URL)
    if (!detailUrl || seen.has(detailUrl)) continue

    let parsedUrl
    try {
      parsedUrl = new URL(detailUrl)
    } catch {
      continue
    }

    if (parsedUrl.hostname.toLowerCase() !== 'www.syncfusion.com') continue
    if (!RELEVANT_JOB_PATH.test(parsedUrl.pathname)) continue
    if (parsedUrl.pathname.toLowerCase() === '/careers/') continue

    const anchorText = stripTags(match[2]) || ''
    if (!/location:/i.test(anchorText)) continue

    const title = normalizeWhitespace(
      anchorText
        .replace(/\s*location:\s*[\s\S]*$/i, '')
        .replace(/\s*i(?:'|\u2019)?m interested\s*$/i, ''),
    )
    const location = normalizeWhitespace(
      anchorText.match(/location:\s*([\s\S]*?)(?:i(?:'|\u2019)?m interested)?$/i)?.[1],
    )

    seen.add(detailUrl)
    cards.push({
      title,
      location,
      detailUrl,
    })
  }

  return cards
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const normalized = (stripTags(html) || '').toLowerCase()

  return normalized.includes('job description')
    && normalized.includes('skills required')
    && normalized.includes('location: chennai, india')
    && normalized.includes("i'm interested")
}

export const extractJobFromDetailHtml = (html = '', card = {}, { scrapedAt } = {}) => {
  const lines = htmlToLines(html)
  const detailUrl = makeAbsoluteUrl(card.detailUrl || CAREERS_URL, CAREERS_URL) || CAREERS_URL
  const title = extractFirstHeading(html) || normalizeWhitespace(card.title)
  const jobId = extractLastPathSegment(detailUrl)
  const location = extractFieldValue(lines, 'Location:')
  const description = normalizeWhitespace(
    extractSectionLines(lines, 'Job Description', [
      'Roles and Responsibilities',
      'Eligibility',
      'Share this Job Opening',
    ]).join(' '),
  )
  const qualifications = normalizeWhitespace(
    extractSectionLines(lines, 'Academic Qualifications', [
      'Experience',
      'Skills Required',
      'Share this Job Opening',
    ]).join(' '),
  )
  const requiredSkills = extractSectionLines(lines, 'Skills Required', [
    'Share this Job Opening',
    'On this page',
  ])

  if (!title || !jobId || !location) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: extractApplyUrl(html, detailUrl),
    employmentType: null,
    experienceRequired: extractFieldValue(lines, 'Experience:'),
    minimumQualification: qualifications,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: detectRemoteStatus(html),
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createSyncfusionScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Syncfusion careers page no longer matches the known public surface')
    }

    const relevantJobsSectionHtml = getRelevantJobsSectionHtml(careersHtml)
    if (!relevantJobsSectionHtml) {
      throw new Error('The verified Syncfusion careers page no longer exposes the Relevant Jobs section')
    }

    const cards = extractRelevantJobCards(relevantJobsSectionHtml)
    if (cards.length === 0) {
      throw new Error('The verified Syncfusion careers page no longer exposes the expected same-domain Relevant Jobs detail links')
    }

    const jobs = []

    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`The verified Syncfusion job detail page no longer matches the known public surface: ${card.detailUrl}`)
      }

      const job = extractJobFromDetailHtml(detailHtml, card, {
        scrapedAt: (overrideNow || now)(),
      })

      if (job) {
        jobs.push({
          ...job,
          companyCareerPage: CAREERS_URL,
          companyDomain: 'syncfusion.com',
          atsPlatform: 'official-careers-page-relevant-job-details',
        })
      }
    }

    if (jobs.length === 0) {
      throw new Error('Syncfusion verified Relevant Jobs detail pages no longer return normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createSyncfusionScraper().run(options)

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
