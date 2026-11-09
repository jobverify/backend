import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AUXILO_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AUXILO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_ENTRY_URL = PROVIDER_METADATA.jobsBoardEntryUrl
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const SAMPLE_DETAIL_URL = PROVIDER_METADATA.sampleDetailUrl
export const SAMPLE_APPLY_URL = PROVIDER_METADATA.sampleApplyUrl
export const JOBS_API_BODY = {
  JDFileName: '',
  OrgCode: '',
  KeyName: '',
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
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
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
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|button|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeField = (value) => normalizeWhitespace(value) || null

const toAbsoluteUrl = (value, baseUrl = JOBS_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  if (response.url !== url) {
    throw new Error('Auxilo verified jobs API redirect no longer matches the known public endpoint')
  }

  return response.json()
}

const normalizeDate = (value) => {
  const normalized = normalizeField(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null

  const [, day, monthText, year] = match
  const month = MONTHS[monthText.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${day.padStart(2, '0')}`
}

const getTrackToken = (recordOrTrackToken) => {
  if (typeof recordOrTrackToken === 'string') {
    return normalizeField(recordOrTrackToken)
  }

  return normalizeField(recordOrTrackToken?.TrackToken)
}

const getSearchKeyword = (record) => normalizeField(record?.SearchKeyWord)

const uniqueParts = (parts) => {
  const seen = new Set()
  const output = []

  for (const value of parts) {
    const normalized = normalizeField(value)
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    output.push(normalized)
  }

  return output
}

const buildLocation = (record) => {
  const country = normalizeField(record?.Country_Name) || 'India'
  const locationName = normalizeField(record?.LOCATIONNAME || record?.Field2)
  const state = normalizeField(record?.State_Name)
  const parts = uniqueParts([locationName, state, country])

  return parts.length > 0 ? parts.join(', ') : country
}

const buildJobDescription = (record) => {
  const lines = [
    normalizeField(record?.Business_Name)
      ? `Business: ${normalizeField(record.Business_Name)}`
      : null,
    normalizeField(record?.Field1)
      ? `Line of business: ${normalizeField(record.Field1)}`
      : null,
    normalizeField(record?.FunName)
      ? `Function: ${normalizeField(record.FunName)}`
      : null,
    normalizeField(record?.LOCATIONNAME)
      ? `Location: ${normalizeField(record.LOCATIONNAME)}`
      : null,
    normalizeField(record?.GradeName)
      ? `Grade: ${normalizeField(record.GradeName)}`
      : null,
    Number.isFinite(Number(record?.No_Of_Vacancies))
      ? `Open positions: ${Number(record.No_Of_Vacancies)}`
      : null,
    normalizeField(record?.PublishDate)
      ? `Posted: ${normalizeField(record.PublishDate)}`
      : null,
  ].filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : null
}

const isIndiaListingRecord = (record) => {
  const country = normalizeField(record?.Country_Name)
  return !country || /\bindia\b/i.test(country)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*Education Loans - Apply for Student Loan from Auxilo\s*<\/title>/i.test(page)
    && /\bAuxilo\b/i.test(text)
    && /href=["'](?:https:\/\/www\.auxilo\.com)?\/careers["']/i.test(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*(?:Opportunity to join us \| Auxilo Finserve|Careers at Auxilo \| Join Our Education Finance Team)\s*<\/title>/i.test(page)
    && /Browse all available jobs at Auxilo/i.test(text)
    && /View Current Openings/i.test(text)
    && /app1176\.workline\.hr\/candidate/i.test(page)
}

export const extractJobsBoardEntryUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["']([^"']*app1176\.workline\.hr\/candidate[^"']*)["']/i,
  )

  return toAbsoluteUrl(match?.[1], CAREERS_URL)
}

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*Auxilo - Workline - Possibilities Infinite\s*<\/title>/i.test(page)
    && /Begin your search for greater opportunities/i.test(text)
    && /\bSearch Jobs\b/i.test(text)
    && /\bPost Resume\b/i.test(text)
    && /(GeneralOpenings\.js|GetCurrentopening)/i.test(page)
}

export const hasVerifiedJobsPayloadContract = (payload) => {
  if (typeof payload?.d?.obj1 !== 'string' || typeof payload?.d?.obj2 !== 'string') {
    return false
  }

  try {
    return Array.isArray(JSON.parse(payload.d.obj1))
      && Array.isArray(JSON.parse(payload.d.obj2))
  } catch {
    return false
  }
}

export const extractListingRecords = (payload) => {
  if (!hasVerifiedJobsPayloadContract(payload)) {
    throw new Error('Auxilo verified jobs api no longer matches the known public response contract')
  }

  const records = JSON.parse(payload.d.obj1)
  const requisitions = new Set()
  const applicationTokens = new Set()
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || !['Position_Name', 'TrackToken', 'SearchKeyWord'].every((key) => typeof record[key] === 'string' && normalizeField(record[key]))
      || !['string', 'number'].includes(typeof record.Req_No) || !normalizeField(record.Req_No)) {
      throw new Error('Auxilo verified jobs api returned a malformed record outside the expected public job shape')
    }
    const requisition = normalizeField(record.Req_No)
    const token = getTrackToken(record)
    if (requisitions.has(requisition) || applicationTokens.has(token)) {
      throw new Error('Auxilo verified jobs api returned a duplicate job identity')
    }
    requisitions.add(requisition)
    applicationTokens.add(token)
  }
  return records
}

export const buildDetailUrl = (record = {}) => {
  const trackToken = getTrackToken(record)
  const searchKeyword = getSearchKeyword(record)

  if (!trackToken || !searchKeyword) return null

  return `${WORKLINE_ORIGIN}/CandidatePortal/${trackToken}/${encodeURIComponent(searchKeyword)}`
}

export const buildApplyUrl = (recordOrTrackToken) => {
  const trackToken = getTrackToken(recordOrTrackToken)
  if (!trackToken) return null

  return `${WORKLINE_ORIGIN}/Candidate/SignInv1.aspx?PRFCode=${encodeURIComponent(trackToken)}&Flag=C&DirectApply=1`
}

export const extractApplyUrl = (html = '') => {
  const match = String(html ?? '').match(
    /(?:href|action|onclick)=["']([^"']*SignInv1\.aspx\?PRFCode=[^"']+?&(?:amp;)?Flag=C&(?:amp;)?DirectApply=1[^"']*)["']/i,
  )

  return toAbsoluteUrl(match?.[1], JOBS_BOARD_URL)
}

export const hasOfficialDetailPageSignal = (html = '', record = {}) => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)
  const title = normalizeField(record?.Position_Name)
  const reqNo = normalizeField(record?.Req_No)
  const applyUrl = buildApplyUrl(record)
  const hasApplyCallToAction =
    /Apply for this job/i.test(text)
    || /Apply Now/i.test(text)
    || /SignInv1\.aspx/i.test(page)

  return Boolean(title)
    && (
      new RegExp(`<title>\\s*${escapeRegExp(title)}\\s*<\\/title>`, 'i').test(page)
      || new RegExp(`>\\s*${escapeRegExp(title)}\\s*<`, 'i').test(page)
    )
    && (!reqNo || new RegExp(`\\b${escapeRegExp(reqNo)}\\b`).test(text))
    && /Job Description/i.test(text)
    && hasApplyCallToAction
    && extractApplyUrl(page) === applyUrl
}

export const mapListingRecordToJob = (record, { scrapedAt = new Date().toISOString() } = {}) => {
  const title = normalizeField(record?.Position_Name)
  const requisitionId = normalizeField(record?.Req_No)
  const sourceUrl = buildDetailUrl(record)
  const applyUrl = buildApplyUrl(record)
  const city = normalizeField(record?.LOCATIONNAME || record?.Field2)

  if (!title || !requisitionId || !sourceUrl || !applyUrl) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeField(record?.FunName) || normalizeField(record?.Field1),
    location: buildLocation(record),
    city,
    country: normalizeField(record?.Country_Name) || 'India',
    sourceUrl,
    applyUrl,
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId,
    employmentType: null,
    workplaceType: null,
    experienceRequired: normalizeField(record?.Experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: normalizeDate(record?.PublishDate),
    closingDate: null,
    jobDescription: buildJobDescription(record),
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: applyUrl,
    scrapedAt,
  }
}

export const createAuxiloScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, maxJobs = 0 } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || getFinalUrl(homepage, HOMEPAGE_URL) !== HOMEPAGE_URL || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Auxilo verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    const jobsBoardEntryUrl = extractJobsBoardEntryUrl(careersPage.html)
    if (
      careersPage.status !== 200
      || getFinalUrl(careersPage, CAREERS_URL) !== CAREERS_URL
      || !hasOfficialCareersSignal(careersPage.html)
      || jobsBoardEntryUrl !== JOBS_BOARD_ENTRY_URL
    ) {
      throw new Error('Auxilo verified careers page no longer matches the known first-party handoff')
    }

    const jobsBoard = await fetchPage(JOBS_BOARD_ENTRY_URL)
    if (
      jobsBoard.status !== 200
      || getFinalUrl(jobsBoard, JOBS_BOARD_ENTRY_URL) !== JOBS_BOARD_URL
      || !hasOfficialJobsBoardSignal(jobsBoard.html)
    ) {
      throw new Error('Auxilo verified jobs board no longer matches the known public Workline surface')
    }

    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: WORKLINE_ORIGIN,
        Referer: JOBS_BOARD_URL,
      },
      body: JSON.stringify(JOBS_API_BODY),
    })

    if (!hasVerifiedJobsPayloadContract(payload)) {
      throw new Error('Auxilo verified jobs api no longer matches the known public response contract')
    }

    const observedRecords = extractListingRecords(payload)
    const records = observedRecords.filter(isIndiaListingRecord)

    const scrapedAt = now()
    const jobs = []

    for (const record of records) {
      const job = mapListingRecordToJob(record, { scrapedAt })
      if (!job) {
        throw new Error('Auxilo verified jobs api returned records that no longer match the expected public job shape')
      }

      const detailPage = await fetchPage(job.sourceUrl)
      if (detailPage.status !== 200 || getFinalUrl(detailPage, job.sourceUrl) !== job.sourceUrl || !hasOfficialDetailPageSignal(detailPage.html, record)) {
        throw new Error('Auxilo verified detail page no longer matches the known public apply surface')
      }

      if (extractApplyUrl(detailPage.html) !== job.applyUrl) {
        throw new Error('Auxilo verified detail page no longer exposes the expected public apply route')
      }

      jobs.push({ ...job, sourceListingComplete: false })
    }

    const selectedJobs = Number.isInteger(maxJobs) && maxJobs > 0 ? jobs.slice(0, maxJobs) : jobs
    // The observed API array has no authoritative total or exhaustion marker.
    // Neither an empty array nor the historical catalog proves a full inventory.
    return attachInventoryEvidence(selectedJobs, {
      status: 'discovery-only',
      surface: JOBS_API_URL,
      firstParty: true,
      listingComplete: false,
      pagesFetched: 4 + jobs.length,
      reportedTotal: null,
      indiaFacetCount: null,
      verifiedAt: now(),
      reason: `observedRecords=${observedRecords.length}; indiaCandidates=${records.length}; validatedDetails=${jobs.length}; returnedJobs=${selectedJobs.length}. Verified official Auxilo-to-Workline handoff and matching detail/apply identities; exhaustive native inventory remains unverified without an authoritative total or current client exhaustion contract.`,
    })
  },
})

export const run = async (options = {}) => createAuxiloScraper().run(options)

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
