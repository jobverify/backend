import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import YAMAHA_MOTORS_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = YAMAHA_MOTORS_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SEARCH_API_URL = PROVIDER_METADATA.searchApiUrl
export const COMPANY_ID = PROVIDER_METADATA.companyApiId
export const COMPANY_URL = 'careers.ymsl.in/'
export const JOBVIEW_BASE_URL = 'https://careers.ymsl.in/ymsl/jobview'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const deriveCity = (value) => normalizeWhitespace(String(value ?? '').split(',')[0])

const inferCountry = (value) => /\bindia\b/i.test(String(value ?? '')) ? 'India' : null

const normalizePostingDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10)
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toISOString().slice(0, 10)
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .filter(Boolean)
    .join(' '),
)

const buildSearchPayload = () => {
  const form = new FormData()
  form.append('id', COMPANY_ID)
  form.append('companyUrl', COMPANY_URL)
  form.append('job', '')
  form.append('city', '')
  form.append('userGeoLocation', '')
  form.append('departmentName', '')
  form.append('fieldName', '')
  form.append('fieldValue', '')
  return form
}

const buildApplyUrl = (jobUrl, id) => `${JOBVIEW_BASE_URL}/${normalizeWhitespace(jobUrl) || ''}?id=${normalizeWhitespace(id) || ''}`

const sortJobs = (jobs) => [...jobs].sort((left, right) =>
  String(left.title || '').localeCompare(String(right.title || ''), 'en', { sensitivity: 'base' }))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultSearchJobs = () => fetchJsonWithRetry(SEARCH_API_URL, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  body: buildSearchPayload(),
  label: SOURCE,
  timeoutMs: 30000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Yamaha - Careers\s*<\/title>/i.test(page)
    && (
      /Find Authentic Jobs at Yamaha Motor Solutions/i.test(page)
      || /Be Cautious/i.test(page)
    )
    && /does not authorize any third party/i.test(page)
}

export const extractSearchResults = (payload = []) => {
  if (!Array.isArray(payload)) {
    throw new Error('Yamaha Motors Solutions verified public zwayam search payload no longer matches the expected array contract')
  }

  return payload
    .map((item) => item?._source || item)
    .map((record) => {
      const location = normalizeWhitespace(record?.location)
      const jobId = normalizeWhitespace(record?.id)
      const jobUrl = normalizeWhitespace(record?.jobUrl)
      const country = inferCountry(location)
      if (!location || !jobId || !jobUrl || country !== 'India') return null

      return {
        title: normalizeWhitespace(record?.jobTitle),
        company: COMPANY,
        location,
        city: deriveCity(location),
        country,
        jobId,
        requisitionId: normalizeWhitespace(record?.refNumber) || jobId,
        sourceUrl: buildApplyUrl(jobUrl, jobId),
        applyUrl: buildApplyUrl(jobUrl, jobId),
        department: null,
        employmentType: null,
        experienceRequired: normalizeWhitespace(record?.experienceUIField),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record?.mandatorySkills)
          ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizePostingDate(record?.modifiedDate),
        closingDate: null,
        jobDescription: joinDescriptionParts(
          normalizeWhitespace(record?.shortDescriptionDb),
          Array.isArray(record?.mandatorySkills) ? record.mandatorySkills.join(', ') : '',
        ),
      }
    })
    .filter((job) => job?.title)
}

export const createYamahaMotorsSolutionsScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    searchJobs = defaultSearchJobs,
    now: overrideNow = now,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Yamaha Motors Solutions verified first-party careers page no longer matches the known official surface')
    }

    const jobs = extractSearchResults(await searchJobs({
      searchApiUrl: SEARCH_API_URL,
      companyId: COMPANY_ID,
      companyUrl: COMPANY_URL,
    }))

    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return sortJobs(selectedJobs).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: overrideNow(),
    }))
  },
})

export const run = async (options = {}) => createYamahaMotorsSolutionsScraper(options).run(options)

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
