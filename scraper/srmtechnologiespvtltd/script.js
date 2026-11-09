import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { decodeJavaScriptStringLiteral } from '../../scraper-support/utils/safeLiteral.js'

import { SRM_TECHNOLOGIES_PVT_LTD_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.careersPortalUrl
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl
export const CANDIDATE_PORTAL_URL = PROVIDER_METADATA.candidatePortalUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const EMBEDDED_JOBS_MARKER = 'var jobs = JSON.parse('

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consult/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const decodeEmbeddedJobsPayload = (serialized = '') => {
  const jsStringLiteral = String(serialized ?? '')
  return decodeJavaScriptStringLiteral(`'${jsStringLiteral}'`)
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const buildLocation = (record = {}) =>
  [record.City, record.State, record.Country]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(', ') || null

const isIndiaJob = (record = {}) =>
  /india/i.test(normalizeWhitespace(record.Country) || '')
  && record.Publish !== false
  && record.Is_Locked !== true

export const hasOfficialHomepageCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*SRM Tech\b/i.test(page)
    && text.includes('Careers With Us')
    && text.includes('Open Positions')
    && page.includes(CAREERS_PORTAL_URL)
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*\|\s*Job Opportunities\s*\|\s*SRM Technologies\s*<\/title>/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && page.includes(CAREERS_PORTAL_URL)
    && /SRM Technologies/i.test(page)
}

export const extractIndiaJobs = (payload = {}) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const location = buildLocation(record)

      if (!title || !jobId || !sourceUrl || !location) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(record.Industry),
        location,
        city: normalizeWhitespace(record.City),
        state: normalizeWhitespace(record.State),
        country: normalizeWhitespace(record.Country),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)

export const extractEmbeddedJobs = (html = '') => {
  const page = String(html ?? '')
  const markerIndex = page.indexOf(EMBEDDED_JOBS_MARKER)
  if (markerIndex < 0) return []

  const serializedMatch = page
    .slice(markerIndex)
    .match(/var jobs = JSON\.parse\('([\s\S]*?)'\);/i)

  if (!serializedMatch) return []

  try {
    const decoded = decodeEmbeddedJobsPayload(serializedMatch[1])
    const jobs = JSON.parse(decoded)
    return Array.isArray(jobs) ? jobs : []
  } catch {
    return []
  }
}

export const extractJobDetail = (html = '', listing = {}) => {
  const detail = extractEmbeddedJobs(html)[0] || {}
  const jobDescription = normalizeWhitespace(detail.Job_Description) || listing.jobDescription || null
  const experienceRequired = normalizeWhitespace(detail.Work_Experience) || listing.experienceRequired || null

  return {
    ...listing,
    title: normalizeWhitespace(detail.Posting_Title || detail.Job_Opening_Name) || listing.title || null,
    department: normalizeWhitespace(detail.Industry) || listing.department || null,
    location: buildLocation(detail) || listing.location || null,
    city: normalizeWhitespace(detail.City) || listing.city || null,
    state: normalizeWhitespace(detail.State) || listing.state || null,
    country: normalizeWhitespace(detail.Country) || listing.country || null,
    employmentType: normalizeEmploymentType(detail.Job_Type) || listing.employmentType || null,
    experienceRequired,
    postingDate: normalizeWhitespace(detail.Date_Opened) || listing.postingDate || null,
    jobDescription,
    remoteStatus: detail.Remote_Job ? 'Remote' : (listing.remoteStatus || 'On-site'),
    publicExperienceChecked: Object.keys(detail).length > 0,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createSrmTechnologiesPvtLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialHomepageCareersSignal(homepageHtml)) {
      throw new Error('The verified SRM Technologies homepage no longer matches the trusted first-party careers handoff')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('The verified SRM Technologies public careers portal no longer matches the trusted Zoho surface')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('SRM Technologies public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)
    if (!jobs.length) {
      throw new Error('SRM Technologies public jobs API no longer exposes trusted India jobs')
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const detailedJobs = await Promise.all(selectedJobs.map(async (job) => {
      try {
        const detailHtml = await fetchText(job.sourceUrl)
        return extractJobDetail(detailHtml, job)
      } catch {
        return job
      }
    }))

    return detailedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSrmTechnologiesPvtLtdScraper(options).run(options)

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
