import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mrf'
export const COMPANY = 'MRF Limited'
export const COMPANY_DOMAIN = 'mrftyres.com'
export const HOMEPAGE_URL = 'https://www.mrftyres.com/'
export const CAREERS_URL = 'https://www.mrftyres.com/careers'
export const CAREERS_PORTAL_URL = 'https://mrfconnect.mrfindia.net/'
export const JOBS_API_URL = 'https://mrfconnect.mrfindia.net/api/campusrequisition/getalloffcampuslink'
export const ATS_PLATFORM = 'official-company-careers'
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const buildNormalizedUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? '').trim(), baseUrl).toString()
  } catch {
    return null
  }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .replace(/â€‹/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const cleanExtractedValue = (value) => normalizeWhitespace(value)
  ?.replace(/\s*\(As per the requirement sent to respective intitutes\)\s*/gi, '')
  ?.replace(/\(\s+/g, '(')
  ?.replace(/\s+\)/g, ')')
  ?.trim()
  || null

const stripHtmlToLines = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\r\n?/g, '\n')
    .replace(/<(br|\/p|\/div|\/li|\/ol|\/ul|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ol|ul|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const extractTemplateLines = (value) => {
  const text = stripHtmlToLines(value)
  if (!text) return []

  return text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
}

const extractLabeledValue = (lines, label) => {
  const pattern = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'i')

  for (const line of lines) {
    const match = line.match(pattern)
    if (match) {
      return cleanExtractedValue(match[1])
    }
  }

  return null
}

const determineRecruitmentMode = (lines) => {
  const text = lines.join(' ')

  if (/off[\s-]?campus/i.test(text)) return 'Off-Campus Recruitment'
  if (/campus drive|campus recruitment|campus requirement/i.test(text)) return 'Campus Drive'
  return 'Recruitment'
}

const buildTitle = (record, lines) => {
  const positions = extractLabeledValue(lines, 'Positions')
  const courseName = normalizeWhitespace(record.courseName)
  const yearName = normalizeWhitespace(record.campusYearName)
  const baseTitle = positions || determineRecruitmentMode(lines)
  const suffix = `${courseName || 'Registration'}${yearName ? ` (${yearName})` : ''}`

  return normalizeWhitespace(`${baseTitle} - ${suffix}`)
}

const buildLocation = (lines) => {
  const text = lines.join(' ')
  if (/pan india/i.test(text)) return 'Pan India'
  return 'India'
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const buildDescription = (lines) => {
  if (lines.length === 0) return null

  const intro = lines[0]
  const positions = extractLabeledValue(lines, 'Positions')
  const qualification = extractLabeledValue(lines, 'Qualification')
  const stream = extractLabeledValue(lines, 'Stream')

  const filteredBodyLines = lines.filter((line, index) => {
    if (index === 0) return false
    return !/^positions\s*:/i.test(line)
      && !/^qualification\s*:/i.test(line)
      && !/^stream\s*:/i.test(line)
  })

  const detailLines = []

  if (positions) {
    detailLines.push('POSITIONS:')
    detailLines.push(positions)
  }

  if (qualification) detailLines.push(`Qualification: ${qualification}`)
  if (stream) detailLines.push(`Stream: ${stream}`)
  detailLines.push(...filteredBodyLines)

  return detailLines.length > 0
    ? `${intro}\n\n${detailLines.join('\n')}`
    : intro
}

const buildJobFromRecord = (record) => {
  const lines = extractTemplateLines(record.campusTemplate)
  const applyUrl = buildNormalizedUrl(record.campusLink, CAREERS_PORTAL_URL)
  const jobId = normalizeWhitespace(record.campusLinkId)
  const postingDate = parsePostingDate(record.createdOn)
  const title = buildTitle(record, lines)

  if (!applyUrl || !jobId || !postingDate || !title) {
    throw new Error('MRF verified public careers API no longer exposes the required registration fields')
  }

  return {
    title,
    company: COMPANY,
    department: cleanExtractedValue(extractLabeledValue(lines, 'Positions')),
    location: buildLocation(lines),
    city: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: cleanExtractedValue(
      extractLabeledValue(lines, 'Qualification') || normalizeWhitespace(record.courseName),
    ),
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: buildDescription(lines),
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
  }
}

const getFeedEntries = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.value)) return payload.value
  return null
}

export const buildApiRequestBody = () => ({
  campusCourseId: null,
  campusYearId: 0,
  createdBy: 0,
  campusLinkId: null,
})

export const buildPublicHeaders = () => ({
  Accept: 'application/json,text/plain,*/*',
  'Content-Type': 'application/json',
  'User-Agent': USER_AGENT,
})

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return /<title>\s*car tyres \| bike tyres by official website of mrf tyres\s*<\/title>/i.test(rawHtml)
    && rawHtml.includes('https://mrfconnect.mrfindia.net')
    && normalized.includes('mrf is the largest manufacturer of tyres in india')
}

export const hasOfficialCareersShell = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*mrf connect us\s*<\/title>/i.test(rawHtml)
    && /<app-root><\/app-root>/i.test(rawHtml)
    && /main-es2015\.js|main-es5\.js/i.test(rawHtml)
  }

export const extractActiveJobs = (payload) => {
  const entries = getFeedEntries(payload)
  if (!entries) return []

  return entries
    .filter((entry) => Number(entry?.disableStatus) === 0)
    .map((entry) => buildJobFromRecord(entry))
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: options.headers,
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMrfScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('MRF verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !careersPage.url.startsWith(CAREERS_PORTAL_URL)
      || !hasOfficialCareersShell(careersPage.html)
    ) {
      throw new Error('MRF verified official careers portal no longer matches the known first-party surface')
    }

    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      headers: buildPublicHeaders(),
      body: JSON.stringify(buildApiRequestBody()),
    })

    const entries = getFeedEntries(payload)
    if (!entries) {
      throw new Error('MRF verified public careers API no longer returns the known campus requisition feed')
    }

    const scrapedAt = now()

    return extractActiveJobs(entries).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createMrfScraper().run(options)

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
