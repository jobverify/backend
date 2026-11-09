import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'yubi'
export const COMPANY = 'Yubi'
export const CAREERS_PORTAL_URL = 'https://go-yubi.zohorecruit.in/jobs/Careers'
export const CAREERS_API_URL =
  'https://go-yubi.zohorecruit.in/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22State%22,%22Date_Opened%22,%22Work_Experience%22,%22Industry%22,%22Job_Description%22%5D'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Yubi',
  adapter: 'script',
  modulePath: '../../scraper/yubi/script.js',
  companyCareerPage: CAREERS_PORTAL_URL,
  careersApiUrl: CAREERS_API_URL,
  companyDomain: 'go-yubi.zohorecruit.in',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-public-api-request',
  extractionStrategy: 'verified-public-zoho-portal+public-job-openings-api+exact-yubi-company-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedPublicPostingCount: 95,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that the branded public Yubi Zoho Recruit portal at https://go-yubi.zohorecruit.in/jobs/Careers is live and backed by the public jobs API at https://go-yubi.zohorecruit.in/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22State%22,%22Date_Opened%22,%22Work_Experience%22,%22Industry%22,%22Job_Description%22%5D. The live portal shell links back to https://www.go-yubi.com/careers/, the unlocked published API payload exposed 95 exact-company Yubi openings in India including L1 Support Engineer in Chennai and Voice Platform Operation Engineer in Bangalore, and the live Yubi detail page meta description states that Yubi is formerly known as CredAvenue.',
  dryRunFile: 'yubi/jobs.json',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consult/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const isExactYubiIndiaJob = (record = {}) =>
  normalizeWhitespace(record.Company) === COMPANY
  && /india/i.test(normalizeWhitespace(record.Country) || '')
  && record.Publish !== false
  && record.Is_Locked !== true

const buildLocation = (record = {}) =>
  [record.City, record.State, record.Country]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(', ') || null

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return normalized
  return `${match[3]}-${match[1]}-${match[2]}`
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at Yubi\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/go-yubi\.zohorecruit\.in\/jobs\/Careers["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && /go-yubi\.com\/careers\/?/i.test(page)
}

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isExactYubiIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const location = buildLocation(record)

      if (!title || !jobId || !sourceUrl || !location) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(record.Industry),
        location,
        city: normalizeWhitespace(record.City),
        state: normalizeWhitespace(record.State),
        country: normalizeWhitespace(record.Country),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createYubiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official Yubi careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Yubi public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)
    if (!jobs.length) {
      throw new Error('Yubi public jobs API no longer exposes trusted public Yubi India jobs')
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createYubiScraper().run(options)

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

