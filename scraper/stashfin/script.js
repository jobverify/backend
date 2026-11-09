import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { STASHFIN_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const DEPARTMENT_NAMES = new Set([
  'Product Design',
  'Product Management',
  'Software Development',
])

const STOP_MARKERS = new Set([
  'Perks & Benefits',
  'Employee Stories',
  'Culture',
  'Benefits',
])

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_BOARD_URL = PROVIDER_METADATA.publicBoardUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsWithLineBreaks = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/main|\/nav|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|main|nav|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const toTextLines = (html) =>
  stripTagsWithLineBreaks(html)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const inferRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase() || ''
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const parseLocationAndEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(
    /^(.*?India)\s+(Full-time|Part-time|Contract|Internship|Freelance|Temporary)$/i,
  )

  if (!match) return null

  const location = normalizeWhitespace(match[1])
  const employmentType = normalizeWhitespace(match[2])
  const city = normalizeWhitespace(location?.replace(/,\s*India$/i, ''))

  if (!location || !employmentType || !city) return null

  return { location, employmentType, city }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(stripTagsWithLineBreaks(page)) || ''

  return /<title>\s*Careers at Stashfin\s*<\/title>/i.test(page)
    && text.includes('Be part of the journey')
    && text.includes("We're always looking for talented people")
    && text.includes('Product Design')
    && text.includes('Product Management')
    && text.includes('Software Development')
    && text.includes('Perks & Benefits')
  }

export const extractSearchResults = (html = '') => {
  const lines = toTextLines(html)
  const jobs = []
  const seenBaseIds = new Map()
  let currentDepartment = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (DEPARTMENT_NAMES.has(line)) {
      currentDepartment = line
      continue
    }

    if (STOP_MARKERS.has(line) && currentDepartment && jobs.length > 0) break
    if (!currentDepartment) continue

    const title = line
    const description = lines[index + 1]
    const locationLine = lines[index + 2]

    if (!description || !locationLine) continue
    if (!/^we(?:'|’)re looking\b/i.test(description)) continue

    const parsedLocation = parseLocationAndEmploymentType(locationLine)
    if (!parsedLocation) continue

    const baseId = slugify(`${title}-${parsedLocation.location}`)
    if (!baseId) continue

    const occurrence = (seenBaseIds.get(baseId) || 0) + 1
    seenBaseIds.set(baseId, occurrence)
    const jobId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`

    jobs.push({
      title,
      company: COMPANY,
      department: currentDepartment,
      location: parsedLocation.location,
      city: parsedLocation.city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: parsedLocation.employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      publicExperienceChecked: true,
      remoteStatus: inferRemoteStatus(parsedLocation.location),
    })

    index += 2
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'stashfin-html',
  timeoutMs: 15000,
})

export const createStashfinScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(html)) {
      throw new Error('Stashfin verified first-party careers page no longer matches the trusted public job surface')
    }

    const scrapedAt = now()
    const jobs = extractSearchResults(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))

    if (jobs.length === 0) {
      throw new Error('Stashfin verified careers page no longer exposes trusted inline public job cards')
    }

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createStashfinScraper(options).run(options)

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
