import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_ENTRY_URL = PROVIDER_METADATA.companyCareerPage
export const MICROSITE_URL = PROVIDER_METADATA.careersMicrositeUrl
export const PUBLIC_APPLY_URL = PROVIDER_METADATA.publicApplyUrl
export const COMPANY_LOOKUP_URL = PROVIDER_METADATA.publicCompanyLookupUrl
export const VACANCY_API_URL = PROVIDER_METADATA.vacancyApiUrl
export const PUBLIC_COMPANY_ID = PROVIDER_METADATA.publicCompanyId
export const PUBLIC_GROUP_ID = PROVIDER_METADATA.publicGroupId
export const ENCODED_COMPANY_ID = PROVIDER_METADATA.encodedCompanyId
export const ENCODED_GROUP_ID = PROVIDER_METADATA.encodedGroupId

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#47;/gi, '/')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

  return response.json()
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*AM\/NS India - AM\/NS India\s*<\/title>/i.test(page)
    && /\bAM\/NS India\b/i.test(normalized)
    && (
      /href=["'](?:https:\/\/www\.amns\.in)?\/careers\/?["']/i.test(page)
      || /href=["']https:\/\/ace\.amns\.in\/CANDMICROSITE\/?["']/i.test(page)
    )
}

export const hasOfficialMicrositeSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Candidate Microsite\s*<\/title>/i.test(page)
    && /AdrV\.js/i.test(page)
    && /AdrX\.js/i.test(page)
    && /main-[A-Z0-9]+\.js/i.test(page)
}

export const hasVerifiedCompanyLookupPayload = (payload) =>
  payload?.IsValid === true
  && Array.isArray(payload?.Data)
  && payload.Data[0] === PUBLIC_COMPANY_ID
  && payload.Data[1] === PUBLIC_GROUP_ID

export const buildVacancyRequestBody = () => ({
  CompanyID: ENCODED_COMPANY_ID,
  Flag: 'OP',
  OU_ID: ENCODED_GROUP_ID,
  JOBID: '',
})

export const extractVacancyRecords = (payload) => {
  if (!payload?.IsValid || !Array.isArray(payload?.Data)) {
    return []
  }

  const records = []

  for (const section of payload.Data) {
    if (!Array.isArray(section?.VacancyInformation)) continue
    records.push(...section.VacancyInformation.filter(Boolean))
  }

  return records
}

const buildJobDescription = (record) => {
  const lines = [
    normalizeWhitespace(record?.FUNCTIONAL_AREA)
      ? `Functional area: ${normalizeWhitespace(record?.FUNCTIONAL_AREA)}`
      : null,
    normalizeWhitespace(record?.FUNCTION_DESC)
      ? `Function: ${normalizeWhitespace(record?.FUNCTION_DESC)}`
      : null,
    normalizeWhitespace(record?.FUNCTION_RESPONSIBILITY)
      ? `Responsibility: ${normalizeWhitespace(record?.FUNCTION_RESPONSIBILITY)}`
      : null,
    Number.isFinite(Number(record?.NUMBER_OF_POST))
      ? `Open positions: ${Number(record.NUMBER_OF_POST)}`
      : null,
  ].filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : null
}

export const mapVacancyRecordToJob = (record, { scrapedAt = new Date().toISOString() } = {}) => {
  const title = normalizeWhitespace(record?.FUNCTION_NAME)
  const jobId = normalizeWhitespace(record?.JOB_REQUEST_CODE)

  if (!title || !jobId) {
    return null
  }

  const city = normalizeWhitespace(record?.LOCATION_NAME)
    || normalizeWhitespace(record?.CITY)
    || normalizeWhitespace(record?.['CAND_VACY_lblLoc~D'])
    || null
  const location = city ? `${city}, India` : 'India'

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(record?.FUNCTION_DESC)
      || normalizeWhitespace(record?.FUNCTIONAL_AREA)
      || null,
    location,
    city,
    country: 'India',
    sourceUrl: PUBLIC_APPLY_URL,
    applyUrl: PUBLIC_APPLY_URL,
    jobId,
    requisitionId: jobId,
    employmentType: null,
    workplaceType: null,
    experienceRequired: normalizeWhitespace(
      record?.EXPERIENCE || record?.['CAND_VACY_lblExp~D'],
    ) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: normalizeWhitespace(record?.POSTED_ON) || null,
    closingDate: normalizeWhitespace(record?.APPLY_END_DATE) || null,
    jobDescription: buildJobDescription(record),
    source: SOURCE,
    companyCareerPage: CAREERS_ENTRY_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: PUBLIC_APPLY_URL,
    scrapedAt,
  }
}

export const createArcelorMittalNipponSteelIndiaScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('ArcelorMittal Nippon Steel India verified official homepage no longer matches the known public surface')
    }

    const careersMicrosite = await fetchPage(CAREERS_ENTRY_URL)
    if (getFinalUrl(careersMicrosite, CAREERS_ENTRY_URL) !== MICROSITE_URL) {
      throw new Error('ArcelorMittal Nippon Steel India verified careers handoff no longer redirects to the known first-party microsite')
    }

    if (careersMicrosite.status !== 200 || !hasOfficialMicrositeSignal(careersMicrosite.html)) {
      throw new Error('ArcelorMittal Nippon Steel India verified careers microsite no longer matches the known public shell')
    }

    const companyLookup = await fetchJson(COMPANY_LOOKUP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!hasVerifiedCompanyLookupPayload(companyLookup)) {
      throw new Error('ArcelorMittal Nippon Steel India verified company lookup no longer matches the known public tenant mapping')
    }

    const vacancyPayload = await fetchJson(VACANCY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildVacancyRequestBody()),
    })

    if (!vacancyPayload?.IsValid || !Array.isArray(vacancyPayload?.Data)) {
      throw new Error('ArcelorMittal Nippon Steel India verified vacancy API no longer matches the known public response contract')
    }

    const records = extractVacancyRecords(vacancyPayload)
    if (records.length === 0) {
      return []
    }

    const scrapedAt = now()
    const jobs = records
      .map((record) => mapVacancyRecordToJob(record, { scrapedAt }))
      .filter(Boolean)

    if (jobs.length !== records.length) {
      throw new Error('ArcelorMittal Nippon Steel India verified vacancy API returned records that no longer match the expected public job shape')
    }

    return jobs
  },
})

export const run = async (options = {}) => createArcelorMittalNipponSteelIndiaScraper().run(options)

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
