import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'relanto'
export const COMPANY = 'Relanto'
export const CAREERS_URL = 'https://www.relanto.ai/careers'
export const EXTERNAL_HANDOFF_URL = 'https://relanto.keka.com/careers/'
export const EXPECTED_IDENTIFIER = '02b7fe40-b031-4feb-9965-e44257ddd8e5'
export const EXPECTED_KEKA_DOMAIN = 'https://relanto.keka.com/careers/'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] || null)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const hasCanonical =
    /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.relanto\.ai\/careers"/i.test(rawHtml)
    || /<link[^>]+href="https:\/\/www\.relanto\.ai\/careers"[^>]+rel="canonical"/i.test(rawHtml)

  return /<title[^>]*>\s*Careers at Relanto\s*<\/title>/i.test(rawHtml)
    && hasCanonical
    && /current job openings at Relanto/i.test(rawHtml)
}

export const extractExternalHandoffUrl = (html) =>
  String(html ?? '').match(/https:\/\/relanto\.keka\.com\/careers\/?/i)?.[0] ?? null

export const hasKekaCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /window\.khConfig/i.test(rawHtml)
    && /href="https:\/\/www\.relanto\.ai\/"/i.test(rawHtml)
    && /id="khembedjobs"/i.test(rawHtml)
    && /Open positions/i.test(normalized)
}

export const extractKekaDocumentPath = (html) =>
  String(html ?? '').match(/fetch\(['"]([^'"]+careerportal\/[^'"]+\.html)['"]\)/i)?.[1] ?? null

export const extractCareerConfig = (html) => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || 'default'

  if (!identifier || !domain) return null

  return { identifier, domain, portalName }
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const buildApplyUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}applyjob/${jobId}`
}

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode ?? '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName ?? ''))) return true
  return /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const mapJob = (job, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)

  if (!location || !jobId || !title) return null

  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const locationLabel = [city, normalizeWhitespace(location.state), 'India']
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: locationLabel || 'India',
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'relanto-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'relanto-json',
  timeoutMs: 15000,
})

export const createRelantoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const officialCareersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(officialCareersHtml)) {
      throw new Error('Relanto verified first-party careers page no longer matches the known public surface')
    }

    const externalHandoffUrl = extractExternalHandoffUrl(officialCareersHtml)
    if (externalHandoffUrl !== EXTERNAL_HANDOFF_URL) {
      throw new Error('Relanto verified first-party careers handoff changed materially')
    }

    const kekaShellHtml = await fetchText(EXTERNAL_HANDOFF_URL)
    const kekaDocumentPath = extractKekaDocumentPath(kekaShellHtml)
    const kekaCareersHtml = kekaDocumentPath
      ? await fetchText(new URL(kekaDocumentPath, EXTERNAL_HANDOFF_URL).toString())
      : kekaShellHtml

    if (!hasKekaCareersSignal(kekaCareersHtml)) {
      throw new Error('Relanto Keka careers shell no longer matches the verified public surface')
    }

    const careerConfig = extractCareerConfig(kekaCareersHtml)
    if (!careerConfig) {
      throw new Error('Relanto Keka careers shell no longer exposes the verified job configuration')
    }

    if (
      careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== 'default'
    ) {
      throw new Error('Relanto verified Keka job surface changed materially')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) {
      throw new Error('Unable to build Relanto active jobs URL')
    }

    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), careerConfig)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createRelantoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
