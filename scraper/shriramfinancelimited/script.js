import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COMPANY = 'SHRIRAM FINANCE LIMITED'
export const SOURCE = 'shriramfinancelimited'
export const CAREERS_ORIGIN = 'https://www.shriramfinance.in'
export const CAREERS_URL = `${CAREERS_ORIGIN}/careers`
export const PAGE_SIZE = 6

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const MAX_PAGES = 20
const SERVER_STATE_PATTERN = /<script id="serverApp-state" type="application\/json">([\s\S]*?)<\/script>/i
const VERIFIED_TITLE_PATTERN =
  /<title>\s*Careers - Join us and future forward your career today with Shriram Finance\s*<\/title>/i
const VERIFIED_DESCRIPTION_PATTERN =
  /Find Shriram Finance Limited job opportunities and apply online\./i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => {
  if (value == null) return ''

  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
}

const htmlToText = (value) => {
  const decoded = decodeHtmlEntities(value)
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<\/(?:li|p|div|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const lines = decoded
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : null
}

const splitLines = (value) => {
  const text = htmlToText(value)
  return text ? text.split('\n').map((line) => normalizeWhitespace(line)).filter(Boolean) : []
}

const parseEmbeddedJson = (value) => {
  if (value == null) return null
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

const extractServerAppState = (html) => {
  const match = String(html ?? '').match(SERVER_STATE_PATTERN)
  if (!match) return null

  return JSON.parse(match[1])
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const state = extractServerAppState(page)

  return Boolean(
    state
      && VERIFIED_TITLE_PATTERN.test(page)
      && VERIFIED_DESCRIPTION_PATTERN.test(page)
      && /Current Openings/i.test(page)
      && state['/api/v1/careers'],
  )
}

export const extractExpectedOpeningCount = (html) => {
  const state = extractServerAppState(html)
  const careersPayload = parseEmbeddedJson(state?.['/api/v1/careers'])
  const countValue = careersPayload?.[0]?.current_openings_group?.[0]?.total_count?.[0]?.count
  const parsed = Number.parseInt(String(countValue ?? ''), 10)

  return Number.isFinite(parsed) ? parsed : null
}

const formatSection = (label, value) => {
  const body = htmlToText(value)
  if (!body) return null

  const normalizedLabel = normalizeWhitespace(String(label ?? '').replace(/:+$/, ''))
  return normalizedLabel ? `${normalizedLabel}: ${body}` : body
}

const buildCookieHeader = (response) => {
  const setCookieValues = typeof response?.headers?.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : String(response?.headers?.get?.('set-cookie') ?? '')
      .split(/,\s*(?=[A-Za-z0-9_-]+=)/)
      .filter(Boolean)

  const cookies = setCookieValues
    .map((item) => normalizeWhitespace(item?.split(';', 1)?.[0]))
    .filter(Boolean)

  return cookies.length > 0 ? cookies.join('; ') : null
}

const extractLocation = (item) => {
  const lines = splitLines(item?.eligibility_description)
  const rawLocation = lines
    .map((line) => line.match(/^(?:job\s+location|location):\s*(.+)$/i)?.[1] ?? null)
    .find(Boolean)

  const normalizedLocation = normalizeWhitespace(rawLocation)
  if (!normalizedLocation || /^(?:pan|across)\s+india$/i.test(normalizedLocation)) {
    return {
      location: 'India',
      city: null,
      state: null,
    }
  }

  const city = normalizeWhitespace(normalizedLocation.split(',')[0])
  return {
    location: `${normalizedLocation}, India`,
    city,
    state: null,
  }
}

const extractExperienceRequired = (item) => {
  const lines = splitLines(item?.eligibility_description)
  const explicitExperience = lines
    .map((line) => line.match(/^Experience:\s*(.+)$/i)?.[1] ?? null)
    .find(Boolean)

  if (explicitExperience) return normalizeWhitespace(explicitExperience)

  return lines.find((line) => /\b\d+\+?\s*years?\b/i.test(line)) ?? null
}

const extractRequiredSkills = (item) => {
  if (!/skill/i.test(String(item?.selection_procedure_title ?? ''))) return []
  return splitLines(item?.selection_procedure_desc)
}

const normalizeJobId = (value, title) => {
  const normalizedValue = normalizeWhitespace(value)
  if (normalizedValue) return normalizedValue

  return normalizeWhitespace(title)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    ?? null
}

const normalizeCurrentOpening = (item) => {
  const title = normalizeWhitespace(item?.title)
  const jobId = normalizeJobId(item?.careers_job_id, title)
  if (!title || !jobId) return null

  const location = extractLocation(item)

  return {
    title,
    company: COMPANY,
    department: null,
    location: location.location,
    city: location.city,
    state: location.state,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: extractExperienceRequired(item),
    minimumQualification: htmlToText(item?.qualification_desc),
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(item),
    postingDate: null,
    closingDate: null,
    jobDescription: [
      formatSection(item?.eligibility_title || 'Details', item?.eligibility_description),
      formatSection(item?.qualification_title || 'Qualification', item?.qualification_desc),
      formatSection(
        item?.selection_procedure_title || 'Selection Procedure',
        item?.selection_procedure_desc,
      ),
      formatSection(item?.job_title || 'Job description', item?.job_description),
    ]
      .filter(Boolean)
      .join('\n'),
    remoteStatus: null,
  }
}

export const buildCurrentOpeningsApiUrl = (page = 0) =>
  `${CAREERS_ORIGIN}/api/v1/current-opening?page=${page}&items_per_page=${PAGE_SIZE}`

const buildCurrentOpeningsStateKey = (page = 0) =>
  `/api/v1/current-opening?page=${page}&items_per_page=${PAGE_SIZE}`

const extractEmbeddedCurrentOpeningsPage = (html, page = 0) => {
  const state = extractServerAppState(html)
  const payload = parseEmbeddedJson(state?.[buildCurrentOpeningsStateKey(page)])
  if (payload == null) return null

  if (!Array.isArray(payload)) {
    throw new Error('SHRIRAM FINANCE LIMITED embedded current-opening state no longer returns an array')
  }

  return payload
}

const defaultFetchImpl = (url, options = {}) => fetch(url, options)

const fetchCurrentOpeningsPage = async ({ fetchImpl, page, cookieHeader }) => {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    'api-referrer': '/careers',
    Referer: CAREERS_URL,
    Origin: CAREERS_ORIGIN,
    'X-Requested-With': 'XMLHttpRequest',
  }

  if (cookieHeader) {
    headers.Cookie = cookieHeader
  }

  const response = await fetchImpl(buildCurrentOpeningsApiUrl(page), {
    headers,
  })

  if (!response?.ok) {
    throw new Error(`HTTP ${response?.status ?? 'unknown'} for ${buildCurrentOpeningsApiUrl(page)}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('SHRIRAM FINANCE LIMITED current-opening API no longer returns an array')
  }

  return payload
}

const isPublicCurrentOpeningsEdgeRejection = (error) =>
  /HTTP 400 for https:\/\/www\.shriramfinance\.in\/api\/v1\/current-opening\?/i.test(
    String(error?.message ?? ''),
  )

export const createShriramFinanceLimitedScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchImpl = defaultFetchImpl } = {}) {
    const careersResponse = await fetchImpl(CAREERS_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!careersResponse?.ok) {
      throw new Error(`HTTP ${careersResponse?.status ?? 'unknown'} for ${CAREERS_URL}`)
    }

    const careersHtml = await careersResponse.text()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SHRIRAM FINANCE LIMITED verified official public jobs surface changed materially')
    }

    const expectedOpeningCount = extractExpectedOpeningCount(careersHtml)
    const cookieHeader = buildCookieHeader(careersResponse)

    const jobs = []
    const seenJobIds = new Set()
    const addRecords = (records) => {
      for (const record of records) {
        const job = normalizeCurrentOpening(record)
        if (!job || seenJobIds.has(job.jobId)) continue

        seenJobIds.add(job.jobId)
        jobs.push(job)
      }
    }

    const embeddedFirstPage = extractEmbeddedCurrentOpeningsPage(careersHtml, 0)
    if (embeddedFirstPage) {
      addRecords(embeddedFirstPage)
    }

    let paginationStoppedAtPublicEdge = false
    const firstApiPage = embeddedFirstPage ? 1 : 0
    const shouldFetchAdditionalPages =
      !embeddedFirstPage
        || (embeddedFirstPage.length >= PAGE_SIZE
          && (expectedOpeningCount == null || jobs.length < expectedOpeningCount))

    for (let page = firstApiPage; shouldFetchAdditionalPages && page < MAX_PAGES; page += 1) {
      let records
      try {
        records = await fetchCurrentOpeningsPage({ fetchImpl, page, cookieHeader })
      } catch (error) {
        if (embeddedFirstPage && jobs.length > 0 && isPublicCurrentOpeningsEdgeRejection(error)) {
          paginationStoppedAtPublicEdge = true
          break
        }

        throw error
      }

      if (records.length === 0) break

      addRecords(records)

      if (expectedOpeningCount != null && jobs.length >= expectedOpeningCount) break
      if (records.length < PAGE_SIZE) break
    }

    if (
      expectedOpeningCount != null
        && jobs.length !== expectedOpeningCount
        && !paginationStoppedAtPublicEdge
    ) {
      throw new Error(
        `SHRIRAM FINANCE LIMITED expected ${expectedOpeningCount} openings but captured ${jobs.length}`,
      )
    }

    return jobs.map((job) => ({
      ...job,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'shriramfinance.in',
      atsPlatform: 'official-company-careers',
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createShriramFinanceLimitedScraper(options).run(options)

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
