import {runCurrentPayoda} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'payoda'
export const COMPANY = 'Payoda'
export const CAREERS_URL = 'https://www.payoda.com/careers'
export const APPLICATION_EMAIL = 'joinus@payoda.com'
export const APPLICATION_URL = 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application'


const PAYODA_APPLICATION_EMAIL_PATTERN = /\b(?:joinus|careers)@payoda\.com\b/i
const PAYODA_APPLICATION_MAILTO_PATTERN = /href=["'](mailto:(?:joinus|careers)@payoda\.com[^"']*)["']/i
const ROLE_CARD_CTA_PATTERN = /\bView\s+(?:job|role)\b/i
const DOT_SEPARATOR_PATTERN = /\s*(?:·|\u00c2\u00b7)\s*/
const DOT_SEPARATOR_ONLY_PATTERN = /^(?:·|\u00c2\u00b7)$/

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bIndia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const deriveCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const firstLocation = normalized.split(DOT_SEPARATOR_PATTERN)[0]?.trim()
  return normalizeCity(firstLocation || normalized)
}

const normalizeExperience = (value) => normalizeWhitespace(value)?.replace(/[–—]/g, '-') || null

const parseEmploymentDetails = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      experienceRequired: null,
      employmentType: null,
    }
  }

  const parts = normalized.split(DOT_SEPARATOR_PATTERN).map((part) => normalizeWhitespace(part)).filter(Boolean)
  return {
    experienceRequired: normalizeExperience(parts[0]),
    employmentType: parts[1] || null,
  }
}

const buildApplicationUrl = (email = APPLICATION_EMAIL) =>
  `mailto:${email}?subject=CV%3A%20open%20application`

const extractApplicationEmail = (html) =>
  String(html ?? '').match(PAYODA_APPLICATION_EMAIL_PATTERN)?.[0]
  || APPLICATION_EMAIL

const extractApplyUrl = (html) =>
  String(html ?? '').match(PAYODA_APPLICATION_MAILTO_PATTERN)?.[1]
  || buildApplicationUrl(extractApplicationEmail(html))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Careers\s*·\s*Build the future of agentic AI at Payoda/i.test(page)
    && /Open Roles|Where we'?re hiring right now\./i.test(page)
    && PAYODA_APPLICATION_EMAIL_PATTERN.test(page)
    && ROLE_CARD_CTA_PATTERN.test(page)
}

export const extractRoleCards = (html) => {
  const page = String(html ?? '')
  const applyUrl = extractApplyUrl(page)
  const jobs = []

  for (const match of page.matchAll(/<button\b[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)View\s+(?:job|role)[\s\S]*?<\/button>/gi)) {
    const title = stripTags(match[1])
    const body = String(match[2] ?? '')
    const spanValues = [...body.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((spanMatch) => stripTags(spanMatch[1]))
      .filter(Boolean)

    const metadata = spanValues.filter((value) => !DOT_SEPARATOR_ONLY_PATTERN.test(value))
    const department = metadata[0] || null
    const rawLocation = metadata[1] || null
    const details = parseEmploymentDetails(metadata[2] || null)

    if (!title || !department || !rawLocation) continue

    jobs.push({
      title,
      department,
      location: normalizeLocation(rawLocation),
      city: deriveCity(rawLocation),
      experienceRequired: details.experienceRequired,
      employmentType: details.employmentType,
      sourceUrl: CAREERS_URL,
      applyUrl,
    })
  }

  return jobs
}

export const createPayodaScraper = () => ({run:runCurrentPayoda})

export const run = async (options = {}) => createPayodaScraper().run(options)

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
