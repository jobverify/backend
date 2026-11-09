import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'rapteehv'
export const COMPANY = 'RAPTEE HV'
export const CAREERS_URL = 'https://www.rapteehv.com/careers'
export const EXTERNAL_HANDOFF_URL = 'https://raptee.keka.com/careers/'
export const EXPECTED_IDENTIFIER = '3d03878f-6bf4-4fe3-9090-2989304de3b4'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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
  return normalizeWhitespace(match?.[1])
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title[^>]*>(?:Raptee\.HV - India's First Motorcycle with Electric Car DNA \| HV-TEC|Careers at Raptee\.HV \| Join India's High-Voltage EV Startup|EV Careers in India \| Join Raptee\.HV(?:'|&#39;|&rsquo;)?s High-Voltage Electric Vehicle Team|Raptee\.HV \| India(?:'|&#39;|&rsquo;)?s First High-Voltage Electric Motorcycle)<\/title>/i.test(rawHtml)
    && /"name":\s*"Careers",\s*"url":\s*"https:\/\/www\.rapteehv\.com\/careers\/?"/i.test(rawHtml)
    && /https:\/\/raptee\.keka\.com\/careers\/api\/embedjobs\/js\/3d03878f-6bf4-4fe3-9090-2989304de3b4/i.test(rawHtml)
}

export const extractExternalHandoffUrl = (html) => {
  const scriptUrl = String(html ?? '').match(/https:\/\/[^"' ]+\/careers\/api\/embedjobs\/js\/[0-9a-f-]+/i)?.[0]
  const inferredDomain = scriptUrl?.replace(/\/api\/embedjobs\/js\/[0-9a-f-]+$/i, '/')

  return normalizeDomain(inferredDomain) === EXTERNAL_HANDOFF_URL ? EXTERNAL_HANDOFF_URL : null
}

export const extractPortalDocumentUrl = (html) => {
  const pathMatch = String(html ?? '').match(/fetch\(\s*['"]([^'"]+careerportal\/[^'"]+\.html)['"]\s*\)/i)
  const documentPath = normalizeWhitespace(pathMatch?.[1] || null)
  if (!documentPath) return null

  try {
    return new URL(documentPath, EXTERNAL_HANDOFF_URL).toString()
  } catch {
    return null
  }
}

export const hasKekaCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return rawHtml.includes("identifier: '3d03878f-6bf4-4fe3-9090-2989304de3b4'")
    && rawHtml.includes("domain: 'https://raptee.keka.com/careers/'")
    && normalized.includes('Be a part of building something great')
    && normalized.includes('Browse all jobs')
    && normalized.includes('Join the Cult!')
}

export const extractCareerConfig = (html) => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))

  if (!identifier || !domain) return null

  return {
    identifier,
    domain,
    portalName: 'default',
  }
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ domain, jobId }) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const buildApplyUrl = ({ domain, jobId }) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}applyjob/${jobId}`
}

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode || '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName || ''))) return true
  return /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const selectLocation = (locations = []) => {
  const explicitIndia = locations.find(isIndiaLocation)
  return explicitIndia || locations[0] || null
}

const mapJob = (job, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = selectLocation(locations)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)

  if (!jobId || !title) return null

  const city = normalizeWhitespace(location?.city) || normalizeWhitespace(location?.name)
  const state = normalizeWhitespace(location?.state)
  const country = location ? (isIndiaLocation(location) ? 'India' : normalizeWhitespace(location.countryName)) : 'India'
  const locationLabel = [city, state, country]
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId }) || sourceUrl

  if (!sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: locationLabel || country || 'India',
    city,
    country: country || 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map(normalizeWhitespace).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    publicExperienceChecked: true,
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

export const createRapteeHvScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchBrowserText,
    fetchBrowserJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchJson,
      fetchBrowserText,
      fetchBrowserJson,
      userAgent: USER_AGENT,
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 12000,
        ignoreHTTPSErrors: false,
      },
    })

    try {
      const loadVerifiedText = async (url, verifier) => {
        let pageHtml
        try {
          pageHtml = await fetchText(url)
        } catch {
          pageHtml = await browserFallback.fetchTextInBrowser(url)
        }

        if (!verifier(pageHtml)) {
          pageHtml = await browserFallback.fetchTextInBrowser(url)
        }

        return pageHtml
      }

      const officialCareersHtml = await loadVerifiedText(
        CAREERS_URL,
        (html) => hasOfficialCareersSignal(html) && extractExternalHandoffUrl(html) === EXTERNAL_HANDOFF_URL,
      )

      if (!hasOfficialCareersSignal(officialCareersHtml) || extractExternalHandoffUrl(officialCareersHtml) !== EXTERNAL_HANDOFF_URL) {
        throw new Error('RAPTEE HV verified first-party careers handoff changed materially')
      }

      const kekaEntryHtml = await loadVerifiedText(
        EXTERNAL_HANDOFF_URL,
        (html) => Boolean(extractCareerConfig(html) || extractPortalDocumentUrl(html)),
      )
      let kekaCareersHtml = kekaEntryHtml
      let careerConfig = extractCareerConfig(kekaCareersHtml)

      if (!careerConfig) {
        const portalDocumentUrl = extractPortalDocumentUrl(kekaEntryHtml)
        if (!portalDocumentUrl) {
          throw new Error('Unable to resolve RAPTEE HV portal document URL')
        }

        kekaCareersHtml = await loadVerifiedText(portalDocumentUrl, (html) => Boolean(extractCareerConfig(html)))
        careerConfig = extractCareerConfig(kekaCareersHtml)
      }

      if (
        !careerConfig
        || careerConfig.identifier !== EXPECTED_IDENTIFIER
        || careerConfig.domain !== EXTERNAL_HANDOFF_URL
      ) {
        throw new Error('Unable to resolve RAPTEE HV Keka embed configuration')
      }

      const activeJobsUrl = buildActiveJobsUrl(careerConfig)
      if (!activeJobsUrl) {
        throw new Error('Unable to build RAPTEE HV active jobs URL')
      }

      const jobs = extractSearchResults(await browserFallback.fetchJson(activeJobsUrl), careerConfig)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
      const scrapedAt = now()

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createRapteeHvScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
