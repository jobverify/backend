import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createBceNativeInventoryScraper } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://bceglobaltech.com/career'
export const JOBS_API_URL = 'https://uh2nqa8l04.execute-api.ca-central-1.amazonaws.com/prod/joblist'
export const AUTHORIZATION_HEADER_NAME = 'authorizationToken'
const COMPANY_NAME = 'BCE Global Tech'
const SOURCE = 'bceglobaltech'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const parseSkills = (value) => {
  if (Array.isArray(value)) return value.map(normalizeWhitespace).filter(Boolean)

  return String(value ?? '')
    .split(',')
    .map(normalizeWhitespace)
    .filter(Boolean)
}

const parseJsonString = (value) => {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const unwrapRecords = (payload = {}) => {
  const outer = parseJsonString(payload?.body ?? payload)
  const inner = parseJsonString(outer?.data ?? outer)
  return Array.isArray(inner) ? inner : []
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City || record.city)
  const country = normalizeWhitespace(record.Country || record.country || record.Country1)

  if (city && country) return { location: `${city}, ${country}`, city, country }
  if (country) return { location: country, city: null, country }
  if (city) return { location: city, city, country: null }
  return { location: null, city: null, country: null }
}

export const buildRequestHeaders = ({ authorizationToken } = {}) => {
  if (!normalizeWhitespace(authorizationToken)) {
    throw new Error('BCE Global Tech scraper requires an authorizationToken header value')
  }

  return {
    Accept: 'application/json,text/plain,*/*',
    [AUTHORIZATION_HEADER_NAME]: authorizationToken,
  }
}

export const extractBundleScriptUrl = (html, baseUrl = CAREER_PAGE_URL) => {
  for (const match of String(html ?? '').matchAll(/<script[^>]+src=["']([^"']*\/static\/js\/main[^"']+\.js)["'][^>]*>/gi)) {
    try {
      return new URL(match[1], baseUrl).toString()
    } catch {
      continue
    }
  }

  return null
}

export const extractAuthorizationToken = (bundleJs) =>
  normalizeWhitespace(
    String(bundleJs ?? '').match(/authorizationToken\s*:\s*["']([^"']+)["']/i)?.[1] ?? null,
  )

export const extractSearchResults = (payload) =>
  unwrapRecords(payload)
    .map((record) => {
      const title = normalizeWhitespace(
        record.Job_Opening_Name || record.Posting_Title || record.jobTitle,
      )
      const jobId = normalizeWhitespace(record.id || record.jobId)
      const sourceUrl = normalizeWhitespace(record.$url || record.url || record.jobUrl)
      const { location, city, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl) return null

      return {
        title,
        company: COMPANY_NAME,
        department: normalizeWhitespace(record.Department || record.department),
        location,
        city,
        country,
        jobId,
        requisitionId: normalizeWhitespace(record.requisitionId) || jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type || record.jobType),
        experienceRequired: normalizeWhitespace(record.Experience || record.experience),
        minimumQualification: normalizeWhitespace(
          record.Minimum_Qualification || record.minimumQualification,
        ),
        preferredQualification: normalizeWhitespace(
          record.Preferred_Qualification || record.preferredQualification,
        ),
        requiredSkills: parseSkills(
          record.Skill_Set || record.Required_Skills || record.requiredSkills,
        ),
        postingDate: normalizeWhitespace(record.Date_Opened || record.postingDate),
        closingDate: normalizeWhitespace(record.Closing_Date || record.closingDate),
        jobDescription: stripHtml(record.Job_Description || record.jobDescription),
      }
    })
    .filter(Boolean)

export const createBceGlobalTechScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => createBceNativeInventoryScraper({ maxJobs: maxJobs ?? 0 })

export const run = async (options = {}) => createBceGlobalTechScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running BCE Global Tech scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
