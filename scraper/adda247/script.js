import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCurrentAdda247Scraper } from './currentNative.js'
import { ADDA247_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ADDA247_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXTERNAL_HANDOFF_URL = PROVIDER_METADATA.externalHandoffUrl
export const KEKA_CAREERS_URL = PROVIDER_METADATA.kekaCareersUrl
export const KEKA_ACTIVE_JOBS_API_URL = PROVIDER_METADATA.kekaActiveJobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_ORIGIN = new URL(CAREERS_URL).origin
const CAREERS_PAGE_PATH = String(new URL(CAREERS_URL).pathname).replace(/\/+$/, '')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const trimTrailingSlash = (value) => String(value ?? '').replace(/\/+$/, '')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')

const isExpectedJoinUsUrl = (value) => {
  try {
    return new URL(String(value ?? '')).hostname.toLowerCase() === 'docs.google.com'
  } catch {
    return false
  }
}

const buildKekaJobUrl = (jobId) => toAbsoluteUrl(`jobdetails/${encodeURIComponent(jobId)}`, KEKA_CAREERS_URL)

const normalizeKekaJobText = (value) => normalizeWhitespace(decodeHtmlEntities(value))

const getIndiaLocations = (locations = []) => (
  Array.isArray(locations) ? locations : []
)
  .filter((location) => (
    /^(?:IN|IND)$/i.test(String(location?.countryCode ?? '').trim())
    || /^India$/i.test(String(location?.countryName ?? '').trim())
  ))

const getKekaLocationName = (location = {}) => {
  const name = normalizeKekaJobText(location.name)
  if (name) return name

  const city = normalizeKekaJobText(location.city)
  if (city) return city

  const state = normalizeKekaJobText(location.state)
  if (state) return state

  return null
}

const buildKekaLocation = (locations = []) => {
  const labels = []
  const seen = new Set()

  for (const location of getIndiaLocations(locations)) {
    const name = getKekaLocationName(location)
    if (!name) continue

    const label = `${name}, India`
    const key = label.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    labels.push(label)
  }

  return labels.join('; ') || null
}

const extractKekaCity = (locations = []) => {
  for (const location of getIndiaLocations(locations)) {
    const name = getKekaLocationName(location)
    if (name) return name
  }

  return null
}

export const extractJoinUsUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Join Us\s*<\/a>/i,
  )

  return toAbsoluteUrl(match?.[1], CAREERS_URL)
}

export const extractExternalHandoffUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl === EXTERNAL_HANDOFF_URL) {
      return absoluteUrl
    }
  }

  return null
}

const isFirstPartyJobRecordUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = trimTrailingSlash(url.pathname)

    return url.origin === CAREERS_ORIGIN
      && pathname !== CAREERS_PAGE_PATH
      && /^\/careers?\//i.test(pathname)
  } catch {
    return false
  }
}

export const extractFirstPartyJobRecordUrls = (html = '') => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (!absoluteUrl || seen.has(absoluteUrl) || !isFirstPartyJobRecordUrl(absoluteUrl)) continue

    seen.add(absoluteUrl)
    urls.push(absoluteUrl)
  }

  return urls
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('#jobhaitohraubhai')
    && /#?\s*join adda247 to change the future of education\./i.test(normalized)
    && normalized.includes('why join us?')
    && normalized.includes('become a part of the mission to provide high quality affordable education to bharat!')
    && normalized.includes('working with us')
    && normalized.includes('we take care of you so that you can build bharat with us!')
}

export const extractKekaJobs = (payload = [], { now = () => new Date().toISOString() } = {}) => {
  if (!Array.isArray(payload)) return []

  const scrapedAt = now()

  return payload
    .map((record) => {
      const jobId = normalizeKekaJobText(record?.id)
      const title = normalizeKekaJobText(record?.title)
      const sourceUrl = jobId ? buildKekaJobUrl(jobId) : null
      const indiaLocations = getIndiaLocations(record?.jobLocations)

      if (!jobId || !title || !sourceUrl || indiaLocations.length === 0) return null

      return {
        title,
        company: COMPANY,
        department: normalizeKekaJobText(record.departmentName),
        location: buildKekaLocation(record.jobLocations),
        city: extractKekaCity(record.jobLocations),
        country: 'India',
        jobId,
        requisitionId: normalizeKekaJobText(record.jobNumber) || jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: normalizeKekaJobText(record.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record.skillNames)
          ? record.skillNames.map((skill) => normalizeKekaJobText(skill)).filter(Boolean)
          : [],
        postingDate: normalizeKekaJobText(record.publishedOn),
        closingDate: null,
        jobDescription: normalizeKekaJobText(record.description || record.excerpt),
        salaryRange: normalizeKekaJobText(record.salaryRangeFormat),
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      }
    })
    .filter(Boolean)
}

export const createAdda247Scraper = () => createCurrentAdda247Scraper()

export const run = async (options = {}) => createAdda247Scraper().run(options)

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
