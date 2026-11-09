import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { provider } from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const OFFICIAL_BRAND_NAME = provider.officialBrandName
export const VERIFIED_AT = provider.verifiedOn
export const CAREERS_HOME_URL = provider.companyCareerPage
export const INDIA_LOCATION_URL = provider.indiaLocationPage
export const EXPERIENCED_WORKDAY_PAGE = provider.experiencedWorkdayPage
export const STUDENT_WORKDAY_PAGE = provider.studentWorkdayPage
export const EXPERIENCED_JOBS_API_URL = provider.experiencedJobsApiUrl
export const STUDENT_JOBS_API_URL = provider.studentJobsApiUrl
export const INDIA_COUNTRY_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const WORKDAY_MAINTENANCE_ERROR_PATTERN = /received html \(workday is currently unavailable\.\)|workday is currently unavailable/i

const GROUPED_LOCATION_PATTERN = /^\d+\s+locations?$/i
const INDIA_LOCATION_PATTERN =
  /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|gurugram|gurgaon|chennai|kolkata|new delhi|delhi|noida|manesar|remote)\b/i
const NON_INDIA_LOCATION_PATTERN =
  /\b(united states|usa|canada|singapore|germany|france|ireland|japan|china|mexico|brazil|australia|united kingdom|uk)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
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

const sameUrlIgnoringSearch = (left, right) => {
  try {
    const leftUrl = new URL(String(left ?? ''))
    const rightUrl = new URL(String(right ?? ''))
    leftUrl.search = ''
    leftUrl.hash = ''
    rightUrl.search = ''
    rightUrl.hash = ''
    return leftUrl.toString().replace(/\/$/, '') === rightUrl.toString().replace(/\/$/, '')
  } catch {
    return false
  }
}

const extractLabeledUrl = (html = '', labelPattern, baseUrl) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeWhitespace(match[2])
    if (!labelPattern.test(label)) continue

    return toAbsoluteUrl(match[1], baseUrl)
  }

  return null
}

export const extractExperiencedWorkdayUrl = (html = '', baseUrl = CAREERS_HOME_URL) =>
  extractLabeledUrl(html, /^Search Experienced Jobs$/i, baseUrl)

export const extractStudentWorkdayUrl = (html = '', baseUrl = CAREERS_HOME_URL) =>
  extractLabeledUrl(html, /^Search Grad & Student Jobs$/i, baseUrl)

export const hasOfficialCareersHomeSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Agilent Careers(?: Home)?\s*<\/title>/i.test(page)
    && normalized.includes('Careers Home')
    && (
      normalized.includes('Find the right opportunity for you at Agilent.')
      || normalized.includes('Join a truly global team')
    )
    && sameUrlIgnoringSearch(extractExperiencedWorkdayUrl(page), EXPERIENCED_WORKDAY_PAGE)
    && sameUrlIgnoringSearch(extractStudentWorkdayUrl(page), STUDENT_WORKDAY_PAGE)
}

export const hasOfficialIndiaLocationSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const lowerText = normalized.toLowerCase()
  const hasLegacyIndiaCopy = normalized.includes(
    "With over 1,500 employees spread over nine locations, Agilent India is one of Agilent's largest global centers of excellence.",
  )
  const hasCurrentIndiaCopy = lowerText.includes('with over 1,500 employees, spread across nine locations')
    && lowerText.includes('our india team supports agilent')

  return /<title>\s*Agilent Careers(?: \|)? India\s*<\/title>/i.test(page)
    && normalized.includes('India')
    && (hasLegacyIndiaCopy || hasCurrentIndiaCopy)
    && (
      normalized.includes('Our Indian business offers roles across engineering, manufacturing, software, sales, and business operations.')
      || lowerText.includes('global operations across different business areas')
    )
    && sameUrlIgnoringSearch(extractExperiencedWorkdayUrl(page, INDIA_LOCATION_URL), EXPERIENCED_WORKDAY_PAGE)
    && sameUrlIgnoringSearch(extractStudentWorkdayUrl(page, INDIA_LOCATION_URL), STUDENT_WORKDAY_PAGE)
}

export const hasWorkdayMaintenanceSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Workday is currently unavailable\.\s*<\/title>/i.test(page)
    && normalized.includes('Workday is currently unavailable.')
    && normalized.includes('Workday is performing planned maintenance')
    && normalized.includes('We apologize for the inconvenience.')
    && normalized.includes('Workday customer')
}

export const buildJobsApiUrl = (boardUrl) => {
  try {
    const url = new URL(String(boardUrl ?? ''))
    const tenant = url.hostname.split('.')[0]
    const boardName = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    if (!tenant || !boardName) return null
    return `${url.origin}/wday/cxs/${tenant}/${boardName}/jobs`
  } catch {
    return null
  }
}

export const buildJobsApiRequest = (offset = 0, limit = 20) => ({
  appliedFacets: {
    locationCountry: [INDIA_COUNTRY_FACET_ID],
  },
  limit,
  offset,
  searchText: '',
})

const buildJobUrl = (boardUrl, externalPath) => {
  const normalizedPath = String(externalPath ?? '').trim()
  if (!normalizedPath) return null
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath

  const base = String(boardUrl ?? '').replace(/\/$/, '')
  const pathValue = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return `${base}${pathValue}`
}

const extractJobId = (job = {}) => {
  const requisitionId = Array.isArray(job?.bulletFields)
    ? job.bulletFields.map((value) => normalizeWhitespace(value)).find(Boolean)
    : null

  if (requisitionId) return requisitionId

  const match = String(job?.externalPath ?? '').match(/_([A-Za-z0-9-]+)(?:\/)?$/)
  return match?.[1] ?? null
}

const normalizeEmploymentType = (value) =>
  normalizeWhitespace(typeof value === 'object' ? value?.descriptor : value) || null

const isIndiaJobPosting = (job = {}) => {
  const location = normalizeWhitespace(job?.locationsText)

  if (!location) return true
  if (INDIA_LOCATION_PATTERN.test(location)) return true
  if (GROUPED_LOCATION_PATTERN.test(location)) return true
  if (NON_INDIA_LOCATION_PATTERN.test(location)) return false
  return true
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || GROUPED_LOCATION_PATTERN.test(normalized)) return null
  if (/^(virtual office|remote)\b/i.test(normalized) || /\bremote\b/i.test(normalized)) {
    return 'Remote'
  }

  return normalizeWhitespace(
    normalized
      .replace(/\s*\(Flexible\)\s*$/i, '')
      .replace(/\s*,\s*India\s*$/i, '')
      .split(',')[0],
  )
}

const mapJobPosting = (job, boardUrl) => {
  if (!isIndiaJobPosting(job)) return null

  const title = normalizeWhitespace(job?.title)
  const location = normalizeWhitespace(job?.locationsText)
  const jobId = extractJobId(job)
  const sourceUrl = buildJobUrl(boardUrl, job?.externalPath)

  if (!title || !jobId || !sourceUrl) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location: location || 'India',
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: `${sourceUrl}/apply`,
    employmentType: normalizeEmploymentType(job?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const WORKDAY_BOARDS = [
  {
    boardUrl: EXPERIENCED_WORKDAY_PAGE,
    apiUrl: EXPERIENCED_JOBS_API_URL,
  },
  {
    boardUrl: STUDENT_WORKDAY_PAGE,
    apiUrl: STUDENT_JOBS_API_URL,
  },
]

const isWorkdayMaintenanceError = (error) =>
  WORKDAY_MAINTENANCE_ERROR_PATTERN.test(String(error?.message ?? error ?? ''))

export const isVerifiedUnavailableFirstPartySurface = (error) =>
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const isVerifiedMaintenancePage = (page = {}) =>
  Number(page?.status) === 200
  && /maintenance-page/i.test(String(page?.url ?? ''))
  && hasWorkdayMaintenanceSignal(page?.html)

const isVerifiedMaintenanceOrUnavailablePage = (page = {}) =>
  page?.errorKind === 'timeout' || isVerifiedMaintenancePage(page)

export const createAgilentIndiaScraper = ({
  now = () => new Date().toISOString(),
  pageSize = 20,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    let careersHome = null

    try {
      careersHome = await fetchPage(CAREERS_HOME_URL)
    } catch (error) {
      if (!isVerifiedUnavailableFirstPartySurface(error)) {
        throw error
      }
    }

    if (careersHome && (careersHome.status !== 200 || !hasOfficialCareersHomeSignal(careersHome.html))) {
      throw new Error('Agilent India verified careers home no longer matches the trusted first-party surface')
    }

    let indiaLocationPage = null

    try {
      indiaLocationPage = await fetchPage(INDIA_LOCATION_URL)
    } catch (error) {
      if (!isVerifiedUnavailableFirstPartySurface(error)) {
        throw error
      }
    }

    if (
      indiaLocationPage
      && (indiaLocationPage.status !== 200 || !hasOfficialIndiaLocationSignal(indiaLocationPage.html))
    ) {
      throw new Error('Agilent India verified India location page no longer matches the trusted first-party surface')
    }

    const jobs = []
    const seenLinks = new Set()

    for (const board of WORKDAY_BOARDS) {
      let offset = 0
      let total = Number.POSITIVE_INFINITY

      while (offset < total) {
        let payload
        try {
          payload = await fetchJson(board.apiUrl, {
            method: 'POST',
            body: JSON.stringify(buildJobsApiRequest(offset, pageSize)),
          })
        } catch (error) {
          if (isWorkdayMaintenanceError(error) || isVerifiedUnavailableFirstPartySurface(error)) {
            const fetchBoardPage = async (url) => {
              try {
                return await fetchPage(url)
              } catch (boardError) {
                if (isVerifiedUnavailableFirstPartySurface(boardError)) {
                  return { status: null, url, html: null, errorKind: 'timeout' }
                }

                throw boardError
              }
            }

            const experiencedBoardPage = await fetchBoardPage(EXPERIENCED_WORKDAY_PAGE)
            const studentBoardPage = await fetchBoardPage(STUDENT_WORKDAY_PAGE)

            if (
              isVerifiedMaintenanceOrUnavailablePage(experiencedBoardPage)
              && isVerifiedMaintenanceOrUnavailablePage(studentBoardPage)
            ) {
              return []
            }
          }

          throw error
        }
        const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

        total = Number.isFinite(payload?.total) ? payload.total : offset + postings.length

        for (const posting of postings) {
          const mappedJob = mapJobPosting(posting, board.boardUrl)
          if (!mappedJob || seenLinks.has(mappedJob.sourceUrl)) continue

          seenLinks.add(mappedJob.sourceUrl)
          jobs.push({
            ...mappedJob,
            source: SOURCE,
            link: mappedJob.applyUrl || mappedJob.sourceUrl,
            scrapedAt: now(),
          })
        }

        offset += postings.length
        if (postings.length < pageSize) break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createAgilentIndiaScraper(options).run()

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
