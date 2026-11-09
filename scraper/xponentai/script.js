import {createXponentNativeScraper} from './native20261108.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'xponentai'
export const COMPANY = 'xponent.ai'
export const HOMEPAGE_URL = 'https://xponent.ai/'
export const CAREERS_URL = 'https://xponent.ai/career/'
export const CAREERS_API_URL = 'https://xponent.ai/wp-json/wp/v2/awsm_job_openings'
export const PAGE_SIZE = 100

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const titleCase = (value) => normalizeWhitespace(value)
  ?.split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ') || null

const slugToLabel = (slug) => titleCase(String(slug ?? '').replace(/-/g, ' '))

const getClassSlug = (classList, prefixes) => {
  const normalizedPrefixes = Array.isArray(prefixes) ? prefixes : [prefixes]
  const match = (Array.isArray(classList) ? classList : [])
    .find((className) => normalizedPrefixes.some((prefix) => String(className).startsWith(prefix)))

  if (!match) return null

  const prefix = normalizedPrefixes.find((candidate) => String(match).startsWith(candidate))
  return prefix ? String(match).slice(prefix.length) : null
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const isVerifiedListingRecord = (record) =>
  record
  && typeof record === 'object'
  && Array.isArray(record.class_list)
  && record.class_list.includes('type-awsm_job_openings')
  && record.title?.rendered
  && typeof record.link === 'string'
  && /^https:\/\/xponent\.ai\/jobs\/[^?#]+\/?$/i.test(record.link)

const assertVerifiedFeed = (records) => {
  if (!Array.isArray(records)) {
    throw new Error('xponent.ai feed no longer matches the verified WP Job Openings feed')
  }

  if (records.some((record) => !isVerifiedListingRecord(record))) {
    throw new Error('xponent.ai feed no longer matches the verified WP Job Openings feed')
  }

  return records
}

const toDepartmentLabel = (departmentSlug) => slugToLabel(departmentSlug)

const toEmploymentTypeLabel = (employmentTypeSlug) => slugToLabel(employmentTypeSlug)

const toExperienceLabel = (experienceSlug) => {
  const normalized = String(experienceSlug ?? '').trim().toLowerCase()
  const exactYearsMatch = normalized.match(/^(\d+)-years?$/)
  if (exactYearsMatch) return `${exactYearsMatch[1]}+ Years`

  const rangeMatch = normalized.match(/^(\d+)-(\d+)-years?$/)
  if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]} Years`

  return slugToLabel(normalized)
}

const toLocationData = (locationSlug) => {
  const normalized = String(locationSlug ?? '').trim().toLowerCase()
  if (!normalized) {
    return { location: null, city: null, country: null }
  }

  if (normalized === 'remote' || normalized === 'work-from-home') {
    return { location: 'Remote', city: null, country: null }
  }

  if (normalized === 'anywhere-in-india' || normalized === 'india') {
    return { location: 'Anywhere in India', city: null, country: 'India' }
  }

  const city = normalizeCity(slugToLabel(normalized))
  if (!city) {
    return { location: null, city: null, country: null }
  }

  return {
    location: city,
    city,
    country: null,
  }
}

const toRemoteStatus = ({ locationSlug, workModeSlug }) => {
  const normalizedWorkMode = String(workModeSlug ?? '').trim().toLowerCase()
  const normalizedLocation = String(locationSlug ?? '').trim().toLowerCase()

  if (normalizedWorkMode.includes('hybrid')) return 'Hybrid'
  if (normalizedWorkMode.includes('remote')) return 'Remote'
  if (normalizedWorkMode === 'onsite' || normalizedWorkMode === 'on-site') return 'On-site'
  if (normalizedLocation === 'remote' || normalizedLocation === 'work-from-home') return 'Remote'

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /xponent\.ai/i.test(page)
    && /href=["']https:\/\/xponent\.ai\/career\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Career\b[\s\S]*?<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && /(wp-job-openings|awsm-job-listings)/i.test(page)
}

export const buildSearchUrl = (page = 1, pageSize = PAGE_SIZE) => {
  const url = new URL(CAREERS_API_URL)
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractSearchResults = (records) => assertVerifiedFeed(records)
  .map((record) => {
    const classList = Array.isArray(record?.class_list) ? record.class_list : []
    const locationSlug = getClassSlug(classList, ['job-location-', 'location-'])
    const employmentTypeSlug = getClassSlug(classList, ['job-type-', 'employment-type-'])
    const departmentSlug = getClassSlug(classList, ['job-category-', 'department-'])
    const workModeSlug = getClassSlug(classList, ['job-mode-', 'work-mode-', 'work-module-'])
    const experienceSlug = getClassSlug(classList, ['experience-', 'relevant-experience-'])
    const locationData = toLocationData(locationSlug)
    const title = normalizeWhitespace(record?.title?.rendered)
    const jobId = record?.id == null ? null : String(record.id)
    const sourceUrl = normalizeWhitespace(record?.link)
    const requiredSkills = extractListItems(record?.content?.rendered)

    if (!title || !jobId || !sourceUrl) return null

    return {
      title,
      company: COMPANY,
      department: toDepartmentLabel(departmentSlug),
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: toEmploymentTypeLabel(employmentTypeSlug),
      experienceRequired: toExperienceLabel(experienceSlug),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: stripTags(record?.content?.rendered),
      remoteStatus: toRemoteStatus({ locationSlug, workModeSlug }),
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 30000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 30000,
})

export const createXponentAiScraper = (options = {}) => createXponentNativeScraper(options)

export const run = async (options = {}) => createXponentAiScraper().run(options)

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
