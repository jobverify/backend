import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'brightmoney'
export const COMPANY = 'Bright Money'
export const OFFICIAL_CAREERS_URL = 'https://www.brightmoney.co/openings'
export const KULA_API_URL = 'https://api.kula.ai/v1/job-boards/job-posts'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const isIndiaOffice = (office) => {
  const country = normalizeWhitespace(office?.country)
  if (country && /^india$/i.test(country)) return true

  const location = normalizeWhitespace(office?.location || office?.name)
  return Boolean(location && /(?:^|,\s*)india$/i.test(location))
}

const selectIndiaOffice = (offices = []) => offices.find(isIndiaOffice) || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time') return 'Full-time'
  if (normalized === 'part_time') return 'Part-time'
  if (normalized === 'internship') return 'Internship'
  if (normalized === 'consultant') return 'Consultant'
  return normalizeWhitespace(value)
}

const normalizeRemoteStatus = (workplace, location) => {
  const normalizedWorkplace = normalizeWhitespace(workplace)?.toLowerCase()
  if (normalizedWorkplace === 'remote') return 'Remote'
  if (normalizedWorkplace === 'hybrid') return 'Hybrid'
  if (/remote/i.test(location || '')) return 'Remote'
  return 'On-site'
}

const normalizeLocation = (office = {}) =>
  normalizeWhitespace(office.location || office.name || office.city) || null

const extractCity = (office = {}) =>
  normalizeCity(
    normalizeWhitespace(office.city)
    || normalizeWhitespace(office.location)?.split(',')[0]
    || null,
  )

export const extractKulaPublicToken = (html = '') => {
  const match = String(html ?? '').match(/const KULA_PUBLIC_TOKEN = "([^"]+)"/)
  return normalizeWhitespace(match?.[1])
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*(?:Bright Money\s*\|\s*)?Openings\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && page.includes('openingsGrid')
    && page.includes('openingsPagination')
    && page.includes(KULA_API_URL)
}

export const buildApiUrl = ({ page = 1, limit = 100 } = {}) => {
  const url = new URL(KULA_API_URL)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

export const extractIndiaJobsFromKulaPayload = (payload, { scrapedAt } = {}) => {
  const jobs = Array.isArray(payload?.data) ? payload.data : []

  return jobs
    .map((row) => {
      const indiaOffice = selectIndiaOffice(Array.isArray(row?.offices) ? row.offices : [])
      if (!indiaOffice) return null

      const title = normalizeWhitespace(row?.title || row?.name)
      const location = normalizeLocation(indiaOffice)
      const sourceUrl = normalizeWhitespace(row?.job_board_url)
      const jobId = normalizeWhitespace(row?.id)

      if (!title || !location || !sourceUrl || !jobId) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(row?.department?.name),
        location,
        city: extractCity(indiaOffice),
        country: normalizeWhitespace(indiaOffice.country) || 'India',
        jobId,
        requisitionId: normalizeWhitespace(row?.job_id),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(row?.employment_type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: normalizeRemoteStatus(row?.workplace, location),
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'bright-money-official',
  timeoutMs: 15000,
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

export const createBrightMoneyScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Expected verified official Bright Money openings surface with the public Kula API contract')
    }

    const publicToken = extractKulaPublicToken(careersHtml)
    if (!publicToken) {
      throw new Error('Expected verified inline Kula public token on the Bright Money openings page')
    }

    const collected = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const payload = await fetchJson(buildApiUrl({ page, limit: 100 }), {
        headers: {
          Authorization: `Bearer ${publicToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!Array.isArray(payload?.data)) {
        throw new Error('Expected Bright Money public Kula jobs API to return an array payload')
      }

      collected.push(...payload.data)
      totalPages = Number.isInteger(payload?.meta?.total_pages) ? payload.meta.total_pages : 1
      page += 1
    }

    const jobs = extractIndiaJobsFromKulaPayload(
      { data: collected },
      { scrapedAt: (overrideNow || now)() },
    )

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createBrightMoneyScraper().run(options)

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
