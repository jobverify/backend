import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import QURE_AI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = QURE_AI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.careersPortalUrl
export const EMBEDDED_JOBS_INPUT_ID = PROVIDER_METADATA.embeddedJobsInputId

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const decodeHtmlAttribute = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>'),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/permanent|full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const slugify = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^A-Za-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-')

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)

  if (record.Remote_Job) {
    return {
      location: 'Remote',
      city: null,
      state: null,
      country: null,
    }
  }

  return {
    location: [city, state, country].filter(Boolean).join(', ') || country || null,
    city,
    state,
    country,
  }
}

const extractEmploymentTypeFromDescription = (value) => {
  const description = normalizeWhitespace(value)
  if (!description) return null

  const match = description.match(
    /Employment Type:\s*([\s\S]*?)(?:Key Relationships|Job Description|Roles and Responsibilities|At Qure\.ai|By submitting|$)/i,
  )
  return normalizeEmploymentType(match?.[1])
}

const isPublishedRecord = (record = {}) => record.Publish !== false

const isUnlockedRecord = (record = {}) => record.Is_Locked !== true

const isSamePortalHost = (value) => {
  try {
    return new URL(value || CAREERS_PORTAL_URL).hostname === 'career.qure.ai'
  } catch {
    return false
  }
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Qure\.ai Careers\s*<\/title>/i.test(page)
    && /https:\/\/career\.qure\.ai\/jobs\/Careers/i.test(page)
    && /Qure\.ai Technologies Private Limited/i.test(page)
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /meta property=["']og:url["'] content=["']https:\/\/career\.qure\.ai\/jobs\/Careers["']/i.test(page)
    && /Qure ai Technologies Pvt Ltd/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, EMBEDDED_JOBS_INPUT_ID)
}

export const buildJobDetailUrl = (jobId, title) => {
  const slug = slugify(title)
  const baseUrl = `${CAREERS_PORTAL_URL}/${encodeURIComponent(String(jobId ?? ''))}`
  return slug ? `${baseUrl}/${slug}?source=CareerSite` : `${baseUrl}?source=CareerSite`
}

export const extractEmbeddedJobsPayload = (html) => {
  const inputs = [...String(html ?? '').matchAll(/<input\b[^>]*>/gi)].map((match) => match[0])
  const jobsInput = inputs.find((tag) =>
    new RegExp(`\\bid=["']${EMBEDDED_JOBS_INPUT_ID}["']`, 'i').test(tag))

  if (!jobsInput) {
    throw new Error('Qure.ai careers portal no longer exposes the verified embedded jobs payload')
  }

  const valueMatch = jobsInput.match(/\bvalue=("([\s\S]*?)"|'([\s\S]*?)')/i)
  const encodedValue = valueMatch ? (valueMatch[2] ?? valueMatch[3] ?? '') : ''
  const decodedValue = decodeHtmlAttribute(encodedValue)

  if (!decodedValue) {
    throw new Error('Qure.ai embedded jobs payload is empty')
  }

  return JSON.parse(decodedValue)
}

export const hasVerifiedJobDetailPage = (page = {}, job = {}) => {
  if (!isSamePortalHost(page.url || job.sourceUrl)) {
    return false
  }

  if (Number(page.status) !== 200) {
    return false
  }

  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const title = normalizeWhitespace(job.title)?.toLowerCase() || ''

  return normalized.includes('qure ai technologies pvt ltd')
    && normalized.includes(title)
}

export const extractIndiaJobs = (records) => (Array.isArray(records) ? records : [])
  .filter((record) => isPublishedRecord(record) && isUnlockedRecord(record))
  .filter((record) => /india/i.test(normalizeWhitespace(record.Country) || ''))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const jobId = normalizeWhitespace(record.id)
    const { location, city, state, country } = normalizeLocation(record)

    if (!title || !jobId || !location || !country) return null

    const sourceUrl = buildJobDetailUrl(jobId, title)

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType:
        extractEmploymentTypeFromDescription(record.Job_Description)
        || normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
    }
  })
  .filter(Boolean)
  .sort((left, right) => String(right.postingDate || '').localeCompare(String(left.postingDate || '')))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createQureAiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Response is not the verified official Qure.ai careers page')
    }

    const portalPage = await fetchPage(CAREERS_PORTAL_URL)
    if (portalPage.status !== 200 || !hasOfficialPortalSignal(portalPage.html)) {
      throw new Error('Response is not the verified official Qure.ai careers portal')
    }

    const allJobs = extractIndiaJobs(extractEmbeddedJobsPayload(portalPage.html))
    const selectedJobs = maxJobs ? allJobs.slice(0, maxJobs) : allJobs

    if (selectedJobs.length > 0) {
      const detailPage = await fetchPage(selectedJobs[0].sourceUrl)
      if (!hasVerifiedJobDetailPage(detailPage, selectedJobs[0])) {
        throw new Error('Qure.ai job detail pages no longer match the verified public jobs surface')
      }
    }

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createQureAiScraper(options).run(options)

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
