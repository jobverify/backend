import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_URL = PROVIDER_METADATA.aboutPageUrl
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl

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

const normalizeState = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/tanmil nadu/i.test(normalized)) return 'Tamil Nadu'
  return normalized
}

const normalizeCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^chennai$/i.test(normalized)) return 'Chennai'
  if (/^chennai siruseri$/i.test(normalized)) return 'Chennai Siruseri'
  return normalized
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const extractChennaiLocationFromDescription = (value) => {
  const description = normalizeWhitespace(value)
  if (!description) return null

  const locationMatch = description.match(/Location:\s*([^:]+?)(?:Work Mode:|Employment Type:|About Solverminds|Requirements|Benefits|$)/i)
  const locationText = normalizeWhitespace(locationMatch?.[1])
  if (!locationText) return null

  if (/siruseri/i.test(locationText)) {
    return {
      location: 'Chennai Siruseri, Tamil Nadu, India',
      city: 'Chennai Siruseri',
      state: 'Tamil Nadu',
      country: 'India',
    }
  }

  if (/chennai/i.test(locationText)) {
    return {
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
    }
  }

  return null
}

const resolveLocation = (record = {}) => {
  const city = normalizeCity(record.City)
  const state = normalizeState(record.State)
  const country = normalizeWhitespace(record.Country)

  if (/india/i.test(country || '')) {
    return {
      location: [city, state, 'India'].filter(Boolean).join(', '),
      city,
      state,
      country: 'India',
    }
  }

  return extractChennaiLocationFromDescription(record.Job_Description)
}

const normalizeRemoteStatus = (record = {}) => {
  const description = normalizeWhitespace(record.Job_Description)?.toLowerCase() || ''
  if (/work from office|on-?site/.test(description)) return 'On-site'

  const normalized = normalizeWhitespace(record.Remote_Job)?.toLowerCase()
  if (record.Remote_Job === true || normalized === 'yes' || normalized === 'true') return 'Remote'
  if (record.Remote_Job === false || normalized === 'no' || normalized === 'false') return 'On-site'
  return null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Solverminds(?:\s+|&nbsp;|&#8212;|—|-)+The Maritime Enterprise System\s*<\/title>/i.test(page)
    && /The maritime enterprise system/i.test(page)
}

export const hasOfficialAboutSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*About\s+(?:Â·|·)\s+Solverminds\s*<\/title>/i.test(page)
    && /Build the future of maritime/i.test(page)
    && /See open roles/i.test(page)
    && /https:\/\/careers\.solverminds\.com\/jobs\/Careers/i.test(page)
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at Careers\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/careers\.solverminds\.com\/jobs\/Careers["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = normalizeWhitespace(record.$url)
    const location = resolveLocation(record)

    if (!title || !jobId || !sourceUrl || !location?.location || location.country !== 'India') {
      return null
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location: location.location,
      city: location.city,
      state: location.state,
      country: location.country,
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
      remoteStatus: normalizeRemoteStatus(record),
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createSolvermindsSolutionsAndTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified official Solverminds homepage')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Response is not the verified official Solverminds about page')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official Solverminds careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Solverminds public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) =>
  createSolvermindsSolutionsAndTechnologiesScraper().run(options)

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
