import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDUSIND_BANK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INDUSIND_BANK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const JOBS_API_BODY = {
  JDFileName: '',
  OrgCode: '',
  KeyName: '',
  Type: 'D',
  StateCode: '',
}

const WORKLINE_ORIGIN = new URL(JOBS_BOARD_URL).origin

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|span|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null

  const [, day, monthText, year] = match
  const month = MONTHS[monthText.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${day.padStart(2, '0')}`
}

const buildCookieHeader = (headers) => {
  if (!headers) return null

  const rawCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (() => {
        const single = headers.get?.('set-cookie')
        return single ? [single] : []
      })()

  const cookies = rawCookies
    .map((cookie) => String(cookie ?? '').split(';')[0]?.trim())
    .filter(Boolean)

  return cookies.length > 0 ? cookies.join('; ') : null
}

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
    cookieHeader: buildCookieHeader(response.headers),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    body: options.body,
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const uniqueParts = (parts) => {
  const seen = new Set()
  const output = []

  for (const value of parts) {
    const normalized = normalizeWhitespace(value)
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    output.push(normalized)
  }

  return output
}

const getDetailIdentifiers = (record = {}) => ({
  trackToken: normalizeWhitespace(record.TrackToken),
  searchKeyword: normalizeWhitespace(record.SearchKeyWord),
})

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*IndusInd Bank - Cards, Loans, Accounts, Personal &(?:amp;)? NRI Banking Online\s*<\/title>/i.test(page)
    && /href=["']https:\/\/app1100\.workline\.hr\/careers\/["']/i.test(page)
}

export const extractCareersHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/app1100\.workline\.hr\/careers\/)["']/i,
  )

  return toAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialCareersLandingSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*IndusInd Bank Careers\s*<\/title>/i.test(page)
    && text.includes('Become An IndusIndian')
    && text.includes('Life at IndusInd Bank')
    && /Apply Now/i.test(page)
    && /indusind\.bank\.in/i.test(page)
}

export const extractJobsBoardUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["']([^"']*Cportal\/GeneralOpening\.aspx[^"']*)["']/i,
  )

  return toAbsoluteUrl(match?.[1], CAREERS_URL)
}

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*IndusInd Bank - Workline - Possibilities Infinite\s*<\/title>/i.test(page)
    && /GeneralOpenings\.js/i.test(page)
    && /GeneralOpeningsDataLoad\(\s*''\s*,\s*''\s*,\s*''\s*,\s*'D'\s*,\s*''\s*\)/i.test(page)
    && text.includes('Begin your search for greater opportunities')
    && text.includes('Search Jobs')
    && /loadopenings/i.test(page)
}

export const hasVerifiedJobsPayloadContract = (payload) => {
  if (typeof payload?.d?.obj1 !== 'string' || typeof payload?.d?.obj2 !== 'string') {
    return false
  }

  try {
    return Array.isArray(JSON.parse(payload.d.obj1)) && Array.isArray(JSON.parse(payload.d.obj2))
  } catch {
    return false
  }
}

export const extractListingRecords = (payload) => {
  if (!hasVerifiedJobsPayloadContract(payload)) {
    throw new Error('IndusInd Bank verified jobs api no longer matches the known public response contract')
  }

  return JSON.parse(payload.d.obj1).filter((record) => record && typeof record === 'object')
}

export const buildDetailUrl = (record = {}) => {
  const { trackToken, searchKeyword } = getDetailIdentifiers(record)
  if (!trackToken || !searchKeyword) return null

  return `${WORKLINE_ORIGIN}/CandidatePortal/${trackToken}/${encodeURIComponent(searchKeyword)}`
}

export const hasOfficialDetailPageSignal = (html = '', record = {}) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(record.Position_Name)
  const reqNo = normalizeWhitespace(record.Req_No)
  const location = normalizeWhitespace(record.Field2 || record.City_Name)
  const postedDate = normalizeWhitespace(record.PublishDate)

  return Boolean(title)
    && (
      new RegExp(`<title>\\s*${escapeRegExp(title)}\\s*<\\/title>`, 'i').test(page)
      || new RegExp(`og:title[^>]+${escapeRegExp(title)}`, 'i').test(page)
      || new RegExp(`>\\s*${escapeRegExp(title)}\\s*<`, 'i').test(page)
    )
    && (!reqNo || new RegExp(`\\b${escapeRegExp(reqNo)}\\b`).test(page))
    && (!location || new RegExp(`\\b${escapeRegExp(location)}\\b`).test(page))
    && (!postedDate || page.includes(postedDate))
    && /id=["']PRFCode["']/i.test(page)
    && /\/Candidate\/SignInv1\.aspx/i.test(page)
}

const buildLocation = (record = {}) => {
  const parts = uniqueParts([record.Field2 || record.City_Name, record.State_Name, 'India'])
  return parts.join(', ') || 'India'
}

const buildJobDescription = (record = {}) => [
  normalizeWhitespace(record.Company_Name)
    ? `Business unit: ${normalizeWhitespace(record.Company_Name)}`
    : null,
  normalizeWhitespace(record.FunName)
    ? `Function: ${normalizeWhitespace(record.FunName)}`
    : null,
  normalizeWhitespace(record.Field1)
    ? `Department label: ${normalizeWhitespace(record.Field1)}`
    : null,
  normalizeWhitespace(record.LOCATIONNAME)
    ? `Location: ${normalizeWhitespace(record.LOCATIONNAME)}`
    : null,
  normalizeWhitespace(record.City_Name || record.Field2)
    ? `City: ${normalizeWhitespace(record.City_Name || record.Field2)}`
    : null,
  normalizeWhitespace(record.State_Name)
    ? `State: ${normalizeWhitespace(record.State_Name)}`
    : null,
  normalizeWhitespace(record.Experience)
    ? `Experience: ${normalizeWhitespace(record.Experience)}`
    : null,
  normalizeWhitespace(record.PublishDate)
    ? `Posted: ${normalizeWhitespace(record.PublishDate)}`
    : null,
].filter(Boolean).join('\n') || null

export const mapListingRecordToJob = (
  record = {},
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const title = normalizeWhitespace(record.Position_Name)
  const requisitionId = normalizeWhitespace(record.Req_No)
  const detailUrl = buildDetailUrl(record)

  if (!title || !requisitionId || !detailUrl) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(record.FunName) || null,
    location: buildLocation(record),
    city: normalizeWhitespace(record.City_Name || record.Field2) || null,
    country: 'India',
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId,
    employmentType: null,
    workplaceType: null,
    experienceRequired: normalizeWhitespace(record.Experience) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: normalizeDate(record.PublishDate),
    closingDate: null,
    jobDescription: buildJobDescription(record),
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: detailUrl,
    scrapedAt,
  }
}

export const createIndusIndBankScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const careersHandoffUrl = extractCareersHandoffUrl(homepage.html)

    if (
      homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.html)
      || careersHandoffUrl !== CAREERS_URL
    ) {
      throw new Error('IndusInd Bank verified official homepage no longer matches the known careers handoff')
    }

    const careersLanding = await fetchPage(CAREERS_URL)
    const jobsBoardUrl = extractJobsBoardUrl(careersLanding.html)

    if (
      careersLanding.status !== 200
      || !hasOfficialCareersLandingSignal(careersLanding.html)
      || jobsBoardUrl !== JOBS_BOARD_URL
    ) {
      throw new Error('IndusInd Bank verified careers landing no longer matches the known Workline handoff')
    }

    const jobsBoard = await fetchPage(JOBS_BOARD_URL)
    if (
      jobsBoard.status !== 200
      || !hasOfficialJobsBoardSignal(jobsBoard.html)
    ) {
      throw new Error('IndusInd Bank verified jobs board no longer matches the known public Workline surface')
    }

    const cookieHeader = jobsBoard.cookieHeader || null
    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: WORKLINE_ORIGIN,
        Referer: JOBS_BOARD_URL,
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(JOBS_API_BODY),
    })

    if (!hasVerifiedJobsPayloadContract(payload)) {
      throw new Error('IndusInd Bank verified jobs api no longer matches the known public response contract')
    }

    const records = extractListingRecords(payload)
    if (records.length === 0) {
      return []
    }

    const scrapedAt = now()
    const jobs = []

    for (const record of records) {
      const job = mapListingRecordToJob(record, { scrapedAt })

      if (!job) {
        throw new Error('IndusInd Bank verified jobs api returned records that no longer match the expected public job shape')
      }

      const detailPage = await fetchPage(job.sourceUrl, {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      })

      if (detailPage.status !== 200 || !hasOfficialDetailPageSignal(detailPage.html, record)) {
        throw new Error('IndusInd Bank verified detail page no longer matches the known public route shape')
      }

      jobs.push(job)
    }

    return jobs
  },
})

export const run = async (options = {}) => createIndusIndBankScraper(options).run(options)

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
