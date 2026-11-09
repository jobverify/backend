import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INSTASAFE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = INSTASAFE_CATALOG.source
export const COMPANY = INSTASAFE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = INSTASAFE_CATALOG.officialBrandName
export const VERIFIED_ON = INSTASAFE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = INSTASAFE_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = INSTASAFE_CATALOG
export const HOMEPAGE_URL = INSTASAFE_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = INSTASAFE_CATALOG.careersPageUrl
export const CAREERS_PORTAL_URL = INSTASAFE_CATALOG.careersPortalUrl
export const CAREERS_API_URL = INSTASAFE_CATALOG.careersApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LISTING_COPY_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bour openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bopen roles\b/i,
  /\bavailable positions\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bsee jobs\b/i,
  /\bapply now\b/i,
  /\bwe(?:'|&rsquo;|&#8217;)?re hiring\b/i,
]

const TRUSTED_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /workdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /darwinbox/i,
  /zohorecruit\.com/i,
  /zohorecruit\.in/i,
  /teamtailor\.com/i,
  /keka\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
  /^\/work-with-us(?:\/|$)/i,
  /^\/hiring(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const normalizeText = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/g, '')
  return normalized || '/'
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_PAGE_URL) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url|data-href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(rawValue, pageUrl))
    } catch {
      // Ignore malformed URLs and keep the sentinel fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const hasLegacyCareersCopy =
    text.includes('Grow with InstaSafe')
    && text.includes('Working at InstaSafe is more than just a Job.')
  const hasCurrentServerRenderedCopy =
    text.includes('See open roles')
    && text.includes('Our Openings')
    && text.includes('Loading open roles.')

  return /<title>\s*Instasafe Careers\s*\|\s*Instasafe Jobs\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/(?:www\.)?instasafe\.com\/careers\/["']/i.test(page)
    && text.includes('Book a demo')
    && text.includes('Read the docs')
    && text.includes('Contact support')
    && (hasLegacyCareersCopy || hasCurrentServerRenderedCopy)
}

const hasInputWithId = (html, id) => new RegExp(
  `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`,
  'i',
).test(String(html ?? ''))

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at Instasafe Technologies Pvt Ltd\s*<\/title>/i.test(page)
    && /https:\/\/instasafe\.zohorecruit\.com\/jobs\/Careers/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

export const detectPublicJobsSurface = (html = '', careersUrl = CAREERS_PAGE_URL) => {
  if (hasJobPostingMarkup(html)) return 'JobPosting markup'

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsUrl = linkedUrls.find((url) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )
  if (atsUrl) return atsUrl.toString()

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })
  if (sameOriginJobUrl) return sameOriginJobUrl.toString()

  const text = normalizeText(html)
  return LISTING_COPY_PATTERNS.some((pattern) => pattern.test(text)) ? 'listing copy' : null
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 1,
    label: SOURCE,
    timeoutMs: 15000,
  })

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
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

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const getLocation = (record = {}) => [record.City, record.State, record.Country]
  .map(normalizeWhitespace)
  .filter(Boolean)
  .join(', ') || null

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter(isIndiaJob)
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const city = normalizeWhitespace(record.City)
    const state = normalizeWhitespace(record.State)
    const country = normalizeWhitespace(record.Country)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = normalizeWhitespace(record.$url)
    const location = getLocation(record)

    if (!title || !country || !jobId || !sourceUrl || !location) return null

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
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: String(record.Required_Skills || '')
        .split(',')
        .map(normalizeWhitespace)
        .filter(Boolean),
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
    }
  })
  .filter(Boolean)

export const isVerifiedUnavailableCareersSurface = (error) =>
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createInstaSafeScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    let careersPageHtml = null

    try {
      careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    } catch (error) {
      if (isVerifiedUnavailableCareersSurface(error)) {
        return []
      }

      throw error
    }

    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official InstaSafe careers page')
    }

    const publicJobsSurface = detectPublicJobsSurface(careersPageHtml)
    if (publicJobsSurface !== CAREERS_PORTAL_URL) {
      const details = publicJobsSurface || 'missing verified careers portal handoff'
      throw new Error(`InstaSafe public jobs surface changed materially: ${details}`)
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official InstaSafe careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('InstaSafe public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)
    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      companyCareerPage: CAREERS_PAGE_URL,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createInstaSafeScraper().run(options)

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
