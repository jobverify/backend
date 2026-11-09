import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

import { JADE_GLOBAL_CATALOG } from './catalog.js'
import { createJadeJsonAvailabilityReader } from './nativeJsonAvailability.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = JADE_GLOBAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.workdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_PUBLIC_JOB_COUNT = PROVIDER_METADATA.verifiedPublicJobCount
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DETAIL_FETCH_CONCURRENCY = 4

const GROUPED_LOCATION_PATTERN = /^\d+\s+locations?$/i
const INDIA_PATTERN =
  /\b(india|pune|hyderabad|bangalore|bengaluru|kolkata|gurgaon|gurugram|mumbai|chennai|noida|delhi|maharashtra|telangana|karnataka|west bengal)\b/i
const UNITED_STATES_PATTERN =
  /\b(united states|usa|san jose|chicago|irving|north wales|troy|ca|tx|pa|il|new jersey|new york)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
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

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const extractWorkdayBoardUrl = (html = '', baseUrl = CAREERS_URL) => {
  let document
  try { document = readVisibleNativeDocument(String(html ?? ''), { strict: true }) } catch { return null }
  const enabled = node => !node.inert && !Object.hasOwn(node.attrs, 'disabled')
    && node.attrs['aria-disabled']?.toLowerCase() !== 'true'
  for (const anchor of document.nodes(node => node.tag === 'a' && enabled(node))) {
    const href = toAbsoluteUrl(anchor.attrs.href, baseUrl)
    if (href?.replace(/\/+$/, '') === WORKDAY_BOARD_URL
      && /^Explore Open Positions$/i.test(normalizeWhitespace(document.text(anchor)) || '')) return WORKDAY_BOARD_URL
  }
  // The current corporate page submits an enabled GET search form directly
  // to the same native board, rather than an "Explore Open Positions" link.
  const descendants = node => !enabled(node) ? [] : [node,
    ...node.children.filter(child => typeof child !== 'string').flatMap(descendants)]
  for (const form of document.nodes(node => node.tag === 'form' && enabled(node))) {
    if (toAbsoluteUrl(form.attrs.action, baseUrl) !== WORKDAY_BOARD_URL
      || (form.attrs.method || 'get').toLowerCase() !== 'get') continue
    const controls = descendants(form)
    if (controls.some(node => node.tag === 'input' && node.attrs.name === 'q' && node.attrs.type === 'search')
      && controls.some(node => node.tag === 'button' && (node.attrs.type || 'submit') === 'submit'
        && /^Search$/i.test(normalizeWhitespace(document.text(node)) || ''))) return WORKDAY_BOARD_URL
  }

  return null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Jade Global Careers\s*\|\s*[^<]+<\/title>/i.test(page)
    && normalized.includes('Careers')
    && normalized.includes('Reboot Your Career')
    && normalized.includes('Life at Jade')
    && extractWorkdayBoardUrl(page) === WORKDAY_BOARD_URL
  }

export const buildJobsApiUrl = (boardUrl) => {
  try {
    const url = new URL(String(boardUrl ?? ''))
    const tenant = url.hostname.split('.')[0]
    const segments = url.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
    const boardName = segments.at(-1)

    if (!tenant || !boardName) return null
    return `${url.origin}/wday/cxs/${tenant}/${boardName}/jobs`
  } catch {
    return null
  }
}

export const buildJobsApiRequest = (offset = 0, limit = 20) => ({
  appliedFacets: {},
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

const extractLocationFromExternalPath = (externalPath = '') => {
  const match = String(externalPath ?? '').match(/\/job\/([^/]+)\//i)
  const slug = match?.[1]
  if (!slug) return null

  const parts = slug.split('-').filter(Boolean)
  if (parts.length < 2) {
    return normalizeWhitespace(slug.replace(/-/g, ' '))
  }

  const region = parts.pop()
  const city = parts.join(' ')
  return normalizeWhitespace(`${city}, ${region}`)
}

const resolveJobLocation = (job = {}) => {
  const location = normalizeWhitespace(job?.locationsText)
  if (!location || GROUPED_LOCATION_PATTERN.test(location)) {
    return extractLocationFromExternalPath(job?.externalPath) || location || null
  }

  return location
}

const deriveCountry = (location) => {
  const normalized = normalizeWhitespace(location) || ''
  if (!normalized) return null
  if (INDIA_PATTERN.test(normalized)) return 'India'
  if (UNITED_STATES_PATTERN.test(normalized)) return 'United States'

  const tokens = normalized.split(',').map((value) => value.trim()).filter(Boolean)
  return tokens.length > 1 ? tokens.at(-1) : null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || GROUPED_LOCATION_PATTERN.test(normalized)) return null

  const firstToken = normalized.split(',')[0]?.trim()
  if (!firstToken) return null
  return normalizeCity(firstToken)
}

const mapWorkdayJobPosting = (job, boardUrl, scrapedAt) => {
  const title = normalizeWhitespace(job?.title)
  const location = resolveJobLocation(job)
  const jobId = extractJobId(job)
  const sourceUrl = buildJobUrl(boardUrl, job?.externalPath)

  if (!title || !location || !jobId || !sourceUrl) return null

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location,
    city: deriveCity(location),
    country: deriveCountry(location),
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: `${sourceUrl}/apply`,
    employmentType: normalizeEmploymentType(job?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job?.postedOn),
    closingDate: null,
    jobDescription: null,
    source: SOURCE,
    link: `${sourceUrl}/apply`,
    scrapedAt,
  }
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  signal: options.signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const readJadeJson = createJadeJsonAvailabilityReader({ fetchJsonWithRetry })

const defaultFetchJson = (url, options = {}) => readJadeJson(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    Referer: WORKDAY_BOARD_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJadeGlobalScraper = ({
  now = () => new Date().toISOString(),
  pageSize = 20,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    signal,
  } = {}) {
    const checkCaller = () => { if (signal?.aborted) throw signal.reason }
    try {
    checkCaller()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    checkCaller()
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Jade Global verified first-party careers page no longer matches the trusted public surface')
    }

    const workdayBoardUrl = extractWorkdayBoardUrl(careersHtml)
    const jobsApiUrl = buildJobsApiUrl(workdayBoardUrl)
    if (jobsApiUrl !== JOBS_API_URL) {
      throw new Error('Jade Global derived Workday jobs API no longer matches the verified public surface')
    }

    const jobs = []
    const seenLinks = new Set()
    let offset = 0
    let total = Number.POSITIVE_INFINITY

    while (offset < total) {
      checkCaller()
      const payload = await fetchJson(jobsApiUrl, {
        method: 'POST',
        body: JSON.stringify(buildJobsApiRequest(offset, pageSize)),
        signal,
      })
      checkCaller()
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : null
      if (!postings) {
        throw new Error('Jade Global jobs API response no longer matches the expected Workday payload')
      }

      total = Number.isFinite(payload?.total) ? payload.total : offset + postings.length

      for (const posting of postings) {
        const mappedJob = mapWorkdayJobPosting(posting, workdayBoardUrl, now())
        if (!mappedJob || seenLinks.has(mappedJob.sourceUrl)) continue

        seenLinks.add(mappedJob.sourceUrl)
        jobs.push(mappedJob)
      }

      if (postings.length === 0) break
      offset += postings.length
      if (postings.length < pageSize) break
    }

    return await mapWithConcurrency(
      jobs,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          checkCaller()
          const detailHtml = await fetchText(job.sourceUrl, { signal })
          checkCaller()
          if (!detailHtml) {
            return job
          }

          const detail = await extractJobDetail({
            provider: 'workday',
            html: detailHtml,
          })
          checkCaller()

          return {
            ...job,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
            publicExperienceChecked: detail.publicExperienceChecked === true || job.publicExperienceChecked === true,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            requiredSkills: Array.isArray(detail.requiredSkills) && detail.requiredSkills.length > 0
              ? detail.requiredSkills
              : job.requiredSkills,
            jobDescription: detail.jobDescription || job.jobDescription,
            postingDate: detail.postingDate || job.postingDate,
            requisitionId: detail.requisitionId || job.requisitionId,
            department: detail.department || job.department,
          }
        } catch {
          checkCaller()
          return job
        }
      },
    )
    } catch (error) {
      checkCaller()
      throw error
    }
  },
})

export const run = async (options = {}) => createJadeGlobalScraper(options).run(options)

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
