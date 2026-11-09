import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'flam'
export const COMPANY = 'FLAM'
export const CAREERS_URL = 'https://flamapp.ai/careers'
export const SEARCH_URL = 'https://flamapp.ai/careers/search'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(india|bengaluru|bangalore|mumbai|new delhi|delhi|gurugram|gurgaon|hyderabad|pune|chennai)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&#8211;|&#x2013;/gi, '-')
  .replace(/&#8212;|&#x2014;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article)>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTextSegments = (html) =>
  [...String(html ?? '').matchAll(/<(?:span|p|div|li)[^>]*>([\s\S]*?)<\/(?:span|p|div|li)>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const buildDetailUrl = (detailPath) => new URL(detailPath, SEARCH_URL).toString()

const extractJobId = (detailPath) => {
  const normalized = normalizeWhitespace(detailPath)
  if (!normalized) return null
  return normalized.split('/').filter(Boolean).at(-1) || null
}

const isIndiaLocation = (location) => INDIA_LOCATION_PATTERN.test(String(location ?? ''))

const toIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return 'India'
  return /,\s*india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const extractSectionItems = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp(`<(?:p|div)[^>]*>\\s*(?:<strong[^>]*>)?\\s*${label}\\s*:?\\s*(?:<\\/strong>)?\\s*<\\/(?:p|div)>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'),
  )

  if (!match) return []

  return [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => normalizeWhitespace(item[1]))
    .filter(Boolean)
}

const extractApplyUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href="([^"]+)"[^>]*>\s*Apply Now\s*<\/a>/i)
  if (!match) return null

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractExperienceRequired = (items = []) =>
  items.find((item) => /\b\d+\+?\s*(?:-|to)?\s*\d*\+?\s*years?\b/i.test(item) || /\byears?\b/i.test(item)) || null

const extractMinimumQualification = (items = []) =>
  items.find((item) => !/\byears?\b/i.test(item)) || items[0] || null

const buildJobDescription = (html, title) => {
  const description = normalizeWhitespace(html)
  const normalizedTitle = normalizeWhitespace(title)

  if (!description || !normalizedTitle) return description
  if (!description.startsWith(normalizedTitle)) return description

  return normalizeWhitespace(description.slice(normalizedTitle.length))
}

export const extractRoleCards = (html) => {
  const roles = []
  const pattern = /<a[^>]+href="(\/careers\/listing\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const detailPath = normalizeWhitespace(match[1])
    const detailUrl = detailPath ? buildDetailUrl(detailPath) : null
    const cardHtml = match[2]
    const locationMatches = [...cardHtml.matchAll(/<span[^>]*leading-none[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((entry) => normalizeWhitespace(entry[1]))
      .filter(Boolean)
    const department = locationMatches[0] || normalizeWhitespace(cardHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1])
    const title = normalizeWhitespace(cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const location = normalizeWhitespace(
      cardHtml.match(/<h3[^>]*>[\s\S]*?<\/h3>\s*<\/div>\s*<div[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1],
    ) || locationMatches.at(-1)
    const segments = extractTextSegments(cardHtml).filter((segment) => !/^apply$/i.test(segment))

    if (!detailPath || !detailUrl) continue

    const resolvedDepartment = department || segments[0]
    const resolvedTitle = title || segments[1]
    const resolvedLocation = location || segments.slice(2).join(' ')

    if (!resolvedDepartment || !resolvedTitle || !resolvedLocation) continue

    roles.push({
      department: resolvedDepartment,
      title: resolvedTitle,
      location: resolvedLocation,
      detailPath,
      detailUrl,
      jobId: extractJobId(detailPath),
    })
  }

  return roles
}

export const extractJobDetail = (html, role) => {
  const qualifications = extractSectionItems(html, 'Qualifications')
  const skills = extractSectionItems(html, 'Skills')
  const preferredSkills = extractSectionItems(html, 'Preferred Skills')
  const location = toIndiaLocation(role.location)

  return {
    title: normalizeWhitespace(role.title),
    company: COMPANY,
    department: normalizeWhitespace(role.department),
    location,
    city: extractCity(role.location),
    country: 'India',
    jobId: normalizeWhitespace(role.jobId),
    requisitionId: normalizeWhitespace(role.jobId),
    sourceUrl: role.detailUrl,
    applyUrl: extractApplyUrl(html),
    employmentType: null,
    experienceRequired: extractExperienceRequired(qualifications),
    minimumQualification: extractMinimumQualification(qualifications),
    preferredQualification: preferredSkills.length > 0 ? preferredSkills.join(' ') : null,
    requiredSkills: skills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(html, role.title),
    remoteStatus: 'On-site',
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFlamScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const listingsHtml = await fetchText(SEARCH_URL)
    const roles = extractRoleCards(listingsHtml).filter((role) => isIndiaLocation(role.location))
    const selectedRoles = maxJobs ? roles.slice(0, maxJobs) : roles
    const jobs = []

    for (const role of selectedRoles) {
      const detailHtml = await fetchText(role.detailUrl)
      const job = extractJobDetail(detailHtml, role)

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async () => createFlamScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running FLAM scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
