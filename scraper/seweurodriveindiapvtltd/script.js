import path from 'path'
import { fileURLToPath } from 'url'

import { extractTextFromPdfBuffer } from '../../scraper-support/shared/pdfText.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://www.seweurodriveindia.com/career/your_career/your_career.html'
export const SOURCE = 'seweurodriveindiapvtltd'

const COMPANY = 'SEW-Eurodrive India Pvt Ltd'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const DEFAULT_DETAIL_FETCH_CONCURRENCY = 4
const PDF_CONTENT_TYPE_PATTERN = /application\/pdf/i
const EXPERIENCE_SECTION_END_PATTERN = /\b(?:education|qualifications?|responsibilities?|skills?|job objective|reporting to|place of work|behavioral|behavioural|languages?|key interfaces?|compensation|role purpose|purpose|knowledge|competenc(?:y|ies))\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/thead|\/tbody|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol|table|thead|tbody|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractHref = (html) => String(html ?? '').match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || null

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /[/,]/.test(normalized) || /\bindia\b/i.test(normalized)) {
    return null
  }

  return normalized
}

const buildJobDescription = ({ title, department, location }) => normalizeWhitespace(
  `Official ${COMPANY} opening for ${title} in ${department} at ${location}. Refer to the first-party job description PDF for role details and apply through the official SEW-EURODRIVE India application form.`,
)

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatExperienceYears = (value) => {
  const parsed = Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(parsed)) return null
  return Number.isInteger(parsed) ? String(parsed) : String(parsed)
}

const extractExperienceSection = (detailText) => {
  const normalized = normalizeWhitespace(detailText)
  if (!normalized) return null

  const match = normalized.match(
    new RegExp(`\\bexperience\\b\\s*[:\\-]?\\s*(.*?)(?=${EXPERIENCE_SECTION_END_PATTERN.source}|$)`, 'i'),
  )

  return normalizeWhitespace(match?.[1] || null)
}

const extractSeweurodriveExperienceRequired = (detailText) => {
  const normalized = normalizeWhitespace(detailText)
  if (!normalized) return null

  const candidate = extractExperienceSection(normalized) || normalized
  if (/\b(?:no experience|required experience not required|freshers?)\b/i.test(candidate)) {
    return 'No experience required'
  }

  const rangeMatch = candidate.match(
    /\b(?:minimum|min\.?)?\s*(\d+(?:\.\d+)?)\s*(?:-|to|–|—)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i,
  )
  if (rangeMatch) {
    const minimumYears = formatExperienceYears(rangeMatch[1])
    const maximumYears = formatExperienceYears(rangeMatch[2])
    if (minimumYears && maximumYears) {
      return `${minimumYears}-${maximumYears} years`
    }
  }

  const plusMatch = candidate.match(
    /\b(?:minimum|min\.?)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i,
  ) || candidate.match(
    /\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:and|or|&)\s*(?:above|more|upwards?)\b/i,
  ) || candidate.match(
    /\b(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)\b/i,
  )
  if (plusMatch) {
    const minimumYears = formatExperienceYears(plusMatch[1])
    if (minimumYears) {
      return `${minimumYears}+ years`
    }
  }

  const singleMatch = candidate.match(/\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i)
  if (singleMatch) {
    const years = formatExperienceYears(singleMatch[1])
    if (years) {
      return `${years} years`
    }
  }

  return null
}

const isPdfUrl = (url, contentType = '') =>
  PDF_CONTENT_TYPE_PATTERN.test(String(contentType ?? ''))
  || /\.pdf(?:$|\?)/i.test(String(url ?? ''))

const defaultFetchDocumentText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const contentType = response.headers?.get?.('content-type') || ''
  if (isPdfUrl(url, contentType)) {
    return extractTextFromPdfBuffer(await response.arrayBuffer())
  }

  return response.text()
}

const memoizeFetchDocumentText = (fetchDocumentText) => {
  const cache = new Map()

  return async (url) => {
    if (!cache.has(url)) {
      cache.set(url, Promise.resolve().then(() => fetchDocumentText(url)))
    }

    try {
      return await cache.get(url)
    } catch (error) {
      cache.delete(url)
      throw error
    }
  }
}

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length)
  const limit = Math.max(1, Math.min(items.length, concurrency))
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

const buildDetailSummary = (detailText) => {
  const normalized = normalizeWhitespace(detailText)
  if (!normalized) return null

  return normalized.length > 800 ? `${normalized.slice(0, 797).trimEnd()}...` : normalized
}

const enrichJobWithDetailText = async (job, fetchDocumentText) => {
  const detailUrl = job.sourceUrl || job.applyUrl
  if (!detailUrl || typeof fetchDocumentText !== 'function') return job

  try {
    const detailText = normalizeWhitespace(await fetchDocumentText(detailUrl))
    if (!detailText) return job

    return {
      ...job,
      experienceRequired: extractSeweurodriveExperienceRequired(detailText) || job.experienceRequired || null,
      jobDescription: detailText,
      description: buildDetailSummary(detailText),
      publicExperienceChecked: true,
      detailPreviewHtml: `<html><head><title>${escapeHtml(job.title || '')}</title></head><body><h1>${escapeHtml(job.title || '')}</h1><article>${escapeHtml(detailText)}</article></body></html>`,
    }
  } catch {
    return job
  }
}

const extractOpeningsTable = (html) => {
  const tables = [...String(html ?? '').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
  return tables.find((match) => {
    const text = stripTags(match[0]) || ''
    return (
      /Job opportunities/i.test(String(html ?? ''))
      && /current job offers/i.test(String(html ?? ''))
      && /Sr\.\s*No\./i.test(text)
      && /Job Position/i.test(text)
      && /Location/i.test(text)
      && /Vertical/i.test(text)
      && /Job Description/i.test(text)
    )
  })?.[0] || null
}

const extractRows = (tableHtml) => [...String(tableHtml ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => cell[1]))
  .filter((cells) => cells.length >= 5)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  return (
    /Your career at SEW-EURODRIVE/i.test(text)
    && /Job opportunities/i.test(text)
    && /current job offers/i.test(text)
    && /application form/i.test(text)
    && /Take a look at our current job opportunities\./i.test(text)
  )
}

export const extractApplicationFormUrl = (html) => {
  const match = String(html ?? '').match(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>\s*application form\s*<\/a>/i)
  return toAbsoluteUrl(match?.[2] || null)
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('SEW-EURODRIVE India careers page no longer matches the verified official careers surface')
  }

  const applicationFormUrl = extractApplicationFormUrl(html)
  const tableHtml = extractOpeningsTable(html)
  if (!applicationFormUrl || !tableHtml) {
    throw new Error('SEW-EURODRIVE India careers page no longer exposes the expected openings table')
  }

  const jobs = extractRows(tableHtml)
    .map((cells) => {
      const title = stripTags(cells[1])
      const rawLocation = stripTags(cells[2])
      const department = stripTags(cells[3])
      const sourceUrl = toAbsoluteUrl(extractHref(cells[4]))

      if (!title || !rawLocation || !department || !sourceUrl) return null
      if (/^job position$/i.test(title) && /^vertical$/i.test(department)) return null

      const location = normalizeLocation(rawLocation)
      const city = extractCity(rawLocation)
      const jobKey = slugify([title, department, rawLocation].join(' '))
      const jobId = `${SOURCE}-${jobKey}`

      return {
        title,
        company: COMPANY,
        department,
        location,
        city,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: applicationFormUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: buildJobDescription({
          title,
          department,
          location,
        }),
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('SEW-EURODRIVE India careers page no longer exposes the expected openings table')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSeweurodriveIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  detailFetchConcurrency = DEFAULT_DETAIL_FETCH_CONCURRENCY,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchDocumentText = null } = {}) {
    const html = await fetchText(CAREERS_URL)
    const jobs = extractOpenings(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const detailFetcher = fetchDocumentText
      || (fetchText === defaultFetchText ? defaultFetchDocumentText : null)
    const memoizedDetailFetcher = detailFetcher
      ? memoizeFetchDocumentText(detailFetcher)
      : null
    const enrichedJobs = memoizedDetailFetcher
      ? await mapWithConcurrency(
          selectedJobs,
          detailFetchConcurrency,
          (job) => enrichJobWithDetailText(job, memoizedDetailFetcher),
        )
      : selectedJobs

    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createSeweurodriveIndiaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
