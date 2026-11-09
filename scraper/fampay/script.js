import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import FAMPAY_CATALOG from './catalog.js'
import {hasCurrentFamCareers,runCurrentFam} from '../famapp/currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FAMPAY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_PAGE_URL = PROVIDER_METADATA.officialJobsPageUrl
export const CAREERS_BUNDLE_URL = PROVIDER_METADATA.careersBundleUrl
export const JOBS_BUNDLE_URL = PROVIDER_METADATA.jobsBundleUrl
export const LEVER_BOARD_URL = PROVIDER_METADATA.officialLeverBoardUrl
export const LEVER_API_URL = PROVIDER_METADATA.leverApiUrl
export const VERIFIED_INDIA_COUNTRY_CODE = PROVIDER_METADATA.verifiedIndiaCountryCode
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&'),
)?.toLowerCase() || ''

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_JSON_HEADERS,
  label: SOURCE,
})

const extractCity = (location) => {
  const firstSegment = normalizeWhitespace(location)?.split(/\s*,\s*/)[0] || null
  return firstSegment ? (normalizeCity(firstSegment) || firstSegment) : null
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const buildIndiaLocation = (rawLocation) => {
  const city = extractCity(rawLocation)
  if (city) return `${city}, India`

  const normalized = normalizeWhitespace(rawLocation)
  if (normalized && /india/i.test(normalized)) return normalized

  return 'India'
}

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job?.country)?.toUpperCase()
  const locations = [
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]

  return country === VERIFIED_INDIA_COUNTRY_CODE
    || locations.some((location) => /(?:^|[\s,-])india\b/i.test(normalizeWhitespace(location) || ''))
}

const extractJobDescription = (job = {}) => normalizeWhitespace(
  job?.descriptionPlain
    || job?.descriptionBodyPlain
    || job?.openingPlain
    || job?.additionalPlain
    || job?.description
    || job?.descriptionBody
    || job?.opening
    || job?.additional,
)

export const buildPublicJobUrl = (jobId) =>
  `https://jobs.lever.co/fampay/${encodeURIComponent(String(jobId ?? ''))}`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return text.includes('#jointhefam')
    && text.includes('be a part of the team setting the bar for')
    && text.includes('new-world work culture')
    && text.includes('so like, what does fam do?')
    && text.includes('famapp by trio (formerly fampay) focuses on financial inclusion of the next generation')
}

export const hasVerifiedCareersBundleReference = (html = '') =>
  String(html ?? '').includes('/_next/static/chunks/a57fc16ab57e4e2c.js')

export const hasCareersBundleJobsHandoff = (bundle = '') =>
  /buttonText:"View openings",path:"\/?jobs"/i.test(String(bundle ?? ''))
  && /#JoinTheFam/i.test(String(bundle ?? ''))

export const hasOfficialJobsShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /"page"\s*:\s*"\/jobs"/i.test(page)
    && /__NEXT_DATA__/i.test(page)
}

export const hasVerifiedJobsBundleReference = (html = '') =>
  String(html ?? '').includes('/_next/static/chunks/46b0e91d4324e433.js')

export const hasJobsBundleLeverApiSignal = (bundle = '') =>
  /https:\/\/api\.lever\.co\/v0\/postings\/fampay\?group=team&mode=json/i.test(String(bundle ?? ''))

export const hasOfficialLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return (/job openings at fam/i.test(page) || text.includes('job openings at fam'))
    && text.includes('location type')
    && text.includes('location')
    && text.includes('team')
    && text.includes('work type')
    && text.includes('fam home page')
    && /https:\/\/jobs\.lever\.co\/fampay\/[a-z0-9-]+/i.test(page)
}

export const flattenLeverGroups = (groups = []) => {
  if (!Array.isArray(groups)) {
    throw new Error('Fampay grouped Lever payload no longer returns an array')
  }

  return groups.flatMap((group) => {
    if (!Array.isArray(group?.postings)) {
      throw new Error('Fampay grouped Lever payload no longer exposes postings arrays')
    }

    return group.postings
  })
}

export const extractIndiaLeverJobs = (groups = []) =>
  flattenLeverGroups(groups)
    .filter((job) => isIndiaJob(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const city = extractCity(location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl) || buildPublicJobUrl(job?.id)
      const id = normalizeWhitespace(job?.id)

      if (!title || !id || !sourceUrl || !city) {
        throw new Error('Fampay Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location: buildIndiaLocation(location),
        city,
        country: 'India',
        jobId: id,
        requisitionId: id,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: extractJobDescription(job),
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
    .sort((left, right) => String(right.postingDate || '').localeCompare(String(left.postingDate || '')))

export const createFampayScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run(options={}) {
    const {
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
    }=options
    const careersPage = await fetchPage(CAREERS_URL)
    if(careersPage.status===200&&sameUrl(careersPage.url,CAREERS_URL)&&hasCurrentFamCareers(careersPage.html))return runCurrentFam({...options,source:SOURCE,company:COMPANY,now})
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
      || !hasVerifiedCareersBundleReference(careersPage.html)
    ) {
      throw new Error('Fampay verified first-party careers surface changed materially')
    }

    const careersBundle = await fetchPage(CAREERS_BUNDLE_URL)
    if (
      careersBundle.status !== 200
      || !sameUrl(careersBundle.url, CAREERS_BUNDLE_URL)
      || !hasCareersBundleJobsHandoff(careersBundle.html)
    ) {
      throw new Error('Fampay verified careers bundle handoff changed materially')
    }

    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (
      jobsPage.status !== 200
      || !sameUrl(jobsPage.url, JOBS_PAGE_URL)
      || !hasOfficialJobsShellSignal(jobsPage.html)
      || !hasVerifiedJobsBundleReference(jobsPage.html)
    ) {
      throw new Error('Fampay verified first-party jobs shell changed materially')
    }

    const jobsBundle = await fetchPage(JOBS_BUNDLE_URL)
    if (
      jobsBundle.status !== 200
      || !sameUrl(jobsBundle.url, JOBS_BUNDLE_URL)
      || !hasJobsBundleLeverApiSignal(jobsBundle.html)
    ) {
      throw new Error('Fampay verified jobs bundle API handoff changed materially')
    }

    const leverBoardPage = await fetchPage(LEVER_BOARD_URL)
    if (
      leverBoardPage.status !== 200
      || !sameUrl(leverBoardPage.url, LEVER_BOARD_URL)
      || !hasOfficialLeverBoardSignal(leverBoardPage.html)
    ) {
      throw new Error('Fampay verified public Lever board changed materially')
    }

    const scrapedAt = now()

    return extractIndiaLeverJobs(await fetchJson(LEVER_API_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createFampayScraper(options).run(options)

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
