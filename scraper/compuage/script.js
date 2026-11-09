import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'compuage'
export const COMPANY = 'Compuage Infocom Ltd'
export const CAREERS_URL = 'http://www.compuageindia.com/careers'
export const APPLICATION_EMAIL = 'careers@compuageindia.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
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
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|hr|form|label|option|button)>/gi, '\n')
    .replace(/<(li|p|div|section|article|ul|ol|h[1-6]|label|option|button)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeTitle = (value) => normalizeWhitespace(value)
  ?.replace(/\s+,/g, ',')
  .replace(/\(\s+/g, '(')
  .replace(/\s+\)/g, ')')
  .replace(/\s{2,}/g, ' ') || null

const toLines = (value) => decodeHtml(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|hr|form|label|option|button)>/gi, '\n')
  .replace(/<(li|p|div|section|article|ul|ol|h[1-6]|label|option|button)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter((line) => line && !/^(?:\*+\s*)+$/.test(line))

const extractApplicationEmail = (html) => {
  const match = String(html ?? '').match(/\b([a-z0-9._%+-]+@compuageindia\.com)\b/i)
  return match ? match[1].toLowerCase() : APPLICATION_EMAIL
}

const extractFieldValue = (lines, label) => {
  const index = lines.findIndex((entry) => new RegExp(`^${label}\\s*:`, 'i').test(entry))
  if (index === -1) return null

  const value = normalizeWhitespace(lines[index]?.replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), ''))
  if (value) return value

  return normalizeWhitespace(lines[index + 1])
}

const findLineIndex = (lines, pattern) => lines.findIndex((line) => pattern.test(line))

const extractLabeledText = (lines, startPattern, endPatterns) => {
  const startIndex = findLineIndex(lines, startPattern)
  if (startIndex === -1) return []

  const endIndex = lines.findIndex((line, index) =>
    index > startIndex && endPatterns.some((pattern) => pattern.test(line)))

  return lines
    .slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex)
    .filter(Boolean)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /,\s*india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const primary = normalized.split(',')[0]?.trim()
  return primary ? normalizeCity(primary) : null
}

const buildDescription = ({ profileLines, desiredLines, email }) => {
  const parts = []
  if (profileLines.length > 0) parts.push(`Job Profile: ${profileLines.join(' ')}`)
  if (desiredLines.length > 0) parts.push(`Desired Candidate's Profile: ${desiredLines.join(' ')}`)
  parts.push(`Apply via the Compuage careers page or ${email}.`)
  return parts.join(' ')
}

const DESIRED_PROFILE_PATTERN = /^Desired Candidate[’']s Profile\s*:/i

const extractVariantTitles = (title, linesBeforeEducation) => {
  const normalizedTitle = normalizeTitle(title)
  if (!normalizedTitle) return []

  const baseTitle = normalizedTitle.replace(/\s*:\s*$/, '')
  const variants = linesBeforeEducation
    .slice(1)
    .map((line) => normalizeTitle(line?.replace(/^\d+\)\s*/, '')))
    .filter(Boolean)

  if (normalizedTitle.endsWith(':') && variants.length > 0) {
    return variants.map((variant) => `${baseTitle} (${variant})`)
  }

  return [normalizedTitle]
}

const extractSectionHtmlBlocks = (html) => String(html ?? '')
  .split(/APPLY NOW/i)
  .slice(0, -1)
  .map((chunk) => {
    const headings = [...chunk.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    const lastHeading = headings.at(-1)
    if (!lastHeading || lastHeading.index == null) return null
    return chunk.slice(lastHeading.index)
  })
  .filter(Boolean)

export const hasOfficialCareersSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('OPEN JOB POSITIONS')
    && normalized.includes('In Talent We Trust!')
    && normalized.includes('Upload Resume')
    && normalized.includes('careers@compuageindia.com')
    && normalized.includes('COMPUAGE INFOCOM LTD')
}

export const extractJobListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Compuage verified official careers surface changed or disappeared')
  }

  const email = extractApplicationEmail(html)
  const jobs = []
  const seenJobIds = new Set()

  for (const sectionHtml of extractSectionHtmlBlocks(html)) {
    const lines = toLines(sectionHtml)
    const educationIndex = findLineIndex(lines, /^Education Qualification\s*:/i)
    const experienceIndex = findLineIndex(lines, /^Experience\s*:/i)
    const locationIndex = findLineIndex(lines, /^Location\s*:/i)

    if (educationIndex === -1 || experienceIndex === -1 || locationIndex === -1) continue

    const titleLines = lines.slice(0, educationIndex)
    const titles = extractVariantTitles(titleLines[0], titleLines)
    const minimumQualification = extractFieldValue(lines, 'Education Qualification')
    const experienceRequired = extractFieldValue(lines, 'Experience')
    const locationRaw = extractFieldValue(lines, 'Location')
    const profileLines = extractLabeledText(
      lines,
      /^Job Profile\s*:/i,
      [DESIRED_PROFILE_PATTERN, /^Experience\s*:/i, /^Location\s*:/i],
    )
    const desiredLines = extractLabeledText(
      lines,
      DESIRED_PROFILE_PATTERN,
      [/^Experience\s*:/i, /^Location\s*:/i],
    )
    const location = normalizeLocation(locationRaw)
    const city = extractCity(locationRaw)

    if (!location || titles.length === 0) continue

    for (const title of titles) {
      const jobId = slugify(title)
      if (!jobId || seenJobIds.has(jobId)) continue

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
        requiredSkills: desiredLines,
        postingDate: null,
        closingDate: null,
        jobDescription: buildDescription({
          profileLines,
          desiredLines,
          email,
        }),
        remoteStatus: 'On-site',
      })
    }
  }

  if (jobs.length === 0) {
    throw new Error('Compuage verified official careers surface changed or disappeared')
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

export const createCompuageScraper = () => ({
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

export const run = async (options = {}) => createCompuageScraper().run(options)

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
