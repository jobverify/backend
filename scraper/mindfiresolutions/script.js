import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MINDFIRE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MINDFIRE_SOLUTIONS_CATALOG.source
export const COMPANY = MINDFIRE_SOLUTIONS_CATALOG.companyName
export const CAREERS_URL = MINDFIRE_SOLUTIONS_CATALOG.companyCareerPage
export const JOBS_API_URL = MINDFIRE_SOLUTIONS_CATALOG.jobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&ndash;/gi, '-')
  .replace(/&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '),
)

const buildExperienceRange = ({ minExp, maxExp }) => {
  const min = Number.isFinite(Number(minExp)) ? Number(minExp) : null
  const max = Number.isFinite(Number(maxExp)) ? Number(maxExp) : null
  if (min == null && max == null) return null
  if (min != null && max != null) return `${min}-${max} years`
  return `${min ?? max} years`
}

const mapJobType = (value) => {
  const numeric = Number(value)
  if (numeric === 1) return 'Full Time'
  if (numeric === 2) return 'Part Time'
  if (numeric === 3) return 'Contract'
  return normalizeText(value)
}

const splitHtmlLines = (value) => stripTags(value)
  .split('\n')
  .map((line) => normalizeText(line))
  .filter(Boolean)

const buildLocation = (value) => normalizeText(value)

const buildCity = (location) => {
  const primaryToken = String(location ?? '').split(',')[0]
  return primaryToken ? normalizeCity(primaryToken) || normalizeText(primaryToken) : null
}

const buildDetailUrl = (jobPostingId, position) =>
  `https://apply.mindfiresolutions.com/current-openings/details?id=${jobPostingId}&position=${encodeURIComponent(position)}`

const buildApplyUrl = (jobPostingId, position) =>
  `https://apply.mindfiresolutions.com/apply?id=${jobPostingId}&position=${encodeURIComponent(position)}`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Career Possibilities/i.test(page)
    && /apply\.mindfiresolutions\.com/i.test(page)
    && /APPLY NOW/i.test(page)
}

export const extractJobsFromJobpostPayload = (payload = []) => (Array.isArray(payload) ? payload : [])
  .filter((job) => Number(job?.isPublished ?? 1) === 1 && Number(job?.isActive ?? 1) === 1)
  .map((job) => {
    const title = normalizeText(job.position)
    if (!title || !job.jobPostingId) return null

    const location = buildLocation(job.locations)
    const minimumQualification = stripTags(job.qualifications)
    const requiredSkills = splitHtmlLines(job.requiredSkills)
    const sections = [
      normalizeText(job.jobDetails),
      stripTags(job.responsibilities) ? `Responsibilities\n${stripTags(job.responsibilities)}` : null,
      minimumQualification ? `Qualifications\n${minimumQualification}` : null,
      requiredSkills.length > 0 ? `Required Skills\n${requiredSkills.map((line) => `- ${line}`).join('\n')}` : null,
      stripTags(job.exposureSkills) ? `Nice to Have\n${stripTags(job.exposureSkills)}` : null,
      stripTags(job.compensation) ? `Compensation\n${stripTags(job.compensation)}` : null,
    ].filter(Boolean)

    return {
      title,
      jobId: `${SOURCE}-${job.jobPostingId}`,
      requisitionId: String(job.jobPostingId),
      sourceUrl: buildDetailUrl(job.jobPostingId, title),
      applyUrl: buildApplyUrl(job.jobPostingId, title),
      location,
      city: buildCity(location),
      employmentType: mapJobType(job.jobType),
      workplaceType: location && /remote working/i.test(location) ? 'Remote' : null,
      experienceRequired: buildExperienceRange(job),
      minimumQualification: minimumQualification || null,
      preferredQualification: null,
      requiredSkills,
      compensation: stripTags(job.compensation) || null,
      postingDate: normalizeText(job.publishDate)?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      closingDate: null,
      openingsCount: null,
      jobDescription: sections.join('\n\n') || null,
      companyCareerPage: CAREERS_URL,
    }
  })
  .filter(Boolean)
  .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))

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
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMindfireSolutionsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Mindfire Solutions careers page no longer matches the trusted first-party surface')
    }

    const payload = await fetchJson(JOBS_API_URL)
    const jobs = extractJobsFromJobpostPayload(payload)
    if (jobs.length === 0) {
      throw new Error('Mindfire Solutions no longer exposes trusted public jobpost data')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyDomain: MINDFIRE_SOLUTIONS_CATALOG.companyDomain,
      atsPlatform: MINDFIRE_SOLUTIONS_CATALOG.atsPlatform,
      country: 'India',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createMindfireSolutionsScraper().run(options)

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
