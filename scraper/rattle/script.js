import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'rattle'
export const COMPANY = 'Rattle'
export const OFFICIAL_SITE_URL = 'https://www.gorattle.com/'
export const GREENHOUSE_BOARD_URL = 'https://job-boards.greenhouse.io/rattle'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/rattle/jobs'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtml = (value) => normalizeWhitespace(value)

const hasIndiaMarker = (value) => /\bindia\b/i.test(String(value ?? ''))

const inferCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  return !firstToken || /^india$/i.test(firstToken) ? null : firstToken
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

const normalizeGreenhouseBoardUrl = (value) => {
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (!['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(hostname)) {
      return null
    }

    if (pathname !== '/rattle') {
      return null
    }

    return GREENHOUSE_BOARD_URL
  } catch {
    return null
  }
}

export const extractOfficialCareersLink = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href="([^"]+)"[^>]*>\s*Careers\s*<\/a>/gi)) {
    const normalized = normalizeGreenhouseBoardUrl(match[1])
    if (normalized) {
      return normalized
    }
  }

  return null
}

export const hasOfficialSiteSignal = (html) => {
  const page = String(html ?? '')

  return page.includes('boards.greenhouse.io/rattle')
}

export const isVerifiedMissingGreenhouseBoardPage = ({ status, url, html }) => (
  Number(status) === 404
  && normalizeGreenhouseBoardUrl(url) === GREENHOUSE_BOARD_URL
  && (
    /<title>\s*Page not found\s*<\/title>/i.test(String(html ?? ''))
    || /Page not found/i.test(normalizeWhitespace(html))
  )
)

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (hostname !== 'job-boards.greenhouse.io') return null
    if (pathname !== `/rattle/jobs/${canonicalJobId}`) return null

    return `https://job-boards.greenhouse.io/rattle/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Rattle Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs.flatMap((job) => {
    const companyName = normalizeWhitespace(job?.company_name)
    if (companyName !== COMPANY) {
      throw new Error('Rattle Greenhouse payload no longer maps to the verified company identity')
    }

    const title = normalizeWhitespace(job?.title)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
    if (!title || !sourceUrl) {
      throw new Error('Rattle Greenhouse payload no longer exposes the verified Greenhouse detail route')
    }

    const location = normalizeWhitespace(job?.location?.name)
    if (!hasIndiaMarker(location)) return []

    return [{
      title,
      company: COMPANY,
      location,
      city: inferCity(location),
      country: 'India',
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: String(job.id),
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: null,
      jobDescription: decodeHtml(job?.content),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
      closingDate: null,
      scrapedAt,
    }]
  })
}

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
    Accept: 'application/json,text/plain,*/*',
    Referer: GREENHOUSE_BOARD_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
      Accept: 'text/html,application/xhtml+xml',
      Referer: OFFICIAL_SITE_URL,
    },
    redirect: 'follow',
    signal,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isMissingGreenhouseApiError = (error) =>
  /HTTP 404\b/i.test(String(error?.message ?? error ?? ''))

export const createRattleScraper = () => ({
  async run({
    fetchJson = defaultFetchJson,
    fetchPage = defaultFetchPage,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    try {
      return extractIndiaJobsFromGreenhousePayload(
        await fetchJson(buildGreenhouseJobsApiUrl(), { signal }),
        { scrapedAt: now() },
      )
    } catch (error) {
      if (!isMissingGreenhouseApiError(error)) {
        throw error
      }

      const officialSitePage = await fetchPage(OFFICIAL_SITE_URL, { signal })
      if (Number(officialSitePage.status) !== 200 || !hasOfficialSiteSignal(officialSitePage.html)) {
        throw new Error('Rattle official site no longer matches the verified first-party careers handoff')
      }

      const greenhouseBoardPage = await fetchPage(GREENHOUSE_BOARD_URL, { signal })
      if (!isVerifiedMissingGreenhouseBoardPage(greenhouseBoardPage)) {
        throw new Error('Rattle Greenhouse board no longer matches the verified missing-board state')
      }

      return []
    }
  },
})

export const run = async (options = {}) => createRattleScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
