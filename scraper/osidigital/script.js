import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import OSI_DIGITAL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = OSI_DIGITAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_OPENINGS_URL = PROVIDER_METADATA.jobOpeningsUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const formatExperience = (experience = {}) => {
  const min = Number.isFinite(experience?.MinExp) ? experience.MinExp : null
  const max = Number.isFinite(experience?.MaxExp) ? experience.MaxExp : null

  if (min != null && max != null) {
    if (min === max) return `${min} year${min === 1 ? '' : 's'}`
    return `${min}-${max} years`
  }

  if (min != null) return `${min}+ years`
  if (max != null) return `Up to ${max} years`
  return null
}

const parseLocations = (value) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value)?.replace(/\s*,\s*/g, ', ') || null

const extractLocation = (value) => {
  const locations = parseLocations(value)
    .map((entry) => normalizeLocation(entry?.Address))
    .filter(Boolean)

  return locations.length > 0 ? locations.join('; ') : null
}

const extractCity = (location) => normalizeLocation(location)?.split(/[;,]/)[0] || null

const isIndiaLocation = (location) => /\bindia\b/i.test(normalizeWhitespace(location) || '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, options)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && /Build Your Dream Career with OSI Digital/i.test(text)
    && /Current Opportunities/i.test(text)
    && /submit your resume below/i.test(text)
}

export const hasOfficialJobOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Job Openings\s*<\/title>/i.test(page)
    && /Join the OSI Digital Family/i.test(text)
    && /open positions available in a variety of roles/i.test(text)
    && /api\.turbohire\.co\/api\/careerpagejobs/i.test(page)
}

export const extractTurboHireApiConfig = (html = '') => {
  const page = String(html ?? '')
  const apiUrl = normalizeWhitespace(
    page.match(/"url"\s*:\s*"(https:\/\/api\.turbohire\.co\/api\/careerpagejobs)"/i)?.[1],
  )
  const apiKey = normalizeWhitespace(page.match(/"X-Api-Key"\s*:\s*"([^"]+)"/i)?.[1])

  if (!apiUrl || !apiKey) return null

  return {
    apiUrl,
    apiKey,
  }
}

export const extractPublicJobs = (payload = {}) =>
  (Array.isArray(payload?.Result) ? payload.Result : [])
    .map((record) => {
      const title = normalizeWhitespace(record?.JobTitle)
      const location = extractLocation(record?.Location)
      const applyUrl = normalizeWhitespace(record?.ApplyUrl)

      if (!title || !location || !applyUrl || !isIndiaLocation(location)) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(record?.Department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: normalizeWhitespace(record?.JobId),
        requisitionId: normalizeWhitespace(record?.JobCode) || normalizeWhitespace(record?.JobId),
        sourceUrl: applyUrl,
        applyUrl,
        employmentType: normalizeWhitespace(record?.JobType),
        experienceRequired: formatExperience(record?.Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record?.Skills)
          ? record.Skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(record?.PublishedDate)
          || normalizeWhitespace(record?.UpdatedDate)
          || normalizeWhitespace(record?.CreatedDate),
        closingDate: normalizeWhitespace(record?.PromotionExpiryDate) || null,
        jobDescription: stripTags(record?.JobDescriptionV2 || record?.JobDescription),
      }
    })
    .filter(Boolean)

export const createOsiDigitalScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified OSI Digital careers page no longer matches the trusted first-party surface')
    }

    if (!careersHtml.includes(JOB_OPENINGS_URL)) {
      throw new Error('The verified OSI Digital careers page no longer exposes the trusted job openings handoff')
    }

    const jobOpeningsHtml = await fetchText(JOB_OPENINGS_URL)
    if (!hasOfficialJobOpeningsSignal(jobOpeningsHtml)) {
      throw new Error('The verified OSI Digital public jobs surface no longer matches the trusted first-party handoff')
    }

    const apiConfig = extractTurboHireApiConfig(jobOpeningsHtml)
    if (!apiConfig) {
      throw new Error('The verified OSI Digital public jobs surface no longer exposes the embedded TurboHire API config')
    }

    const payload = await fetchJson(apiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'X-Api-Key': apiConfig.apiKey,
      },
      label: `${SOURCE}-public-jobs`,
      timeoutMs: 15000,
    })

    return extractPublicJobs(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createOsiDigitalScraper().run(options)

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
