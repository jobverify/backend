import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'isocrates'
export const COMPANY = 'iSOCRATES'
export const HOMEPAGE_URL = 'https://isocrates.com/'
export const CAREER_PAGE_URL = 'https://isocrates.com/careers/'
export const EXPECTED_IDENTIFIER = '53772be4-e756-4beb-b9d6-91966b560812'
export const EXPECTED_KEKA_DOMAIN = 'https://isocrates.keka.com/careers/'
export const CURRENT_KEKA_DOMAIN = 'https://madtechai.keka.com/careers/'
const VERIFIED_KEKA_DOMAINS = [EXPECTED_KEKA_DOMAIN, CURRENT_KEKA_DOMAIN]

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREER_PAGE_URL,
  companyDomain: 'isocrates.com',
  adapter: 'script',
  atsPlatform: 'keka-embed-api',
  modulePath: '../../scraper/isocrates/script.js',
  dryRunFile: 'isocrates/jobs.json',
}

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
  return normalizeWhitespace(match?.[1] ?? null)
}

export const extractEmbeddedCareersDocumentPath = (html = '') =>
  String(html ?? '').match(/fetch\(['"]([^'"]+careerportal\/[^'"]+\.html)['"]\)/i)?.[1] ?? null

export const extractDirectKekaBoardUrl = (html) => {
  const match = String(html ?? '').match(/https:\/\/(isocrates|madtechai)\.keka\.com\/careers(?:\/|(?=["'\s?#<]|$))/i)
  return match ? `https://${match[1].toLowerCase()}.keka.com/careers/` : null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title[^>]*>\s*Global Leader in MADTECH Resource Planning and Execution(?:™|&#x2122;)?\s*<\/title>/i.test(rawHtml)
    && /MADTECH \(MarTech, AdTech [&] DataTech\) is complex, expensive, time-consuming, and hard to staff\./i.test(normalized)
    && /Picking the right business partner is crucial\./i.test(normalized)
    && /https:\/\/isocrates\.com\/careers\/?/i.test(rawHtml)
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const hasDirectKekaBoardHandoff = VERIFIED_KEKA_DOMAINS.includes(extractDirectKekaBoardUrl(rawHtml))
  const hasLegacyKekaEmbed =
    /window\.khConfig\s*=\s*\{/i.test(rawHtml)
    && /api\/embedjobs\/js\//i.test(rawHtml)
    && /khembedjobs/i.test(rawHtml)

  return /<title[^>]*>\s*Careers\s*(?:\||&#124;)\s*iSOCRATES\s*<\/title>/i.test(rawHtml)
    && (hasLegacyKekaEmbed || hasDirectKekaBoardHandoff)
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
    remoteStatus: /remote/i.test(locationLabel) ? 'Remote' : 'On-site',
    compensation: normalizeWhitespace(job.salaryRangeFormat),
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
  label: 'isocrates-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'isocrates-json',
  timeoutMs: 15000,
})

export const createIsocratesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchBrowserText,
    fetchBrowserJson,
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

      const homepageHtml = await loadVerifiedText(HOMEPAGE_URL, hasOfficialHomepageSignal)
      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('iSOCRATES verified official homepage no longer matches the known public surface')
      }

      const careersHtml = await loadVerifiedText(CAREER_PAGE_URL, hasOfficialCareersPageSignal)
      if (!hasOfficialCareersPageSignal(careersHtml)) {
        throw new Error('iSOCRATES verified careers page no longer matches the known public Keka handoff')
      }

      let careerConfig = extractCareerConfig(careersHtml)
      if (!careerConfig) {
        const kekaBoardUrl = extractDirectKekaBoardUrl(careersHtml)
        if (!kekaBoardUrl) {
          throw new Error('iSOCRATES careers page no longer exposes the verified Keka configuration')
        }

        let kekaBoardHtml
        try {
          kekaBoardHtml = await fetchText(kekaBoardUrl)
        } catch {
          kekaBoardHtml = await browserFallback.fetchTextInBrowser(kekaBoardUrl)
        }

        careerConfig = extractCareerConfig(kekaBoardHtml)
        let embeddedDocumentPath = extractEmbeddedCareersDocumentPath(kekaBoardHtml)

        if (!careerConfig && !embeddedDocumentPath) {
          kekaBoardHtml = await browserFallback.fetchTextInBrowser(kekaBoardUrl)
          careerConfig = extractCareerConfig(kekaBoardHtml)
          embeddedDocumentPath = extractEmbeddedCareersDocumentPath(kekaBoardHtml)
        }

        if (!careerConfig && embeddedDocumentPath) {
          const embeddedDocumentUrl = new URL(embeddedDocumentPath, kekaBoardUrl).toString()
          let embeddedCareersHtml

          try {
            embeddedCareersHtml = await fetchText(embeddedDocumentUrl)
          } catch {
            embeddedCareersHtml = await browserFallback.fetchTextInBrowser(embeddedDocumentUrl)
          }

          careerConfig = extractCareerConfig(embeddedCareersHtml)
          if (!careerConfig) {
            embeddedCareersHtml = await browserFallback.fetchTextInBrowser(embeddedDocumentUrl)
            careerConfig = extractCareerConfig(embeddedCareersHtml)
          }
        }
      }

      if (!careerConfig) {
        throw new Error('iSOCRATES careers page no longer exposes the verified Keka configuration')
      }

      if (careerConfig.identifier !== EXPECTED_IDENTIFIER || !VERIFIED_KEKA_DOMAINS.includes(careerConfig.domain)) {
        throw new Error('iSOCRATES verified Keka job surface changed materially')
      }

      const activeJobsUrl = buildActiveJobsUrl(careerConfig)
      if (!activeJobsUrl) {
        throw new Error('Unable to build iSOCRATES active jobs URL')
      }

      const jobs = extractSearchResults(await browserFallback.fetchJson(activeJobsUrl), careerConfig)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async () => createIsocratesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}

