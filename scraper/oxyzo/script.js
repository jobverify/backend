import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runCurrentOxyzo} from './currentNative20261117.js'

import OXYZO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = OXYZO_CATALOG.source
export const COMPANY = OXYZO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OXYZO_CATALOG.officialBrandName
export const VERIFIED_ON = OXYZO_CATALOG.verifiedOn
export const PROVIDER_METADATA = OXYZO_CATALOG
export const HOMEPAGE_URL = OXYZO_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = OXYZO_CATALOG.companyCareerPage
export const JOB_PAGE_PREFIX = OXYZO_CATALOG.jobPagePrefix
export const PAGINATION_QUERY_PARAM = OXYZO_CATALOG.paginationQueryParam

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
) || ''

const htmlToLines = (html = '') => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, '\n')
  .replace(/<style[\s\S]*?<\/style>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(h[1-6]|p|li|div|section|article|a|span|strong|em|ul|ol|form|label|button)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractHeadings = (html = '') => (
  [...String(html ?? '').matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
)

const extractSectionText = (lines = []) => {
  const aboutIndex = lines.findIndex((line) => /^About the Business$/i.test(line))
  if (aboutIndex < 0) return null

  const applicationIndex = lines.findIndex((line) => /^Application Form$/i.test(line))
  const endIndex = applicationIndex > aboutIndex ? applicationIndex : lines.length
  const slice = lines.slice(aboutIndex, endIndex)

  return slice.length > 0 ? slice.join('\n') : null
}

export const buildCategoriesPageUrl = (pageNumber) => (
  Number(pageNumber) <= 1
    ? CAREERS_PAGE_URL
    : `${CAREERS_PAGE_URL}?${PAGINATION_QUERY_PARAM}=${Number(pageNumber)}`
)

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const lines = htmlToLines(rawHtml)
  const text = lines.join(' ')

  return /<title>\s*Work at Oxyzo - Shape the Future of Fintech\s*<\/title>/i.test(rawHtml)
    && text.includes('Careers @ Oxyzo')
    && text.includes('Explore Roles')
    && text.includes('career@oxyzo.in')
  }

export const hasOfficialCategoriesSignal = (html = '') => {
  const lines = htmlToLines(html)
  const text = lines.join(' ')

  return text.includes('Area Sales Manager - SME Lending')
    && text.includes('Business Development Manager')
    && text.includes('Posting:')
    && text.includes('View Details')
    && /https:\/\/www\.oxyzocareers\.in\/jobs\//i.test(String(html ?? ''))
  }

export const extractJobDetailUrls = (html = '') => {
  const matches = String(html ?? '').match(/https:\/\/www\.oxyzocareers\.in\/jobs\/[^"'\\\s<]+/gi) || []
  const seen = new Set()
  const urls = []

  for (const match of matches) {
    const normalized = normalizeWhitespace(match)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
  }

  return urls
}

export const extractJobFromDetailPage = (html = '', sourceUrl = '') => {
  const headings = extractHeadings(html)
  const lines = htmlToLines(html)

  const title = headings[0] || null
  const department = headings[1] || null

  const departmentIndex = department ? lines.indexOf(department) : -1
  const employmentType = departmentIndex >= 0 ? normalizeWhitespace(lines[departmentIndex + 1]) : null
  const experienceRequired = departmentIndex >= 0 ? normalizeWhitespace(lines[departmentIndex + 2]) : null
  const location = departmentIndex >= 0 ? normalizeWhitespace(lines[departmentIndex + 3]) : null

  const jobIdIndex = lines.findIndex((line) => /^Job ID:?$/i.test(line))
  const jobId = jobIdIndex >= 0 ? normalizeWhitespace(lines[jobIdIndex + 1]) : null
  const jobDescription = extractSectionText(lines)

  if (!title || !department || !employmentType || !location) {
    throw new Error(`The verified Oxyzo job detail page changed materially: ${sourceUrl || 'unknown-url'}`)
  }

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: null,
    country: null,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
  }
}

export const createOxyzoScraper = () => ({run:runCurrentOxyzo})

export const run = async (options = {}) => createOxyzoScraper(options).run(options)

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
