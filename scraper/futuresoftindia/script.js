import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { FUTURESOFT_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FUTURESOFT_INDIA_CATALOG.source
export const COMPANY = FUTURESOFT_INDIA_CATALOG.companyName
export const CAREERS_URL = FUTURESOFT_INDIA_CATALOG.companyCareerPage
export const JOBS_API_URL = 'https://futuresoftindia.com/Careers/GetAllRequisitions'
export const VERIFIED_ON = FUTURESOFT_INDIA_CATALOG.verifiedOn
export const PROVIDER_METADATA = FUTURESOFT_INDIA_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PAGE_SIZE = 25

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^delhi ncr$/i.test(normalized)) return 'Delhi NCR'
  return normalized
}

export const hasVerifiedCareersSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('careers at futuresoft india')
}

export const hasVerifiedJobsTableShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Propel Your Career with Futuresoft India \| Career at FS\s*<\/title>/i.test(page)
    && /Job Code/i.test(page)
    && /Job Title/i.test(page)
    && /Location/i.test(page)
    && /Experience \(Yrs\)/i.test(page)
    && /Action/i.test(page)
    && /\/Careers\/GetAllRequisitions/i.test(page)
}

export const buildJobsApiBody = ({ draw = 1, start = 0, length = PAGE_SIZE } = {}) => new URLSearchParams({
  draw: String(draw),
  start: String(start),
  length: String(length),
  'search[value]': '',
  'search[regex]': 'false',
  'order[0][column]': '0',
  'order[0][dir]': 'desc',
  'columns[0][data]': 'JobCode',
  'columns[0][name]': 'JobCode',
  'columns[0][searchable]': 'true',
  'columns[0][orderable]': 'true',
  'columns[0][search][value]': '',
  'columns[0][search][regex]': 'false',
  'columns[1][data]': 'JobTitle',
  'columns[1][name]': 'JobTitle',
  'columns[1][searchable]': 'true',
  'columns[1][orderable]': 'true',
  'columns[1][search][value]': '',
  'columns[1][search][regex]': 'false',
  'columns[2][data]': 'LocationName',
  'columns[2][name]': 'LocationName',
  'columns[2][searchable]': 'true',
  'columns[2][orderable]': 'true',
  'columns[2][search][value]': '',
  'columns[2][search][regex]': 'false',
  'columns[3][data]': 'Experience',
  'columns[3][name]': 'Experience',
  'columns[3][searchable]': 'true',
  'columns[3][orderable]': 'true',
  'columns[3][search][value]': '',
  'columns[3][search][regex]': 'false',
  'columns[4][data]': 'Action',
  'columns[4][name]': 'Action',
  'columns[4][searchable]': 'true',
  'columns[4][orderable]': 'false',
  'columns[4][search][value]': '',
  'columns[4][search][regex]': 'false',
  JobTitle: '',
  JobLocation: '0',
  Experience: '0',
})

export const hasVerifiedJobsPayloadContract = (payload = {}) =>
  Array.isArray(payload?.data)
  && Number.isFinite(Number(payload?.recordsTotal))
  && Number.isFinite(Number(payload?.recordsFiltered))

export const extractJobRecords = (payload = {}) => {
  if (!hasVerifiedJobsPayloadContract(payload)) {
    throw new Error('The verified FutureSoft India jobs payload no longer matches the public DataTables contract')
  }

  return payload.data.filter((record) => record && typeof record === 'object')
}

export const buildViewUrl = (record = {}) => {
  const id = Number(record?.iClientRecruitmentId)
  const title = normalizeWhitespace(record?.JobTitle)
  if (!Number.isFinite(id) || !title) return null

  return `https://futuresoftindia.com/Careers/ShowViewAndApplyJob?iClientRecruitmentId=${id}&jobtitle=${encodeURIComponent(title)}&type=view`
}

export const buildApplyUrl = (record = {}) => {
  const id = Number(record?.iClientRecruitmentId)
  const title = normalizeWhitespace(record?.JobTitle)
  if (!Number.isFinite(id) || !title) return null

  return `https://futuresoftindia.com/Careers/ShowViewAndApplyJob?iClientRecruitmentId=${id}&jobtitle=${encodeURIComponent(title)}&type=apply`
}

export const mapRecordToJob = (record, { scrapedAt = new Date().toISOString() } = {}) => {
  const title = normalizeWhitespace(record?.JobTitle)
  const jobCode = normalizeWhitespace(record?.JobCode)
  const locationName = normalizeLocation(record?.LocationName)
  const sourceUrl = buildViewUrl(record)
  const applyUrl = buildApplyUrl(record)
  const id = Number(record?.iClientRecruitmentId)

  if (!title || !jobCode || !locationName || !sourceUrl || !applyUrl || !Number.isFinite(id)) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(record?.Queue),
    location: `${locationName}, India`,
    city: locationName,
    state: null,
    country: 'India',
    jobId: `${SOURCE}-${id}`,
    requisitionId: jobCode,
    sourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: normalizeWhitespace(record?.Experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: normalizeWhitespace(record?.ShortDescription)
      ?.split(',')
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean) || [],
    postingDate: null,
    closingDate: null,
    jobDescription: stripHtml(record?.DetailedJD) || normalizeWhitespace(record?.ShortDescription) || null,
    remoteStatus: 'On-site',
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  body,
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createFutureSoftIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersSignal(careersHtml) || !hasVerifiedJobsTableShellSignal(careersHtml)) {
      throw new Error('The verified FutureSoft India careers page no longer matches the trusted first-party jobs surface')
    }

    const scrapedAt = now()
    const collected = []
    const seen = new Set()
    let totalRecords = Number.POSITIVE_INFINITY

    for (let start = 0, draw = 1; start < totalRecords; start += PAGE_SIZE, draw += 1) {
      const payload = await fetchJson(JOBS_API_URL, buildJobsApiBody({ draw, start, length: PAGE_SIZE }))
      const records = extractJobRecords(payload)
      totalRecords = Number(payload.recordsFiltered || payload.recordsTotal || records.length || 0)

      for (const record of records) {
        const job = mapRecordToJob(record, { scrapedAt })
        if (!job || seen.has(job.jobId)) continue
        seen.add(job.jobId)
        collected.push(job)
      }

      if (records.length === 0) break
    }

    return collected
  },
})

export const run = async (options = {}) => createFutureSoftIndiaScraper(options).run(options)

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
