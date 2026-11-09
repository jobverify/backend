import crypto from 'node:crypto'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SIFY_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const ABOUT_URL = PROVIDER_METADATA.officialAboutPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_PAGE_URL = PROVIDER_METADATA.officialJobsPageUrl
export const SELLER_SHORT_CODE = PROVIDER_METADATA.sellerShortCode
export const API_BASE_URL = PROVIDER_METADATA.apiBaseUrl
export const LIST_API_URL = PROVIDER_METADATA.listingApiUrl
export const DETAIL_API_URL = PROVIDER_METADATA.detailApiUrl

const TALLITE_SECRET = 'T@MiCr097124!iCR'
const TALLITE_IV = Buffer.from('1234567891234567', 'utf8')
const TALLITE_KEY = crypto.createHash('sha256').update(TALLITE_SECRET, 'utf8').digest()
const TALLITE_PUBLIC_GEO_CONTEXT = {
  ip: '122.234.345.11',
  region: 'IN',
  bu: '',
}
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[\u2018\u2019]/g, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/table|\/tr|\/td|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const buildTallitePublicHeaders = () => {
  const timestamp = String(Date.now())
  const { ip, region, bu } = TALLITE_PUBLIC_GEO_CONTEXT
  const hash = crypto.createHash('sha512')
    .update(`${timestamp}${ip}${region}${TALLITE_SECRET}`, 'utf8')
    .digest('hex')

  return {
    ip,
    region,
    hash,
    lngId: '1',
    timestamp,
    bu,
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json;charset=UTF-8',
    Origin: 'https://sifycareer.tallite.com',
    Referer: JOBS_PAGE_URL,
    ...buildTallitePublicHeaders(),
    ...(options.headers ?? {}),
  },
  label: SOURCE,
  timeoutMs: 30000,
})

const splitSkills = (...values) => {
  const seen = new Set()
  const skills = []

  for (const value of values) {
    for (const rawSkill of String(value ?? '').split(',')) {
      const skill = normalizeWhitespace(rawSkill)
      if (!skill) continue

      const key = skill.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      skills.push(skill)
    }
  }

  return skills
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatExperienceRange = (minimum, maximum) => {
  const min = Number.parseInt(String(minimum ?? ''), 10)
  const max = Number.parseInt(String(maximum ?? ''), 10)

  if (Number.isFinite(min) && Number.isFinite(max)) {
    return min === max ? `${min} years` : `${min} - ${max} years`
  }

  if (Number.isFinite(min)) return `${min}+ years`
  if (Number.isFinite(max)) return `0 - ${max} years`
  return null
}

const normalizeExperienceLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d+\s*-\s*\d+$/.test(normalized)) {
    return `${normalized.replace(/\s*-\s*/g, ' - ')} years`
  }

  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalizeWhitespace(normalized.split(',')[0]) || null
}

const extractMinimumQualification = (descriptionHtml = '') => {
  const text = stripHtml(descriptionHtml)
  if (!text) return null

  const match = text.match(/Qualifications:\s*(.+)$/i)
  return normalizeWhitespace(match?.[1] ?? null)
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*About us\s*\|\s*Sify Technologies\s*<\/title>/i.test(page)
    && /href=["']https:\/\/sifycareer\.tallite\.com(?:\/jobs)?\/?["']/i.test(page)
    && text.includes('Driving Business Transformation Across Industries')
    && /India['’]s only organically grown ICT company/i.test(text)
}

export const buildListRequestPayload = ({
  page = 1,
  limit = 10,
  search = '',
} = {}) => ({
  search,
  resId: 0,
  sellerShortCode: SELLER_SHORT_CODE,
  expFrom: 0,
  expTo: null,
  jobType: null,
  location: null,
  currency: 2,
  minSalary: 0,
  maxSalary: 0,
  scale: 5,
  startPage: page,
  limit,
  myJobs: 0,
  clients: null,
  sortBy: 1,
  salaryRange: null,
  locationId: null,
  jobTypeId: null,
  industryId: null,
  industries: null,
  experienceId: null,
})

export const buildDetailRequestPayload = (productCode) => ({
  resId: null,
  sellerShortCode: SELLER_SHORT_CODE,
  productCode: String(productCode ?? ''),
})

export const encryptTallitePayload = (payload = {}) => {
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))
  const cipher = crypto.createCipheriv('aes-256-cbc', TALLITE_KEY, TALLITE_IV)
  const encrypted = Buffer.concat([
    cipher.update(compressed),
    cipher.final(),
  ])

  return { data: encrypted.toString('base64') }
}

export const decryptTalliteEnvelope = (envelope = {}) => {
  const cipherText = normalizeWhitespace(
    typeof envelope === 'string' ? envelope : envelope?.data,
  )

  if (!cipherText) {
    throw new Error('Sify Technologies encrypted Tallite payload is missing data')
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', TALLITE_KEY, TALLITE_IV)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64')),
    decipher.final(),
  ])

  return JSON.parse(zlib.gunzipSync(decrypted).toString('utf8'))
}

export const buildJobUrl = (jobId, title) =>
  `${CAREERS_URL}job/${normalizeWhitespace(jobId) || ''}?name=${encodeURIComponent(normalizeWhitespace(title) || '')}`

export const extractCareerListings = (payload = {}) => {
  const list = Array.isArray(payload?.list) ? payload.list : []

  return list
    .map((record) => {
      const title = normalizeWhitespace(record.productName)
      const jobId = normalizeWhitespace(record.productCode)
      const requisitionId = normalizeWhitespace(record.productCodeText)
      const sourceUrl = buildJobUrl(jobId, title)

      if (!title || !jobId || !requisitionId) return null

      return {
        title,
        company: COMPANY_NAME,
        department: normalizeWhitespace(record.sellerCompanyName),
        location: normalizeWhitespace(record.jobLocation),
        city: extractCity(record.jobLocation),
        country: 'India',
        jobId,
        requisitionId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record.jobType),
        experienceRequired:
          formatExperienceRange(record.expFrom, record.expTo)
          || normalizeExperienceLabel(record.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: splitSkills(record.keySkills, record.certiKeywords),
        postingDate: normalizeDate(record.postedDate),
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = payload?.detail || {}
  const title = normalizeWhitespace(detail.productName) || listing.title || null
  const jobId = normalizeWhitespace(detail.productCode) || listing.jobId || null
  const requisitionId = normalizeWhitespace(detail.productCodeText) || listing.requisitionId || null
  const location = normalizeWhitespace(detail.branchName) || listing.location || normalizeWhitespace(detail.jobLocation)
  const sourceUrl = buildJobUrl(jobId, title)

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(detail.Requirement_Client_Name)
      || listing.department
      || normalizeWhitespace(detail.reqCompanyTitle),
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(detail.jobType) || listing.employmentType || null,
    experienceRequired: formatExperienceRange(detail.expFrom, detail.expTo) || listing.experienceRequired || null,
    minimumQualification: extractMinimumQualification(detail.description),
    preferredQualification: null,
    requiredSkills: splitSkills(detail.keySkills, detail.certiKeywords),
    postingDate: normalizeDate(detail.postedDate) || listing.postingDate || null,
    closingDate: null,
    jobDescription: stripHtml(detail.description),
    remoteStatus: null,
  }
}

export const hasNextPage = (payload = {}, page = 1) => {
  const totalCount = Number.parseInt(String(payload?.count ?? ''), 10)
  const pageSize = Number.parseInt(String(payload?.limit ?? ''), 10) || 10

  if (!Number.isFinite(totalCount) || totalCount <= 0) return false
  return page * pageSize < totalCount
}

export const isIndiaDetail = (payload = {}) => {
  const detail = payload?.detail || {}
  const region = normalizeWhitespace(detail.reqRegionTitle)
  const location = normalizeWhitespace(detail.branchName) || normalizeWhitespace(detail.jobLocation)

  return region === 'IN' || /(?:^|,\s*)India$/i.test(location || '')
}

const postEncryptedPayload = async (url, payload, fetchJson) => {
  const response = await fetchJson(url, {
    method: 'POST',
    body: JSON.stringify(encryptTallitePayload(payload)),
  })

  return decryptTalliteEnvelope(response)
}

export const createSifyTechnologiesScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutPageSignal(aboutHtml)) {
      throw new Error('Sify Technologies verified official Sify about page no longer matches the trusted first-party careers handoff')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listPayload = await postEncryptedPayload(
        LIST_API_URL,
        buildListRequestPayload({ page }),
        fetchJson,
      )

      const listings = extractCareerListings(listPayload)
      if (listings.length === 0) {
        throw new Error('Sify Technologies public Tallite job list payload no longer exposes the verified public jobs contract')
      }

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await postEncryptedPayload(
          DETAIL_API_URL,
          buildDetailRequestPayload(listing.jobId),
          fetchJson,
        )

        if (!isIndiaDetail(detailPayload)) continue

        const detailJob = extractJobDetail(detailPayload, listing)
        jobs.push({
          ...detailJob,
          source: SOURCE,
          link: detailJob.applyUrl || detailJob.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!hasNextPage(listPayload, page)) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createSifyTechnologiesScraper(options).run()

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
