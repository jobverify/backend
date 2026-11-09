import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INTERRA_INFORMATION_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_POSITIONS_URL = PROVIDER_METADATA.openPositionsPageUrl
export const KEKA_CAREERS_URL = PROVIDER_METADATA.kekaCareersUrl
export const EXPECTED_IDENTIFIER = 'ff171441-bd55-480d-be5e-589b516ed6aa'
export const EXPECTED_KEKA_DOMAIN = 'https://interrait.keka.com/careers/'
export const EXPECTED_PORTAL_SLUG = 'default'
export const EXPECTED_PORTAL_DOMAIN = 'interrait.keka.com'
export const EXPECTED_PORTAL_NAME = 'Ferfier Technologies'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&#038;/gi, "'")
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

const isTransientPageFetchError = (error) => /fetch failed|timed out|timeout|could not connect|unable to connect|err_connection_timed_out|econnreset|enotfound|socket hang up/i
  .test(String(error?.message ?? error ?? ''))

const unique = (values = []) => [...new Set(values)]

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*(?:Careers at Ferfier Technologies\s*\|\s*Shape the Future with Innovation|Careers at InterraIT\s*\|\s*Jobs in AI, Cloud (?:&amp;|&) Cybersecurity)\s*<\/title>/i.test(page)
    && normalized?.includes('Join Our Team and Shape the Future')
    && normalized?.includes('Explore Open Positions')
    && /href=["'][^"']*\/explore-open-positions\/["']/i.test(page)
}

export const hasOpenPositionsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Explore Open Positions\s*-\s*InterraIT/i.test(page)
    && normalized?.includes('Join Our Team')
    && new RegExp(EXPECTED_IDENTIFIER, 'i').test(page)
    && new RegExp(EXPECTED_KEKA_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
}

export const extractCareerConfig = (html = '') => {
  const page = String(html ?? '')
  const configBlock = page.match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1] ?? ''
  const domain = normalizeDomain(
    parseQuotedConfigValue(configBlock, 'domain')
    || page.match(/https:\/\/interrait\.keka\.com\/careers\/?/i)?.[0]
    || null,
  )
  const identifier = normalizeWhitespace(
    parseQuotedConfigValue(configBlock, 'identifier')
    || page.match(/api\/embedjobs\/js\/([0-9a-f-]+)/i)?.[1]
    || null,
  )
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || EXPECTED_PORTAL_SLUG

  if (!domain || !identifier) return null

  return {
    identifier,
    domain,
    portalName,
  }
}

export const buildCareerPortalInfoUrl = ({ domain, portalName = EXPECTED_PORTAL_SLUG } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return `${normalizedDomain}api/organization/${portalName}/careerportalinfo`
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = EXPECTED_PORTAL_SLUG } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildPinnedCareerConfig = () => ({
  identifier: EXPECTED_IDENTIFIER,
  domain: KEKA_CAREERS_URL,
  portalName: EXPECTED_PORTAL_SLUG,
})

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

export const hasExpectedPortalIdentity = (payload = {}) => {
  const normalizedName = normalizeWhitespace(payload.name)
  const normalizedShortName = normalizeWhitespace(payload.shortName)
  const normalizedPortalDomain = String(payload.careersPortalDomain ?? '').trim().toLowerCase()

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
    && normalizedPortalDomain === EXPECTED_PORTAL_DOMAIN
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

const toEmploymentType = (jobType) => {
  if (jobType === 2 || jobType === '2') return 'Full Time'
  if (jobType === 1 || jobType === '1') return 'Part Time'
  return null
}

const normalizeLocationLabel = (location = {}) => {
  if (!location) return null

  const city = normalizeWhitespace(location.city)
  if (city && city !== '.') return city

  const name = normalizeWhitespace(location.name)
  if (name && name !== '.') return name

  const state = normalizeWhitespace(location.state)
  return state && state !== '.' ? state : null
}

const formatLocation = (locations = []) => {
  const labels = unique(locations.map((location) => normalizeLocationLabel(location)).filter(Boolean))
  return labels.length > 0 ? [...labels, 'India'].join(', ') : 'India'
}

const mapJob = (job = {}, { domain } = {}) => {
  const indiaLocations = (Array.isArray(job.jobLocations) ? job.jobLocations : []).filter(isIndiaLocation)
  const primaryLocation = indiaLocations.find((location) => !/remote/i.test(normalizeLocationLabel(location) ?? ''))
    || indiaLocations[0]
    || null
  const jobId = normalizeWhitespace(job.id)
  const title = normalizeWhitespace(job.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })
  const city = normalizeLocationLabel(primaryLocation)
  const state = normalizeWhitespace(primaryLocation?.state)

  if (!indiaLocations.length || !jobId || !title || !sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: formatLocation(indiaLocations),
    city,
    state,
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
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInterraInformationTechnologiesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: runNow = now,
  } = {}) {
    let careerConfig = null

    try {
      const careersHtml = await fetchText(CAREERS_URL)
      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Interra Information Technologies verified careers shell no longer matches the pinned first-party surface')
      }

      const openPositionsHtml = await fetchText(OPEN_POSITIONS_URL)
      if (!hasOpenPositionsSignal(openPositionsHtml)) {
        throw new Error('Interra Information Technologies verified open-positions handoff no longer matches the live first-party Keka surface')
      }

      careerConfig = extractCareerConfig(openPositionsHtml)
      if (
        !careerConfig
        || careerConfig.identifier !== EXPECTED_IDENTIFIER
        || careerConfig.domain !== KEKA_CAREERS_URL
        || careerConfig.portalName !== EXPECTED_PORTAL_SLUG
      ) {
        throw new Error('Interra Information Technologies verified Keka handoff changed materially')
      }
    } catch (error) {
      if (!isTransientPageFetchError(error)) {
        throw error
      }
      careerConfig = buildPinnedCareerConfig()
    }

    const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!careerPortalInfoUrl || !activeJobsUrl) {
      throw new Error('Unable to build Interra Information Technologies Keka endpoints')
    }

    const portalInfo = await fetchJson(careerPortalInfoUrl)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('Interra Information Technologies verified Keka surface no longer matches the exact company identity')
    }

    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), careerConfig)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: runNow(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createInterraInformationTechnologiesScraper().run(options)

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
