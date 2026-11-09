import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const CAREERS_PAGE_URL = 'https://bitsilica.com/careers/'
export const CAREERS_CATEGORY_API_URL = 'https://bitsilica.com/wp-json/wp/v2/categories?slug=careers&_fields=id,name,slug,count'

export const buildCareerPostsApiUrl = (careerCategoryId) =>
  `https://bitsilica.com/wp-json/wp/v2/posts?categories=${careerCategoryId}&per_page=20&_fields=id,date,date_gmt,link,slug,title,content`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCharCode(Number(codePoint)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCharCode(parseInt(codePoint, 16)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/(?:\.\s*){2,}/g, '. ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '. ')
    .replace(/<p\b[^>]*>/gi, '')
    .replace(/<div\b[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' '),
)

const toIsoDate = (value, { assumeUtc = false } = {}) => {
  if (!value) return null

  const normalizedValue = assumeUtc && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(value))
    ? `${value}Z`
    : value

  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const ensureIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/#/g, '')
  if (!normalized) return null

  const formatted = normalized
    .split('/')
    .map((part) => normalizeWhitespace(part)?.replace(/\b([a-z])([a-z]*)/gi, (_, first, rest) =>
      `${first.toUpperCase()}${rest.toLowerCase()}`))
    .filter(Boolean)
    .join('/')

  if (/india/i.test(formatted)) return formatted
  return `${formatted}, India`
}

const inferCity = (location) => {
  const normalized = normalizeWhitespace(location)?.replace(/,\s*India$/i, '')?.replace(/\.+$/g, '')
  if (!normalized) return null
  if (/[\/|]/.test(normalized) || /\s+and\s+/i.test(normalized)) return null
  return normalized
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/(\d+\+?(?:\s*-\s*\d+\+?)?)\s*(years?|yrs?)/i)
  if (match) {
    return `${match[1]} years`
  }

  return normalized
}

export const extractCareerCategoryId = (records = []) => {
  const matchingRecord = records.find(
    (record) => normalizeWhitespace(record?.slug)?.toLowerCase() === 'careers',
  )

  return Number.isInteger(matchingRecord?.id) ? matchingRecord.id : null
}

const extractSection = (text, labelPattern, endPatterns = []) => {
  const sourceText = String(text ?? '')
  const labelMatch = labelPattern.exec(sourceText)
  if (!labelMatch) return null

  const remainder = sourceText.slice(labelMatch.index + labelMatch[0].length)
  let endIndex = remainder.length

  for (const pattern of endPatterns) {
    const match = pattern.exec(remainder)
    if (match && match.index < endIndex) {
      endIndex = match.index
    }
  }

  return normalizeWhitespace(remainder.slice(0, endIndex))?.replace(/\.+$/g, '') || null
}

export const extractLocation = (text) => {
  const location = extractSection(text, /\bLocation\s*:\s*/i, [
    /\.\s*Education\s*:/i,
    /\.\s*Experience\s*:/i,
    /\.\s*Availability\s*:/i,
    /\.\s*Interested\b/i,
    /\.\s*Drop\b/i,
    /\.\s*Careers\b/i,
    /\s+\d+\+?(?:\s*-\s*\d+\+?)?\s*(?:years?|yrs?)(?:\s+of\s+experience)?/i,
  ])

  return normalizeWhitespace(location)?.replace(/#/g, '') || null
}

export const extractExperience = (text) => {
  const explicitExperience = extractSection(text, /\bExperience\s*:\s*/i, [
    /\.\s*Also\b/i,
    /\.\s*Interested\b/i,
    /\.\s*Drop\b/i,
    /\.\s*Careers\b/i,
  ])
  if (explicitExperience) {
    return normalizeExperience(explicitExperience)
  }

  const inlineMatch = String(text ?? '').match(
    /(\d+\+?(?:\s*-\s*\d+\+?)?)\s*(years?|yrs?)(?:\s+of\s+experience)?/i,
  )
  if (inlineMatch) {
    return normalizeExperience(inlineMatch[0])
  }

  return null
}

export const extractMinimumQualification = (text) => {
  const primary = extractSection(text, /\bEducation\s*:\s*/i, [
    /\.\s*Experience\s*:/i,
    /\.\s*Also\s+for\s+Junior\s+Accountant\s+with\s+Education\s*:/i,
    /\.\s*Interested\b/i,
    /\.\s*Drop\b/i,
    /\.\s*Careers\b/i,
  ])
  const junior = extractSection(text, /\bAlso\s+for\s+Junior\s+Accountant\s+with\s+Education\s*:\s*/i, [
    /\.\s*Interested\b/i,
    /\.\s*Drop\b/i,
    /\.\s*Careers\b/i,
  ])

  if (primary && junior) {
    return `${primary}. Also for Junior Accountant with Education: ${junior}`
  }

  return primary || junior || null
}

export const extractRequiredSkills = (text) => {
  const skillsText = extractSection(text, /\bSkills?\s*:\s*/i, [
    /\.\s*Location\s*:/i,
    /\.\s*Availability\s*:/i,
    /\.\s*Interested\b/i,
    /\.\s*Drop\b/i,
    /\.\s*Careers\b/i,
  ])
  if (!skillsText) return []

  return skillsText
    .split(',')
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean)
}

export const extractCareerPosts = (records = []) =>
  records.map((record) => {
    const sourceUrl = normalizeWhitespace(record?.link)
    const jobDescription = htmlToText(record?.content?.rendered)
    const location = ensureIndiaLocation(extractLocation(jobDescription))

    return {
      title: normalizeWhitespace(record?.title?.rendered),
      company: 'BITSILICA',
      department: null,
      location,
      city: inferCity(location),
      country: 'India',
      jobId: String(record?.id ?? ''),
      requisitionId: String(record?.id ?? ''),
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: extractExperience(jobDescription),
      minimumQualification: extractMinimumQualification(jobDescription),
      preferredQualification: null,
      requiredSkills: extractRequiredSkills(jobDescription),
      postingDate: toIsoDate(record?.date_gmt, { assumeUtc: true }) || toIsoDate(record?.date),
      closingDate: null,
      jobDescription,
      remoteStatus: 'On-site',
    }
  }).filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: 'bitsilica',
  timeoutMs: 15000,
})

export const createBITSILICAScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const categories = await fetchJson(CAREERS_CATEGORY_API_URL)
    const careerCategoryId = extractCareerCategoryId(Array.isArray(categories) ? categories : [])

    if (!careerCategoryId) {
      return []
    }

    const records = await fetchJson(buildCareerPostsApiUrl(careerCategoryId))
    const jobs = extractCareerPosts(Array.isArray(records) ? records : [])
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'bitsilica',
      link: job.applyUrl || job.sourceUrl || CAREERS_PAGE_URL,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createBITSILICAScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running BITSILICA scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'bitsilica')
    console.log('DB result:', result)
    process.exit(0)
  }
}
