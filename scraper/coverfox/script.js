import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'coverfox'
export const COMPANY = 'Coverfox'
export const CAREERS_URL = 'https://www.coverfox.com/careers/'
export const DEFAULT_APPLICATION_EMAIL = 'careers@coverfox.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OPENING_BLOCK_PATTERN = /<div[^>]*data-cms-namespace=["']opening[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*faq__question[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*faq__answer[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi
const EXPERIENCE_PATTERN = /\b(?:\d+\+\s*years?|\d+\s*(?:to|-)\s*\d+\s*years?)\b/i
const QUALIFICATION_PATTERN = /\b(?:bachelor'?s|graduate|post graduate|degree|diploma|computer science|engineering|related field)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[‘’]/g, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|hr|form|label|option|button|strong|b)>/gi, '\n')
    .replace(/<(li|p|div|section|article|ul|ol|h[1-6]|label|option|button|strong|b)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toLines = (value) => decodeHtml(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|hr|form|label|option|button|strong|b)>/gi, '\n')
  .replace(/<(li|p|div|section|article|ul|ol|h[1-6]|label|option|button|strong|b)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /,\s*india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const primary = normalized
    .replace(/\([^)]*\)/g, '')
    .split(/[\/,&]/)[0]
    ?.trim()

  return primary ? normalizeCity(primary) : null
}

const findLineIndex = (lines, pattern) => lines.findIndex((line) => pattern.test(line))

const extractFieldValue = (lines, label) => {
  const index = lines.findIndex((entry) => new RegExp(`^${label}\\s*:`, 'i').test(entry))
  if (index === -1) return null

  const value = normalizeWhitespace(lines[index]?.replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), ''))
  if (value) return value

  return normalizeWhitespace(lines[index + 1])
}

const extractSectionLines = (lines, startPattern, endPatterns) => {
  const startIndex = findLineIndex(lines, startPattern)
  if (startIndex === -1) return []

  const endIndex = lines.findIndex((line, index) =>
    index > startIndex && endPatterns.some((pattern) => pattern.test(line)))

  return lines
    .slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex)
    .filter(Boolean)
}

const extractApplicationEmail = (value, fallbackEmail = DEFAULT_APPLICATION_EMAIL) => {
  const normalized = decodeHtml(String(value ?? ''))
  const match = normalized.match(/(?:mailto:)?([a-z0-9._%+-]+@(coverfox\.com|coverstack\.in))/i)
  return match ? match[1].toLowerCase() : fallbackEmail
}

const extractExperienceRequired = (candidateLines) => {
  const match = candidateLines.join(' ').match(EXPERIENCE_PATTERN)
  return match ? normalizeWhitespace(match[0]) : null
}

const extractMinimumQualification = (candidateLines) =>
  candidateLines.find((line) => QUALIFICATION_PATTERN.test(line)) || null

const buildRequiredSkills = ({ candidateLines, minimumQualification, experienceRequired }) =>
  candidateLines.filter((line) => {
    if (line === minimumQualification) return false
    if (experienceRequired && line.toLowerCase().includes(experienceRequired.toLowerCase())) return false
    return true
  })

const buildDescription = ({ jobProfileLines, candidateLines, applicationEmail }) => {
  const parts = []
  if (jobProfileLines.length > 0) parts.push(`Job Profile: ${jobProfileLines.join(' ')}`)
  if (candidateLines.length > 0) parts.push(`Candidate Profile: ${candidateLines.join(' ')}`)
  parts.push(`Apply by emailing ${applicationEmail}.`)
  return parts.join(' ')
}

const getOpeningBlocks = (html) => [...String(html ?? '').matchAll(OPENING_BLOCK_PATTERN)]

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /Career Opportunities,\s*Job Vacancies - Coverfox\.com/i.test(page)
    && /href=["']https:\/\/www\.coverfox\.com\/careers\/["']/i.test(page)
    && text.includes('Welcome to the Coverfox careers page')
    && text.includes('Coverfox is on a hiring spree')
    && /id=["']careerContactForm["']/i.test(page)
    && getOpeningBlocks(page).length > 0
}

export const extractJobListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Coverfox verified official careers page changed or disappeared')
  }

  const fallbackEmail = extractApplicationEmail(html, DEFAULT_APPLICATION_EMAIL)
  const jobs = []
  const seenJobIds = new Set()

  for (const [, questionHtml, answerHtml] of getOpeningBlocks(html)) {
    const title = stripTags(questionHtml)
    const lines = toLines(answerHtml)
    const locationRaw = extractFieldValue(lines, 'Location')
    const location = normalizeLocation(locationRaw)
    const city = extractCity(locationRaw)
    const jobProfileLines = extractSectionLines(
      lines,
      /^Job Profile\s*:/i,
      [/^Candidate Profile\s*:/i, /^Application Process\s*:/i],
    )
    const candidateLines = extractSectionLines(
      lines,
      /^Candidate Profile\s*:/i,
      [/^Application Process\s*:/i],
    )
    const applicationEmail = extractApplicationEmail(answerHtml, fallbackEmail)
    const experienceRequired = extractExperienceRequired(candidateLines)
    const minimumQualification = extractMinimumQualification(candidateLines)
    const requiredSkills = buildRequiredSkills({
      candidateLines,
      minimumQualification,
      experienceRequired,
    })
    const jobId = slugify(title)

    if (!title || !location || !jobId || seenJobIds.has(jobId)) continue

    seenJobIds.add(jobId)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildDescription({
        jobProfileLines,
        candidateLines,
        applicationEmail,
      }),
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length === 0) {
    throw new Error('Coverfox verified official careers page changed or disappeared')
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

export const createCoverfoxScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    return extractJobListings(careersHtml).map((job) => ({
      ...job,
      jobId: `${SOURCE}-${job.jobId}`,
      requisitionId: `${SOURCE}-${job.requisitionId}`,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createCoverfoxScraper().run(options)

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
