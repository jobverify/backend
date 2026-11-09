import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://decimalpointanalytics.com/careers/current-openings'
export const JOBS_API_URL = 'https://dpa.hono.ai/nodejs/getRFRListOnCandidatePortal'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const isoDate = /^(\d{4}-\d{2}-\d{2})T/.exec(normalized)
  if (isoDate) return isoDate[1]

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString().slice(0, 10)
}

const experienceTokenToYears = (value) => {
  const match = /^(\d+)-(\d+)$/.exec(normalizeWhitespace(value))
  if (!match) return null

  return Number(match[1]) + (Number(match[2]) / 12)
}

const formatYears = (value) => Number.isInteger(value)
  ? String(value)
  : String(Number(value.toFixed(1)))

const normalizeExperience = (minimum, maximum) => {
  const minYears = experienceTokenToYears(minimum)
  const maxYears = experienceTokenToYears(maximum)
  if (minYears == null && maxYears == null) return null
  if (minYears != null && maxYears != null) return `${formatYears(minYears)}-${formatYears(maxYears)} years`
  if (minYears != null) return `${formatYears(minYears)}+ years`
  return `${formatYears(maxYears)} years`
}

const parseDescription = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const blocks = JSON.parse(value)?.blocks
    const description = Array.isArray(blocks)
      ? blocks.map((block) => normalizeWhitespace(block?.text)).filter(Boolean).join(' ')
      : ''
    return description || normalized
  } catch {
    return normalized
  }
}

const collectSkills = (job) => [...new Set([
  ...(Array.isArray(job.skills_List) ? job.skills_List.map((item) => item?.Name) : []),
  ...(Array.isArray(job.other_skills) ? job.other_skills : []),
].map(normalizeWhitespace).filter(Boolean))]

const collectQualifications = (job) => {
  const qualifications = Array.isArray(job.qualification)
    ? job.qualification.map((item) => normalizeWhitespace(item?.Qual_Name)).filter(Boolean)
    : []
  return qualifications.length > 0 ? qualifications.join(', ') : null
}

export const buildJobDetailUrl = (rfrId) => {
  const url = new URL(`${CAREER_PAGE_URL}/opening-details`)
  url.searchParams.set('rfr', normalizeWhitespace(rfrId))
  return url.toString()
}

export const extractJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .map((job) => {
    const jobId = normalizeWhitespace(job?.rfr_id)
    const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null
    const location = normalizeWhitespace(job?.worklocmast_details?.WLOC_NAME || job?.locmast_details?.LOC_NAME)
    const employmentType = normalizeWhitespace(job?.dsgmast_designation_details?.DSG_NAME)

    return {
      title: normalizeWhitespace(job?.roleDetails?.ROLE_NAME),
      company: 'Decimal Point Analytics',
      department: normalizeWhitespace(job?.functmast_details?.FUNCT_NAME) || null,
      location: location || null,
      city: location || null,
      jobId,
      requisitionId: normalizeWhitespace(job?.id) || null,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: employmentType && employmentType.toLowerCase() !== 'na' ? employmentType : null,
      experienceRequired: normalizeExperience(job?.minimum_experience, job?.maximum_experience),
      minimumQualification: collectQualifications(job),
      preferredQualification: null,
      requiredSkills: collectSkills(job),
      postingDate: normalizeDate(job?.published_date),
      closingDate: null,
      jobDescription: parseDescription(job?.job_description),
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, { method: 'GET', headers: options.headers })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createDecimalPointScraper = ({
  fetchJson = defaultFetchJson,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run() {
    const payload = await fetchJson(JOBS_API_URL, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        domainurl: 'dpa.hono.ai',
      },
    })
    const jobs = extractJobs(payload).map((job) => ({
      ...job,
      source: 'decimalpoint',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))

    return maxJobs != null && maxJobs >= 0 ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createDecimalPointScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  console.log(`Total India jobs scraped: ${jobs.length}`)

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'decimalpoint')
}
