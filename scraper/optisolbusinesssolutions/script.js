import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { OPTISOL_BUSINESS_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = OPTISOL_BUSINESS_SOLUTIONS_CATALOG.source
export const COMPANY_NAME = OPTISOL_BUSINESS_SOLUTIONS_CATALOG.companyName
export const COMPANY = COMPANY_NAME
export const CAREERS_LANDING_URL = OPTISOL_BUSINESS_SOLUTIONS_CATALOG.homepageUrl
export const CURRENT_OPENINGS_URL = OPTISOL_BUSINESS_SOLUTIONS_CATALOG.currentOpeningsUrl
export const CAREERS_PORTAL_URL = OPTISOL_BUSINESS_SOLUTIONS_CATALOG.careersPortalUrl
export const CAREERS_API_URL = OPTISOL_BUSINESS_SOLUTIONS_CATALOG.careersApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripHtml = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|section|article|h[1-6]|span|td|th|tr|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeWhitespace = (value) => stripHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const titleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())
  || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time|fte/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  let match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) {
    const [, month, day, year] = match
    return `${year}-${month}-${day}`
  }

  match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    return normalized
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
    ?.replace(/^Experience:\s*/i, '')
    .replace(/[–—]/g, '-')
    .trim()

  if (!normalized) return null

  let match = normalized.match(/^(\d+)\s*\+\s*years?$/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/^(\d+)\s*(?:to|-)\s*(\d+)\s*years?$/i)
  if (match) return `${match[1]}-${match[2]} years`

  return normalized.replace(/\bYears?\b/i, 'years')
}

const extractMetadataValue = (description, label, nextLabels = []) => {
  const boundary = nextLabels.length > 0
    ? `(?=\\s+(?:${nextLabels.join('|')})\\s*:|$)`
    : '$'
  const match = normalizeWhitespace(description)?.match(
    new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)${boundary}`, 'i'),
  )

  return normalizeWhitespace(match?.[1])
}

const getRemoteStatus = (record = {}, description = '') => {
  if (record.Remote_Job === true) return 'Remote'

  const normalized = normalizeWhitespace(description) || ''
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  if (/remote/i.test(normalized)) return 'Remote'
  return 'On-site'
}

const isPublishedRecord = (record = {}) => record.Publish !== false
const isUnlockedRecord = (record = {}) => record.Is_Locked !== true && record.Locked !== true
const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const getLocationParts = (record = {}) => {
  const city = titleCase(record.City)
  const state = titleCase(record.State)
  const country = titleCase(record.Country)
  const location = [city || state, country].filter(Boolean).join(', ') || null

  return { location, city, state, country }
}

const isExpectedCurrentOpeningsUrl = (value) => {
  try {
    const url = new URL(value)
    return /^www\.optisolbusiness\.com$/i.test(url.hostname)
      && /^\/current-openings\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

export const hasOfficialCareersLandingSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''
  return normalized.includes('MORE THAN JUST A JOB')
    && normalized.includes('Jobs at OptiSol')
    && [...String(html ?? '').matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
      .some((match) =>
        isExpectedCurrentOpeningsUrl(new URL(match[1], CAREERS_LANDING_URL).toString()),
      )
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Job Openings at OptiSol Chennai, Madurai \| Hiring Software Developers \| Web &amp; Mobile App Developers\s*<\/title>/i.test(page)
    && normalized.includes("Let's grow together")
    && /rec_embed_js\.load\(\{[\s\S]*?widget_id\s*:\s*["']rec_job_listing_div["'][\s\S]*?page_name\s*:\s*["']Careers["'][\s\S]*?source\s*:\s*["']CareerSite["'][\s\S]*?site\s*:\s*["']https:\/\/optisolbusiness\.zohorecruit\.in["'][\s\S]*?empty_job_msg\s*:\s*["']No current Openings["'][\s\S]*?\}\s*\)/i.test(page)
}

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => isIndiaJob(record) && isPublishedRecord(record) && isUnlockedRecord(record))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = normalizeWhitespace(record.$url)
    const description = normalizeWhitespace(record.Job_Description)
    const { location, city, state, country } = getLocationParts(record)

    if (!title || !jobId || !sourceUrl || !location || !country) {
      return null
    }

    return {
      title,
      company: COMPANY_NAME,
      department: normalizeWhitespace(record.Department || record.Industry),
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.Job_Type || extractMetadataValue(description, 'Employment Type')),
      experienceRequired: normalizeExperience(
        record.Work_Experience
        || record.Experience
        || extractMetadataValue(description, 'Experience', ['Location', 'Employment Type']),
      ),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeDate(record.Date_Opened),
      closingDate: null,
      jobDescription: description,
      remoteStatus: getRemoteStatus(record, description),
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createOptiSolBusinessSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('OptiSol Business Solutions verified careers landing page no longer matches the pinned first-party surface')
    }

    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('OptiSol Business Solutions verified current openings page no longer matches the pinned first-party surface')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('OptiSol Business Solutions public jobs api no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createOptiSolBusinessSolutionsScraper().run(options)

export const persistScrapeResults = async ({
  argv = process.argv,
  runImpl = run,
  saveToFileImpl,
  saveToDBImpl,
  outputFile = path.join(currentDir, 'jobs.json'),
} = {}) => {
  const jobs = await runImpl()

  if (!saveToFileImpl || !saveToDBImpl) {
    const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
    saveToFileImpl ??= saveToFile
    saveToDBImpl ??= saveToDB
  }

  if (argv.includes('--dry-run')) {
    await saveToFileImpl(jobs, outputFile)
    return jobs
  }

  await saveToDBImpl(jobs, SOURCE)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await persistScrapeResults()
}
