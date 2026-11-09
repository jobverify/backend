import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import TIMES_INTERNET_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TIMES_INTERNET_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const VERIFIED_JOB_DETAIL_URLS = [...PROVIDER_METADATA.verifiedJobDetailUrls]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

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
  stripTags(String(html ?? '').match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]),
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

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const formatLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractApplyUrl = (html = '', detailUrl) =>
  makeAbsoluteUrl(
    String(html ?? '').match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply now\s*<\/a>/i)?.[1],
    detailUrl,
  ) || detailUrl

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (stripTags(rawHtml) || '').toLowerCase()

  return normalized.includes('job category')
    && normalized.includes('all categories')
    && normalized.includes('location')
    && normalized.includes('all locations')
    && normalized.includes('job type')
    && normalized.includes('all types')
}

export const extractJobCards = (html = '') => {
  const cards = []

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']*\/careers\/job-detail\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = makeAbsoluteUrl(match[1], CAREERS_URL)
    const text = stripTags(match[2]) || ''
    const title = normalizeWhitespace(text.split(/LOCATION:/i)[0])
    const location = normalizeWhitespace(text.match(/LOCATION:\s*(.+?)(?:\s+BUSINESS:|\s+EXPERIENCE:|$)/i)?.[1])
    const business = normalizeWhitespace(text.match(/BUSINESS:\s*(.+?)(?:\s+EXPERIENCE:|$)/i)?.[1])
    const experience = normalizeWhitespace(text.match(/EXPERIENCE:\s*(.+)$/i)?.[1])

    if (!title || !detailUrl) continue

    cards.push({
      title,
      location,
      business,
      experience,
      detailUrl,
    })
  }

  return cards
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (stripTags(rawHtml) || '').toLowerCase()

  return normalized.includes('job description')
    && (
      normalized.includes('about times internet')
      || normalized.includes('about times limited')
      || normalized.includes('about the company')
      || /class=["'][^"']*\bjob-description\b[^"']*["']/.test(rawHtml)
    )
    && normalized.includes('apply now')
    && /<title>\s*.+job at times internet\b/i.test(rawHtml)
}

export const extractJobFromDetailHtml = (html = '', card = {}, { scrapedAt } = {}) => {
  const lines = htmlToLines(html)
  const detailUrl = makeAbsoluteUrl(card.detailUrl || CAREERS_URL, CAREERS_URL) || CAREERS_URL
  const title = extractFirstHeading(html) || normalizeWhitespace(card.title)
  const jobId = extractLastPathSegment(detailUrl)
  const headingLocation = extractFieldValue(lines, 'Location:')
    || extractFieldValue(lines, 'Job Location:')
    || card.location
  const roleDescription = normalizeWhitespace(
    extractSectionLines(lines, 'About the Role', [
      'Work Responsibilities',
      'Desired Candidate Profile',
      'Skills, Experience & Expertise:',
      'Eligibility:',
      'Educational qualification:',
    ]).join(' '),
  )
  const unstructuredDescription = stripTags(
    String(html ?? '').match(/<div\b[^>]*class=["'][^"']*\bjob-description\b[^"']*["'][^>]*>([\s\S]*?)(?=<footer\b|<section\b[^>]*>\s*<footer\b|$)/i)?.[1] || '',
  )?.replace(/^JOB DESCRIPTION\s*/i, '') || null
  const workResponsibilities = extractSectionLines(lines, 'Work Responsibilities', [
    'Skills, Experience & Expertise:',
    'Eligibility:',
    'Desired Candidate Profile',
    'Educational qualification:',
  ])
  const qualifications = normalizeWhitespace([
    ...extractSectionLines(lines, 'Eligibility:', [
      'Educational qualification:',
      'Times Internet 2019, All Rights Reserved',
    ]),
    ...extractSectionLines(lines, 'Desired Candidate Profile', [
      'Educational qualification:',
      'Times Internet 2019, All Rights Reserved',
    ]),
    extractFieldValue(lines, 'Educational qualification:'),
  ].filter(Boolean).join(' '))
  const requiredSkills = extractSectionLines(lines, 'Skills, Experience & Expertise:', [
    'Eligibility:',
    'Desired Candidate Profile',
    'Educational qualification:',
  ])

  if (!title || !jobId) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(card.business),
    location: formatLocation(headingLocation),
    city: extractCity(formatLocation(headingLocation)),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: extractApplyUrl(html, detailUrl),
    employmentType: null,
    experienceRequired: extractFieldValue(lines, 'Experience:')
      || extractFieldValue(lines, 'EXPERIENCE')
      || normalizeWhitespace(card.experience),
    minimumQualification: qualifications || null,
    preferredQualification: null,
    requiredSkills: requiredSkills.length > 0 ? requiredSkills : workResponsibilities,
    postingDate: null,
    closingDate: null,
    jobDescription: roleDescription || normalizeWhitespace(workResponsibilities.join(' ')) || unstructuredDescription,
    remoteStatus: 'On-site',
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createTimesInternetScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Times Internet careers page no longer matches the known public surface')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('The verified Times Internet careers page no longer exposes the expected same-domain job detail links')
    }

    const jobs = []

    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`The verified Times Internet job detail page no longer matches the known public surface: ${card.detailUrl}`)
      }

      const job = extractJobFromDetailHtml(detailHtml, card, {
        scrapedAt: (overrideNow || now)(),
      })

      if (job) {
        jobs.push({
          ...job,
          companyCareerPage: CAREERS_URL,
          companyDomain: 'timesinternet.in',
          atsPlatform: 'official-company-careers',
        })
      }
    }

    if (jobs.length === 0) {
      throw new Error('Times Internet verified detail pages no longer return normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createTimesInternetScraper().run(options)

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
