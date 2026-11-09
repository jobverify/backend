import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SARVAGRAM_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl || 'https://www.sarvagram.com/about-us/'
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.careersPortalUrl
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl

const DETAIL_HOST = PROVIDER_METADATA.careersDetailHost
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
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State || record['State/Province'] || record.State_Province)
  const country = normalizeWhitespace(record.Country)
  const location = [city, state, country].filter(Boolean).join(', ') || null

  return { location, city, state, country }
}

const isPublishedRecord = (record = {}) => record.Publish !== false

const isUnlockedRecord = (record = {}) => record.Is_Locked !== true && record.Locked !== true

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const isSameDetailHost = (value) => {
  try {
    return new URL(value).hostname === DETAIL_HOST
  } catch {
    return false
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*About Us\s*-\s*SarvaGram\s*<\/title>/i.test(page)
    && text.includes('Our Mission: To reduce vulnerability and expand opportunity in every village.')
    && text.includes('As an integrated technology platform dedicated specifically to serving the rural households, we bring access to financial services and commerce to the last mile.')
    && /href=["']https:\/\/sarvagram\.zohorecruit\.in\/jobs\/Careers["']/i.test(page)
    && text.includes('Join our growing team!')
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Career at SarvaGram\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/sarvagram\.zohorecruit\.in\/jobs\/Careers["']/i.test(page)
    && /<input\b(?=[^>]*\bid=["']pageJson["'])[^>]*>/i.test(page)
    && /<input\b(?=[^>]*\bid=["']moduleMeta["'])[^>]*>/i.test(page)
    && /<input\b(?=[^>]*\bid=["']jobs["'])[^>]*>/i.test(page)
}

export const hasVerifiedJobDetailPage = (html = '', job = {}) => {
  const page = String(html ?? '')
  const normalizedHtml = normalizeWhitespace(page)?.toLowerCase() || ''
  const title = normalizeWhitespace(job.title)?.toLowerCase() || ''

  return isSameDetailHost(job.sourceUrl)
    && normalizedHtml.includes('sarvagram')
    && normalizedHtml.includes(title)
    && normalizedHtml.includes('job information')
    && normalizedHtml.includes('about us')
    && normalizedHtml.includes('job description')
    && !/sorry,\s*this job posting is no longer available|joblist has been removed|position filled/i.test(page)
}

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isPublishedRecord(record) && isUnlockedRecord(record) && isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const department = normalizeWhitespace(record.Department || record.Industry)
      const { location, city, state, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department,
        location,
        city,
        state,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience || record.Experience),
        minimumQualification: normalizeWhitespace(record.Minimum_Qualification),
        preferredQualification: normalizeWhitespace(record.Preferred_Qualification),
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: normalizeWhitespace(record.Target_Date_to_Fill),
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

export const createSarvaGramScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const portalPage = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalPage)) {
      throw new Error('SarvaGram verified SarvaGram careers portal no longer matches the trusted first-party surface')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('SarvaGram public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createSarvaGramScraper().run(options)

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
