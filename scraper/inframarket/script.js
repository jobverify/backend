import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PORTAL_ORIGIN = 'https://imcareers.peoplestrong.com'
export const CAREERS_PAGE_URL = 'https://infra.market/careers/'
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_SEARCH_BODY = {
  bandList: [],
  gradeList: [],
  bandIDList: [],
  gradeIDList: [],
  employeeCategoryLabelList: [],
}

const COMPANY_NAME = 'Infra.Market'
const SOURCE = 'inframarket'
const JOBS_API_PATH = `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/jobs/v1`

const normalize = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalize(value)
    if (normalized) return normalized
  }

  return null
}

const extractCity = (location) => normalize(String(location ?? '').split(',')[0]) || null

const extractCountry = (record = {}, location = null) => firstNonEmpty(
  record.country,
  Array.isArray(record.countryList) ? record.countryList[0] : null,
  normalize(String(location ?? '').split(',').pop()),
)

const flattenSkills = (skills) => [...new Set(
  [skills?.mustTohave, skills?.goodtohave]
    .flatMap((group) => Array.isArray(group) ? group : [])
    .map((skill) => normalize(skill))
    .filter(Boolean),
)]

export const buildApiUrl = ({ offset = 0, limit = DEFAULT_PAGE_SIZE } = {}) => (
  `${JOBS_API_PATH}?offset=${offset}&limit=${limit}`
)

export const buildJobDetailUrl = (jobCode) => (
  jobCode ? `${PORTAL_ORIGIN}/job/detail/${encodeURIComponent(jobCode)}` : null
)

export const buildPublicHeaders = () => ({
  Origin: PORTAL_ORIGIN,
  Referer: `${PORTAL_ORIGIN}/job/joblist`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Content-Type': 'application/json',
})

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const extractSearchResults = (payload = {}) =>
  (Array.isArray(payload.response) ? payload.response : [])
    .map((record) => {
      const title = firstNonEmpty(record.jobTitle, record.title)
      const jobCode = firstNonEmpty(record.jobCode, record.reqCode, record.requisitionId, record.jobId)
      const sourceUrl = firstNonEmpty(record.jobDetailUrl, buildJobDetailUrl(jobCode))
      const location = firstNonEmpty(record.locationHierarchy, record.location, record.locationName)

      if (!title || !jobCode || !sourceUrl) return null

      return {
        title,
        company: COMPANY_NAME,
        department: firstNonEmpty(record.organizationUnit, record.department, record.departmentName),
        location,
        city: extractCity(location),
        country: extractCountry(record, location),
        jobId: firstNonEmpty(record.jobCode, record.jobId, record.requisitionId),
        requisitionId: firstNonEmpty(record.requisitionId, record.jobCode, record.jobId),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: firstNonEmpty(
          record.employmentTenureType,
          record.employmentType,
          record.jobType,
        ),
        experienceRequired: firstNonEmpty(record.expRange, record.experience, record.experienceRange),
        minimumQualification: firstNonEmpty(record.minimumQualification, record.minQualification),
        preferredQualification: firstNonEmpty(record.preferredQualification, record.prefQualification),
        requiredSkills: flattenSkills(record.skills),
        postingDate: firstNonEmpty(record.jobPostedDate, record.postingDate, record.postedOn),
        closingDate: firstNonEmpty(record.jobClosureDate, record.closingDate, record.expiryDate),
        jobDescription: firstNonEmpty(record.jobDescription, record.description),
      }
    })
    .filter(Boolean)

export const createInfraMarketScraper = () => ({
  async run({
    fetchJson = defaultFetchJson,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = Number.POSITIVE_INFINITY,
  } = {}) {
    const jobs = []

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      const payload = await fetchJson(buildApiUrl({ offset, limit: pageSize }), {
        method: 'POST',
        headers: buildPublicHeaders(),
        body: JSON.stringify(DEFAULT_SEARCH_BODY),
      })

      const pageJobs = extractSearchResults(payload)
      jobs.push(...pageJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })))

      const responseCount = Array.isArray(payload?.response) ? payload.response.length : 0
      const totalRecords = Number.parseInt(String(payload?.totalRecords ?? ''), 10)

      if (responseCount === 0) break
      if (Number.isFinite(totalRecords) && offset + responseCount >= totalRecords) break
    }

    return jobs
  },
})

export const run = async () => createInfraMarketScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    console.log('DB result:', await saveToDB(jobs, SOURCE))
  }
}
