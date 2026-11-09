import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { AMAGI_MEDIA_LABS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMAGI_MEDIA_LABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const LISTING_API_URL = PROVIDER_METADATA.listingApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

const formatEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null

  const mapped = {
    'full-time': 'Full-time',
    fulltime: 'Full-time',
    contract: 'Contract',
    intern: 'Internship',
  }

  return mapped[normalized] || normalized[0].toUpperCase() + normalized.slice(1)
}

const formatExperienceRange = (minYears, maxYears) => {
  const min = Number(minYears)
  const max = Number(maxYears)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return `${min}-${max} years`
}

const buildMynextHireLink = (baseUrl, reqId, pageType) => {
  const encodedContext = Buffer
    .from(JSON.stringify({
      pageType,
      cvSource: 'careers',
      reqId: Number.parseInt(String(reqId), 10),
      requester: {
        id: '',
        code: '',
        name: '',
      },
      page: 'careers',
      bufilter: -1,
      customFields: {},
    }), 'utf8')
    .toString('base64')

  return `${baseUrl}?src${encodeURIComponent('=')}careers${encodeURIComponent('&')}p${encodeURIComponent('=')}${encodedContext}`
}

const isIndiaRecord = (record = {}) => {
  const locationGroup = Array.isArray(record.locationGroup) ? record.locationGroup.join(' ') : ''
  return /\bindia\b/i.test(locationGroup)
    || /\bindia\b/i.test(record.location || '')
    || /\bindia\b/i.test(record.locationAddress || '')
}

const formatLocation = (record = {}) => {
  const city = normalizeWhitespace(record.location)
  const country = normalizeWhitespace(Array.isArray(record.locationGroup) ? record.locationGroup[0] : null)

  if (!city && !country) return { location: null, city: null }
  if (city && country && !new RegExp(`\\b${country}\\b`, 'i').test(city)) {
    return { location: `${city}, ${country}`, city }
  }
  return {
    location: city || country,
    city: city && !/^\s*india\s*$/i.test(city) ? city : null,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes('https://amagi.mynexthire.com/employer/ui/js/jobboard/careers-integration.js')
    && /mnh_ci_onreadystatechange\(["']careers["'],\s*["']amagi["']\)/i.test(page)
    && /<iframe[^>]*id=["']mnhembedded["']/i.test(page)
}

export const buildJobUrl = (reqId) => buildMynextHireLink(JOBS_BOARD_URL, reqId, 'jd')
export const buildApplyUrl = (reqId) => buildMynextHireLink(`${JOBS_BOARD_URL}/apply`, reqId, 'application')

export const extractJobs = (payload = {}) => {
  const records = Array.isArray(payload.reqDetailsBOList) ? payload.reqDetailsBOList : []

  return records
    .filter((record) => isIndiaRecord(record))
    .map((record) => {
      const reqId = normalizeWhitespace(record.reqId)
      const title = normalizeWhitespace(record.reqTitle)
      const { location, city } = formatLocation(record)

      if (!reqId || !title || !location) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(record.buName),
        location,
        city,
        country: 'India',
        jobId: reqId,
        requisitionId: reqId,
        sourceUrl: buildJobUrl(reqId),
        applyUrl: buildApplyUrl(reqId),
        employmentType: formatEmploymentType(record.employmentType),
        experienceRequired: formatExperienceRange(record.expMin, record.expMax),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.approvedOn),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.jdDisplay),
        remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)
}

export const createAmagiMediaLabsScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Amagi careers shell no longer matches the trusted first-party surface')
    }

    const payload = await fetchJson(LISTING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'careers',
        code: '',
        filterByBuId: -1,
      }),
    })

    const jobs = extractJobs(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createAmagiMediaLabsScraper().run(options)

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
