import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PLACEHOLDER_JOB_TEXT_PATTERN = /^(?:n\/?a)(?:\s+(?:n\/?a))*$/i
const EXPERIENCE_PATTERNS = [
  /\b\d+\s*(?:\+|plus)\s*years?(?:\s+of\s+experience)?\b/i,
  /\b\d+\s*[-–to]+\s*\d+\s*years?(?:\s+of\s+experience)?\b/i,
  /\bminimum\s+\d+\s*years?(?:\s+of\s+experience)?\b/i,
  /\b\d+\s*years?(?:\s+of\s+experience)?\b/i,
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizePublicJobText = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || PLACEHOLDER_JOB_TEXT_PATTERN.test(normalized)) return null
  return normalized
}

export const hasOfficialLeptonCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''
  const hasLegacyApiShell = text.includes('For job-related queries email us at')
    && /https:\/\/leptonsoftware\.keka\.com\/careers\/api\/jobs\/default\/active/i.test(page)
  const hasCurrentRenderedCareersShell = text.includes('Build the geo-stack behind')
    && text.includes('Open roles')
    && text.includes('hr@leptonmaps.com')
    && /https:\/\/leptonsoftware\.keka\.com\/careers\/jobdetails\/\d+/i.test(page)

  return /<title[^>]*>\s*Careers at Lepton Software/i.test(page)
    && (hasLegacyApiShell || hasCurrentRenderedCareersShell)
}

const isIndiaLocation = (location = {}) =>
  String(location.countryCode ?? '').toUpperCase() === 'IN'
  || /\bindia\b/i.test(String(location.countryName ?? ''))

const buildJobDetailUrl = (jobId) => `https://leptonsoftware.keka.com/careers/jobdetails/${jobId}`
const buildApplyUrl = (jobId) => `https://leptonsoftware.keka.com/careers/applyjob/${jobId}`

export const hasOfficialLeptonJobDetailSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return text.includes('LEPTON SOFTWARE')
    && /job-details-container/i.test(page)
    && /Apply for this job/i.test(page)
    && /selectedJobId=/i.test(page)
}

const extractDescriptionHtmlFromJobDetailPage = (html = '') =>
  String(html ?? '').match(
    /<div class="job-description-container[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="col-lg-4/i,
  )?.[1] ?? null

export const extractJobDescriptionFromDetailPage = (html = '') =>
  normalizePublicJobText(extractDescriptionHtmlFromJobDetailPage(html))

export const extractExperienceFromText = (value = '') => {
  const normalized = normalizePublicJobText(value)
  if (!normalized) return null

  for (const pattern of EXPERIENCE_PATTERNS) {
    const match = normalized.match(pattern)
    if (match) return normalizeWhitespace(match[0])
  }

  return null
}

const shouldEnrichFromDetailPage = (job = {}) =>
  !normalizePublicJobText(job.experienceRequired)
  || !normalizePublicJobText(job.jobDescription)

export const enrichJobWithDetailPage = async (job, { fetchText = defaultFetchText } = {}) => {
  const sourceUrl = normalizeWhitespace(job?.sourceUrl)
  if (!sourceUrl) return job

  try {
    const detailHtml = await fetchText(sourceUrl)
    if (!hasOfficialLeptonJobDetailSignals(detailHtml)) {
      return job
    }

    const detailDescription = extractJobDescriptionFromDetailPage(detailHtml)
    const detailExperience = extractExperienceFromText(detailDescription)

    return {
      ...job,
      experienceRequired: normalizePublicJobText(job.experienceRequired) || detailExperience,
      jobDescription: normalizePublicJobText(job.jobDescription) || detailDescription,
      publicExperienceChecked: true,
    }
  } catch {
    return job
  }
}

export const extractJobs = (payload = []) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => {
      const jobId = normalizeWhitespace(job.id)
      const title = normalizeWhitespace(job.title)
      const location = Array.isArray(job.jobLocations)
        ? job.jobLocations.find(isIndiaLocation) || job.jobLocations[0]
        : null
      if (!jobId || !title || !location) return null

      const city = normalizeWhitespace(location.city || location.name)
      const state = normalizeWhitespace(location.state)
      const country = normalizeWhitespace(location.countryName) || 'India'
      const sourceUrl = buildJobDetailUrl(jobId)
      const applyUrl = buildApplyUrl(jobId)

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job.departmentName),
        location: [city, state, country].filter(Boolean).join(', '),
        city,
        country,
        jobId,
        requisitionId: normalizeWhitespace(job.jobNumber),
        sourceUrl,
        applyUrl,
        employmentType: normalizeWhitespace(job.jobType) === '2' || job.jobType === 2 ? 'Full Time' : null,
        experienceRequired: normalizePublicJobText(job.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(job.skillNames)
          ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(job.publishedOn)?.slice(0, 10) || null,
        closingDate: null,
        jobDescription: normalizePublicJobText(job.description || job.excerpt),
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})

export const createLeptonSoftwareExportResearchScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialLeptonCareersSignals(careersHtml)) {
      throw new Error('Lepton verified first-party careers page no longer matches the pinned Keka jobs surface')
    }

    const jobs = extractJobs(await fetchJson(JOBS_API_URL))
    const enrichedJobs = await Promise.all(
      jobs.map((job) => (shouldEnrichFromDetailPage(job)
        ? enrichJobWithDetailPage(job, { fetchText })
        : job)),
    )

    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createLeptonSoftwareExportResearchScraper(options).run(options)

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
