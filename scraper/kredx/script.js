import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KREDX_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KREDX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SMARTRECRUITERS_BOARD_URL = PROVIDER_METADATA.smartRecruitersBoardUrl
export const SMARTRECRUITERS_LISTING_API_URL = PROVIDER_METADATA.smartRecruitersListingApiUrl
export const SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE =
  PROVIDER_METADATA.smartRecruitersDetailApiUrlTemplate
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_FIRST_PARTY_TITLES = [
  'Manager / Senior Manager - Supplier Acquisition',
  'Company Secretary',
  'Manager / Senior Manager – Mid & Large Corporate Acquisition',
  'Product Manager',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeComparable = (value) =>
  normalizeWhitespace(value)
    .replace(/[–—]/g, '-')
    .toLowerCase()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

const createApiProvider = () => ({
  source: SOURCE,
  companyName: COMPANY_NAME,
  companyCareerPage: CAREERS_URL,
  countryFilter: 'India',
  config: {
    request: {
      method: 'GET',
      query: {
        limit: '100',
        country: 'in',
      },
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 100,
      offsetParam: 'offset',
      limitParam: 'limit',
      resultsPath: 'content',
      totalCountPath: 'totalFound',
    },
    mapping: {
      title: 'name',
      location: 'location.fullLocation',
      jobId: 'id',
      requisitionId: 'refNumber',
      sourceUrl: 'postingUrl',
      applyUrl: 'applyUrl',
      department: 'department.label',
      employmentType: 'typeOfEmployment.label',
      experienceLevel: 'experienceLevel.label',
      postingDate: 'releasedDate',
    },
    detail: {
      enabled: true,
      urlTemplate: SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE,
      method: 'GET',
      mapping: {
        jobDescription: 'jobAd.sections.jobDescription.text',
        minimumQualification: 'jobAd.sections.qualifications.text',
        preferredQualification: 'jobAd.sections.additionalInformation.text',
      },
    },
    resultFilter: {
      include: [
        {
          field: 'location',
          pattern: '\\bIndia\\b',
        },
      ],
    },
    discovery: {
      listingApiUrl: SMARTRECRUITERS_LISTING_API_URL,
    },
  },
})

export const extractVisibleFirstPartyJobTitles = (html = '') => {
  const page = normalizeComparable(html)

  return VERIFIED_FIRST_PARTY_TITLES.filter((title) => page.includes(normalizeComparable(title)))
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = normalizeWhitespace(html)
  const visibleTitles = extractVisibleFirstPartyJobTitles(page)

  return /join our team/i.test(page)
    && /current openings/i.test(page)
    && /join us/i.test(page)
    && visibleTitles.length >= 3
}

export const hasVerifiedSmartRecruitersBoardSignal = (html = '') => {
  const page = normalizeWhitespace(html)

  return /Careers at Kredx/i.test(page)
    && /Jobs at Kredx/i.test(page)
    && /\bIndia\b/i.test(page)
    && /(Product Manager|Company Secretary)/i.test(page)
}

const getFirstPartyApiOverlap = (firstPartyTitles, jobs = []) => {
  const visibleTitles = new Set(firstPartyTitles.map((title) => normalizeComparable(title)))

  return jobs.filter((job) => visibleTitles.has(normalizeComparable(job?.title)))
}

export const createKredXScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('KredX official careers surface changed and no longer matches the verified first-party page')
    }

    const visibleFirstPartyTitles = extractVisibleFirstPartyJobTitles(careersHtml)

    const boardHtml = await fetchText(SMARTRECRUITERS_BOARD_URL)
    if (!hasVerifiedSmartRecruitersBoardSignal(boardHtml)) {
      throw new Error('KredX verified SmartRecruiters board no longer matches the known public surface')
    }

    const jobs = await runApiPortalScraper({
      provider: createApiProvider(),
      fetchJson,
    })

    if (getFirstPartyApiOverlap(visibleFirstPartyTitles, jobs).length === 0) {
      throw new Error('KredX no overlap between first-party openings and SmartRecruiters jobs')
    }

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createKredXScraper(options).run(options)

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
