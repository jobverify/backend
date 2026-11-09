import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const KEKA_CAREERS_URL = PROVIDER_METADATA.externalHandoffUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized?.includes('Find Job Openings')
    && normalized?.includes('Join Us and work with friends for a lifetime')
    && extractKekaHandoffUrl(html) === KEKA_CAREERS_URL
}

export const extractKekaHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/aurigait\.keka\.com\/careers\/?/i)
  return match?.[0] ? match[0].replace(/\/$/, '') : null
}

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || 'default'

  if (!identifier || !domain) return null

  return { identifier, domain, portalName }
}

export const extractBootstrapDocumentUrl = (html = '', pageUrl = KEKA_CAREERS_URL) => {
  const relativeUrl = String(html ?? '').match(/fetch\(\s*['"]([^'"]+careerportal\/[^'"]+\.html)['"]\s*\)/i)?.[1]
  if (!relativeUrl) return null

  try {
    return new URL(relativeUrl, pageUrl).toString()
  } catch {
    return null
  }
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ domain, jobId } = {}) => `${normalizeDomain(domain)}jobdetails/${jobId}`
const buildApplyUrl = ({ domain, jobId } = {}) => `${normalizeDomain(domain)}applyjob/${jobId}`

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode ?? '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName ?? ''))) return true
  return /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
}

const mapJob = (job = {}, { domain } = {}) => {
  const locations = Array.isArray(job.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job.id)
  const title = normalizeWhitespace(job.title)

  if (!location || !jobId || !title) return null

  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: [city, normalizeWhitespace(location.state), 'India'].filter(Boolean).join(', '),
    city,
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber),
    sourceUrl: buildJobDetailUrl({ domain, jobId }),
    applyUrl: buildApplyUrl({ domain, jobId }),
    employmentType: job.jobType === 2 || job.jobType === '2' ? 'Full Time' : null,
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : []).map((job) => mapJob(job, { domain })).filter(Boolean)

export const createAurigaItConsultingPrivateLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Auriga careers page changed materially')
    }

    const kekaShellHtml = await fetchText(KEKA_CAREERS_URL)
    const bootstrapDocumentUrl = extractBootstrapDocumentUrl(kekaShellHtml)
    const kekaResolvedHtml = bootstrapDocumentUrl ? await fetchText(bootstrapDocumentUrl) : kekaShellHtml
    const careerConfig = extractCareerConfig(kekaShellHtml) || extractCareerConfig(kekaResolvedHtml)
    if (!careerConfig) {
      throw new Error('Unable to resolve Auriga Keka embed configuration')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), { domain: careerConfig.domain })

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAurigaItConsultingPrivateLimitedScraper().run(options)

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
