import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sayonetechnologies'
export const COMPANY = 'SayOne Technologies'
export const CAREERS_PAGE_URL = 'https://www.sayonetech.com/career/'
export const DEFAULT_APPLY_URL = 'mailto:careers@sayonetech.com'
export const STRAPI_API_BASE_URL = 'https://strapi.sayonetech.com/api'
export const STRAPI_JOB_POSTINGS_COLLECTION = 'job-postings'
export const STRAPI_API_AUTH_TOKEN = null

const DEFAULT_FETCH_TIMEOUT_MS = 30000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const uniqueBy = (items, getKey) => {
  const seen = new Set()
  const results = []

  for (const item of items) {
    const key = getKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    results.push(item)
  }

  return results
}

export const normalizeTextBlock = (value) => String(value ?? '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .trim()

const parseTextBlockLines = (value) => normalizeTextBlock(value)
  .split('\n')
  .map((rawLine) => {
    const isMarkdownHeading = /^\s*\*\*.+\*\*\s*$/.test(rawLine)
    const cleaned = normalizeWhitespace(
      rawLine
        .replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, '')
        .replace(/\*\*/g, ''),
    )

    if (!cleaned) return null
    return {
      cleaned,
      isMarkdownHeading,
    }
  })
  .filter(Boolean)

export const splitTextBlockLines = (value, { includeMarkdownHeadings = true } = {}) => parseTextBlockLines(value)
  .filter((line) => includeMarkdownHeadings || !line.isMarkdownHeading)
  .map((line) => line.cleaned)

export const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

export const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalizeCity(normalized.split(',').pop()?.trim() || normalized)
}

const deriveRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const extractTitle = (html = '') => normalizeWhitespace(
  decodeHtmlEntities(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
)

const extractTextFromHtml = (html = '') => decodeHtmlEntities(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ').trim()

export const hasOfficialCareersSignal = (pageData) => {
  const title = normalizeWhitespace(
    typeof pageData === 'string' ? extractTitle(pageData) : pageData?.title,
  )
  const text = String(
    typeof pageData === 'string' ? extractTextFromHtml(pageData) : pageData?.text ?? '',
  )

  return /SayOne/i.test(title || '')
    && /Careers|Jobs/i.test(title || '')
    && /Find the Right Place/i.test(text)
    && /Are You Ready to be an Integral Part of SayOne\?/i.test(text)
    && /careers@sayonetech\.com/i.test(text)
}

export const hasExplicitNoVacanciesSignal = (text) => (
  /No vacancies available/i.test(String(text ?? ''))
  && /check back later/i.test(String(text ?? ''))
)

export const extractPublicChunkUrls = (html, baseUrl = CAREERS_PAGE_URL) => uniqueBy(
  [...String(html ?? '').matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi)]
    .map(([, src]) => {
      try {
        return new URL(src, baseUrl).toString()
      } catch {
        return null
      }
    })
    .filter((src) => /\/_next\/static\/chunks\/.+\.js$/i.test(src || '')),
  (src) => src,
)

export const extractStrapiConfig = (chunkJs) => {
  const source = String(chunkJs ?? '')
  const baseUrl = normalizeWhitespace(source.match(/baseURL\s*:\s*"([^"]+)"/i)?.[1])
  const authToken = normalizeWhitespace(source.match(/auth\s*:\s*"([^"]+)"/i)?.[1])

  if (!baseUrl || !authToken) return null

  return {
    baseUrl,
    authToken,
  }
}

export const buildJobPostingsApiUrl = (baseUrl = STRAPI_API_BASE_URL) => {
  const url = new URL(`${String(baseUrl).replace(/\/+$/u, '')}/${STRAPI_JOB_POSTINGS_COLLECTION}`)
  url.searchParams.set('filters[job_status][$eq]', 'Open')
  url.searchParams.set('pagination[pageSize]', '1000')
  url.searchParams.append('sort[0]', 'createdAt:desc')
  return url.toString()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
})

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const collectPageData = async (url, { fetchText = defaultFetchText } = {}) => {
  const html = await fetchText(url)

  return {
    url,
    html,
    title: extractTitle(html),
    text: extractTextFromHtml(html),
  }
}

const resolveStrapiConfig = async (pageHtml, { fetchText = defaultFetchText } = {}) => {
  for (const chunkUrl of extractPublicChunkUrls(pageHtml, CAREERS_PAGE_URL)) {
    try {
      const config = extractStrapiConfig(await fetchText(chunkUrl))
      if (config) return config
    } catch {
      continue
    }
  }

  if (STRAPI_API_AUTH_TOKEN) {
    return {
      baseUrl: STRAPI_API_BASE_URL,
      authToken: STRAPI_API_AUTH_TOKEN,
    }
  }

  throw new Error(
    'SayOne Technologies public Strapi configuration could not be resolved from the verified careers page contract',
  )
}

export const extractOpenJobPostings = (payload) => (
  Array.isArray(payload?.data) ? payload.data : []
)

export const fetchOpenJobPostings = async ({
  pageData,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
} = {}) => {
  const config = await resolveStrapiConfig(pageData?.html, { fetchText })
  const authToken = config?.authToken || STRAPI_API_AUTH_TOKEN

  if (!authToken) {
    throw new Error('SayOne Technologies public jobs API auth token is unavailable')
  }

  const payload = await fetchJson(buildJobPostingsApiUrl(config?.baseUrl || STRAPI_API_BASE_URL), {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  return extractOpenJobPostings(payload)
}

const buildListBlock = (heading, value) => {
  const lines = splitTextBlockLines(value)
  if (lines.length === 0) return null
  return `${heading}:\n${lines.map((line) => `- ${line}`).join('\n')}`
}

const buildDescriptionBlock = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized ? `Description: ${normalized}` : null
}

export const buildJobFromPosting = (posting = {}) => {
  const location = normalizeWhitespace(posting.location)
  const requirements = splitTextBlockLines(posting.requirements, {
    includeMarkdownHeadings: false,
  })
  const jobId = normalizeWhitespace(posting.slug)
    || normalizeWhitespace(posting.documentId)
    || normalizeWhitespace(posting.id)
    || slugify(posting.title)

  if (!normalizeWhitespace(posting.title) || !jobId) {
    throw new Error('SayOne Technologies public job posting is missing required identity fields')
  }

  return {
    title: normalizeWhitespace(posting.title),
    company: COMPANY,
    department: null,
    location,
    city: deriveCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_PAGE_URL,
    applyUrl: DEFAULT_APPLY_URL,
    employmentType: normalizeWhitespace(posting.job_type),
    experienceRequired: normalizeWhitespace(posting.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: requirements,
    postingDate: normalizeWhitespace(posting.publishedAt)
      || normalizeWhitespace(posting.createdAt),
    closingDate: null,
    jobDescription: [
      buildDescriptionBlock(posting.description),
      buildListBlock('Responsibilities', posting.responsibilities),
      buildListBlock('Requirements', posting.requirements),
    ].filter(Boolean).join('\n\n') || null,
    remoteStatus: deriveRemoteStatus(location),
  }
}

const finalizeJobs = (jobs, now = () => new Date().toISOString()) => jobs.map((job) => ({
  ...job,
  source: SOURCE,
  link: job.applyUrl || job.sourceUrl,
  scrapedAt: now(),
}))

export const createSayonetechnologiesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    collectPageDataImpl = collectPageData,
    fetchOpenJobPostingsImpl = fetchOpenJobPostings,
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const pageData = await collectPageDataImpl(CAREERS_PAGE_URL, { fetchText })

    if (!hasOfficialCareersSignal(pageData)) {
      throw new Error(
        'SayOne Technologies careers page no longer matches the verified official public surface',
      )
    }

    if (hasExplicitNoVacanciesSignal(pageData.text)) {
      return []
    }

    const postings = await fetchOpenJobPostingsImpl({
      pageData,
      fetchText,
      fetchJson,
    })

    if (postings.length === 0) {
      return []
    }

    const jobs = filterIndiaJobs(postings.map((posting) => buildJobFromPosting(posting)))
    const selectedJobs = Number.isInteger(maxJobs) && maxJobs > 0
      ? jobs.slice(0, maxJobs)
      : jobs

    return finalizeJobs(selectedJobs, now)
  },
})

export const run = async (options = {}) => createSayonetechnologiesScraper().run(options)

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
