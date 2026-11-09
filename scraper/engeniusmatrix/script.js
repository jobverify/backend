import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'engeniusmatrix'
export const COMPANY = 'EnGenius Matrix'
export const HOME_URL = 'https://www.engeniusmatrix.com/'
export const CAREERS_URL = 'https://www.engeniusmatrix.com/careers/'
export const JOBS_API_URL = 'https://www.engeniusmatrix.com/wp-json/wp/v2/job'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_JOB_URL_PATTERN = /^https:\/\/www\.engeniusmatrix\.com\/job\/[^/?#]+\/?$/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&lsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/[\u00a0]+/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2022\u25cf\u25e6\u2023\u00b7\uf0b7]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const absolutizeUrl = (value, base = HOME_URL) => {
  try {
    return new URL(value, base).href
  } catch {
    return null
  }
}

const toIsoDate = (value, { assumeUtc = false } = {}) => {
  if (!value) return null

  const normalizedValue = assumeUtc && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(value))
    ? `${value}Z`
    : value

  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const cleanItemText = (value) => normalizeWhitespace(
  String(value ?? '').replace(/^[\s\u2022\u25cf\u25e6\u2023\u00b7\uf0b7-]+/u, ''),
)

const extractParagraphItems = (html) => [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => cleanItemText(stripTags(match[1])))
  .filter(Boolean)

const extractSections = (html) => [...String(html ?? '').matchAll(
  /<div class="detailsBox[^"]*"[\s\S]*?<h4>\s*([\s\S]*?)\s*<\/h4>\s*<div>([\s\S]*?)<\/div>\s*<\/div>/gi,
)]
  .map((match) => ({
    heading: normalizeWhitespace(match[1]),
    text: stripTags(match[2]),
    items: extractParagraphItems(match[2]),
  }))
  .filter((section) => section.heading && section.text)

const findSection = (sections, headingPattern) =>
  sections.find((section) => headingPattern.test(section.heading))

const buildLocationFromText = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const match = normalized.match(/\bBased in\s+([A-Za-z][A-Za-z\s]+?)(?:,\s*India)?(?:,|\.)/i)
  if (!match) return null

  const city = normalizeCity(normalizeWhitespace(match[1]))
  return city ? `${city}, India` : `${normalizeWhitespace(match[1])}, India`
}

const inferRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('wfh')) return 'Remote'
  return 'On-site'
}

const buildJobDescription = (sections) => sections
  .map((section) => `${section.heading}: ${section.text}`)
  .join('\n\n') || null

const extractExperienceRequired = (sections) => {
  const candidateText = findSection(sections, /^Basic Qualifications$/i)?.text
    || sections.map((section) => section.text).join(' ')

  return normalizeWhitespace(
    candidateText.match(/(Minimum of [^.]*experience[^.]*\.)/i)?.[1]
      || candidateText.match(/(Minimum [^.]*experience[^.]*\.)/i)?.[1],
  )
}

const isOfficialJobLink = (value) => OFFICIAL_JOB_URL_PATTERN.test(String(value ?? ''))

export const buildListingsApiUrl = (page = 1, pageSize = 100) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('_fields', 'id,date_gmt,link,title,job-category')
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const buildJobDetailApiUrl = (id) => {
  const url = new URL(`${JOBS_API_URL}/${id}`)
  url.searchParams.set('_fields', 'id,link,title,content')
  return url.toString()
}

const hasOfficialJobRecord = (record) =>
  Number.isInteger(record?.id)
  && isOfficialJobLink(record?.link)
  && Boolean(normalizeWhitespace(record?.title?.rendered))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Home - Engenius Matrix\s*<\/title>/i.test(page)
    && /Engineering Precision/i.test(page)
    && /debarpan@engeniusmatrix\.com/i.test(page)
    && /href="https:\/\/www\.engeniusmatrix\.com\/careers\/?"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers - Engenius Matrix\s*<\/title>/i.test(page)
    && /Brilliant minds/i.test(page)
    && /Join EnGenius Matrix and shape the future/i.test(page)
    && /id=['"]jobsCategory['"]/i.test(page)
}

export const isOfficialListingsPayload = (records) =>
  Array.isArray(records) && records.every(hasOfficialJobRecord)

export const hasOfficialJobDetailRecord = (record) => {
  const content = String(record?.content?.rendered ?? '')

  return Number.isInteger(record?.id)
    && isOfficialJobLink(record?.link)
    && Boolean(normalizeWhitespace(record?.title?.rendered))
    && /class="detailsBox/i.test(content)
    && /id=["']applicationForm["']/i.test(content)
    && /wpcf7/i.test(content)
    && /Apply now/i.test(content)
}

export const extractJobFromApiRecord = (listingRecord, detailRecord) => {
  if (!hasOfficialJobRecord(listingRecord) || !hasOfficialJobDetailRecord(detailRecord)) {
    throw new Error('Response is not the verified EnGenius Matrix job detail record')
  }

  const sourceUrl = absolutizeUrl(listingRecord.link || detailRecord.link)
  const title = normalizeWhitespace(listingRecord.title?.rendered || detailRecord.title?.rendered)
  const contentHtml = detailRecord.content?.rendered ?? ''
  const sections = extractSections(contentHtml)
  const descriptionSection = findSection(sections, /^Description$/i)
  const basicQualificationsSection = findSection(sections, /^Basic Qualifications$/i)
  const preferredQualificationsSection = findSection(sections, /^Preferred Qualifications$/i)
  const location = buildLocationFromText(descriptionSection?.text || buildJobDescription(sections))
  const city = location ? normalizeCity(location.replace(/,\s*India$/i, '')) : null
  const applyUrl = sourceUrl ? `${sourceUrl.replace(/#.*$/, '')}#applicationForm` : null

  if (!sourceUrl || !title || sections.length === 0) {
    throw new Error('Response is not the verified EnGenius Matrix job detail record')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: 'India',
    jobId: String(detailRecord.id ?? listingRecord.id),
    requisitionId: String(detailRecord.id ?? listingRecord.id),
    sourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: extractExperienceRequired(sections),
    minimumQualification: basicQualificationsSection?.text || null,
    preferredQualification: preferredQualificationsSection?.text || null,
    requiredSkills: basicQualificationsSection?.items || [],
    postingDate: toIsoDate(listingRecord.date_gmt, { assumeUtc: true }),
    closingDate: null,
    jobDescription: buildJobDescription(sections),
    remoteStatus: inferRemoteStatus(location),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createEnGeniusMatrixScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = 100,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOME_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified official EnGenius Matrix homepage')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified official EnGenius Matrix careers page')
    }

    const listingRecords = await fetchJson(buildListingsApiUrl(1, pageSize))
    if (!Array.isArray(listingRecords) || !listingRecords.every(hasOfficialJobRecord)) {
      throw new Error('Response is not the verified EnGenius Matrix jobs API')
    }

    const selectedRecords = maxJobs ? listingRecords.slice(0, maxJobs) : listingRecords
    const jobs = []

    for (const listingRecord of selectedRecords) {
      const detailRecord = await fetchJson(buildJobDetailApiUrl(listingRecord.id))
      const job = extractJobFromApiRecord(listingRecord, detailRecord)

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createEnGeniusMatrixScraper().run(options)

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
