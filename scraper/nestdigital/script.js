import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nestdigital'
export const COMPANY = 'NeST Digital'
export const CAREERS_URL = 'https://nestdigital.com/career/'
export const JOBS_HOST_URL = 'https://careers.nestdigital.com/'
export const ZAPPYHIRE_API_ORIGIN = 'https://nestdigital.zappyhire-multitenant-be-prod.zappyhire.com'
export const CONFIG_URL = `${ZAPPYHIRE_API_ORIGIN}/api/careers/configurations/`
export const FILTER_PARAMS_URL = `${ZAPPYHIRE_API_ORIGIN}/api/careers/filter-params/`
export const DEFAULT_PAGE_SIZE = 100

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const titleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .split(' ')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ') || null

const defaultFetchText = (url, { signal } = {}) => fetch(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
})

const defaultFetchJson = (url, { signal } = {}) => fetch(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  redirect: 'follow',
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
})

const normalizePageNumber = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const normalizePageSize = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE_SIZE
}

export const buildJobsApiUrl = ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => `${ZAPPYHIRE_API_ORIGIN}/api/jobs/jobsearch/?page=${normalizePageNumber(page)}&page_size=${normalizePageSize(pageSize)}`

export const buildJobDetailUrl = (jobId) =>
  `${ZAPPYHIRE_API_ORIGIN}/api/careers/jobs/${encodeURIComponent(String(jobId ?? ''))}/`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /Give Wings to your\s*dreams at NeST Digital!/i.test(text)
    && /EXPLORE NOW/i.test(text)
    && /careers\.nestdigital\.com/i.test(page)
    && /Latest Jobs/i.test(text)
}

export const hasZappyhireConfigSignal = (payload = {}) => {
  const results = payload?.results ?? {}
  const filters = Array.isArray(results.career_filters) ? results.career_filters : []

  return payload?.status === 1
    && results.name === 'NeST Digital'
    && results.career_text_heading === 'Next is Digital. Next is NeST'
    && results.website === 'https://www.nestdigital.com/'
    && filters.some((filter) => filter?.slug === 'departments' && filter?.filter === true)
    && filters.some((filter) => filter?.slug === 'job_types' && filter?.filter === true)
    && filters.some((filter) => filter?.slug === 'locations' && filter?.filter === true)
}

export const hasZappyhireFilterParamsSignal = (payload = {}) => {
  const results = payload?.results ?? {}
  const locations = Array.isArray(results.locations) ? results.locations : []
  const departments = Array.isArray(results.departments) ? results.departments : []
  const jobTypes = Array.isArray(results.job_types) ? results.job_types : []

  return payload?.status === 1
    && locations.includes('Bangalore')
    && locations.includes('Kochi Ntp')
    && departments.includes('General')
    && jobTypes.some((jobType) => jobType?.value === 'full_time' && jobType?.label === 'Full Time')
}

const hasValidJobSearchPayloadShape = (payload = {}) =>
  payload?.status === 1
  && Number.isFinite(Number(payload?.results?.total?.value ?? 0))
  && Array.isArray(payload?.results?.hits)

export const extractJobHits = (payload = {}) => {
  if (!hasValidJobSearchPayloadShape(payload)) {
    throw new Error('NeST Digital verified jobs API changed materially')
  }

  return payload.results.hits
}

const normalizeLocation = (locations = [], fallbackValue = null) => {
  const rawLocation = normalizeWhitespace(locations?.[0]?.city || fallbackValue)
  if (!rawLocation) return 'India'

  if (/^pan india$/i.test(rawLocation)) {
    return 'India'
  }

  const [cityPart, statePart] = rawLocation.split('-').map((part) => titleCase(part))
  if (cityPart && statePart) {
    return `${cityPart}, ${statePart}, India`
  }

  return `${titleCase(rawLocation)}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || normalized === 'India') return null

  const [firstPart] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return normalizeCity(firstPart || normalized)
}

const normalizeEmploymentType = (value) => normalizeWhitespace(value) || null

const normalizeExperienceRequired = (minExperience, maxExperience) => {
  const min = Number(minExperience)
  const max = Number(maxExperience)

  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    return `${min}-${max} years`
  }

  if (Number.isFinite(min)) {
    return `${min}+ years`
  }

  return null
}

const normalizeSkills = (skills = []) =>
  Array.isArray(skills)
    ? [...new Set(skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean))]
    : []

const pickCareerPageApplyUrl = (jobBoardUrls = [], jobId) => {
  const preferredUrl = jobBoardUrls.find((item) => item?.name === 'Career Page' && normalizeWhitespace(item?.url))
    ?.url

  return normalizeWhitespace(preferredUrl)
    || `${JOBS_HOST_URL}apply/?job=${encodeURIComponent(String(jobId ?? ''))}&source=1`
}

const normalizeJob = (hit, detailPayload, now) => {
  const summary = hit?._source ?? {}
  const detail = detailPayload?.results ?? {}
  const requisitionId = normalizeWhitespace(detail.id ?? summary.job)
  const title = normalizeWhitespace(detail.title ?? summary.title)
  const location = normalizeLocation(detail.location, summary.location)
  const applyUrl = pickCareerPageApplyUrl(detail.job_board_urls, requisitionId)

  if (!title || !requisitionId) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(detail.department ?? summary.department),
    location,
    city: deriveCity(location),
    country: 'India',
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId: String(requisitionId),
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(detail.job_type ?? summary.job_type),
    experienceRequired: normalizeExperienceRequired(detail.experience, detail.max_experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: normalizeSkills(detail.skills),
    postingDate: normalizeWhitespace(detail.job_publish_date)
      || (Number.isFinite(Number(hit?.sort?.[0])) ? new Date(Number(hit.sort[0])).toISOString() : null),
    closingDate: null,
    jobDescription: stripTags(detail.description),
    source: SOURCE,
    link: applyUrl,
    scrapedAt: now(),
  }
}

export const createNestDigitalScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: suppliedFetchText = defaultFetchText,
    fetchJson: suppliedFetchJson = defaultFetchJson,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const request = async (fetcher, url) => {
      signal?.throwIfAborted()
      const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)])
      const value = await fetcher(url, { signal: requestSignal })
      signal?.throwIfAborted()
      return value
    }
    const fetchText = url => request(suppliedFetchText, url)
    const fetchJson = url => request(suppliedFetchJson, url)
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NeST Digital careers page no longer matches the verified official public careers surface')
    }

    const configPayload = await fetchJson(CONFIG_URL)
    if (!hasZappyhireConfigSignal(configPayload)) {
      throw new Error('NeST Digital verified configuration changed materially')
    }

    const filterParamsPayload = await fetchJson(FILTER_PARAMS_URL)
    if (!hasZappyhireFilterParamsSignal(filterParamsPayload)) {
      throw new Error('NeST Digital verified filter params changed materially')
    }

    const normalizedJobs = []
    const safePageSize = normalizePageSize(pageSize)

    for (let page = 1; ; page += 1) {
      const payload = await fetchJson(buildJobsApiUrl({ page, pageSize: safePageSize }))
      const hits = extractJobHits(payload)
      const totalHits = Number(payload?.results?.total?.value ?? 0)

      if (page === 1 && totalHits > 0 && hits.length === 0) {
        throw new Error('NeST Digital verified jobs API changed materially: positive totals no longer produce first-page hits')
      }

      for (let start = 0; start < hits.length; start += 3) {
        signal?.throwIfAborted()
        const batch = await Promise.all(hits.slice(start, start + 3).map(async hit => {
          const jobId = hit?._source?.job
          if (!jobId) return null

          const detailPayload = await fetchJson(buildJobDetailUrl(jobId))
          return normalizeJob(hit, detailPayload, now)
        }))
        normalizedJobs.push(...batch.filter(Boolean))
      }

      const totalPages = Math.max(1, Math.ceil(totalHits / safePageSize))
      if (page >= totalPages || hits.length === 0) {
        break
      }
    }

    if (normalizedJobs.length === 0) {
      throw new Error('NeST Digital verified jobs API changed materially: no India jobs normalized from current search results')
    }

    signal?.throwIfAborted()
    return normalizedJobs
  },
})

export const run = async (options = {}) => createNestDigitalScraper(options).run(options)

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
