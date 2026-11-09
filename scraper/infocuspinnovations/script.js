import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import INFOCUSPINNOVATIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INFOCUSPINNOVATIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXPECTED_IDENTIFIER = 'd8a117a8-6620-46fb-959e-742de38602e5'
export const EXPECTED_KEKA_DOMAIN = 'https://infocusp.keka.com/careers/'

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

const parseConfigValue = (source, key) => {
  const match = String(source ?? '').match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
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

const pageShowsJobsLoadError = (html) =>
  /Current Openings Error loading jobs/i.test(normalizeWhitespace(html) || '')

export const hasVerifiedKekaForbiddenApiSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Forbidden Access\s*<\/title>/i.test(rawHtml)
    && /forbidden access/i.test(normalized)
    && /(cdn\.keka\.com|keka\.com)/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Infocusp - Leading Technology Solutions\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Infocusp["']/i.test(rawHtml)
    && /Move AI Beyond Experimentation/i.test(normalized)
    && /href=["'](?:https:\/\/www\.infocusp\.com)?\/careers\/openings\/?["']/i.test(rawHtml)
}

const extractCurrentZohoJobs = (html) => {
  const page = String(html ?? '')
  const segments = page.split(/<div\b[^>]*class=["']job-card\b[^"']*["'][^>]*>/i).slice(1)
  const starts = [...page.matchAll(/<div\b[^>]*class=["']job-card\b[^"']*["'][^>]*>/gi)].map(match=>match[0])
  if (!segments.length) return []
  const seen = new Set()
  return segments.map((card,index)=>{
    const title = normalizeWhitespace(starts[index].match(/data-title=["']([^"']+)["']/i)?.[1])
    const locations = normalizeWhitespace(starts[index].match(/data-locations=["']([^"']+)["']/i)?.[1])
    const controlId = card.match(/aria-controls=["']job-details-(\d+)["']/i)?.[1]
    const jobId = card.match(/\bid=["']job-details-(\d+)["']/i)?.[1]
    const applyUrl = normalizeWhitespace(card.match(/href=["'](https:\/\/infocusp\.zohorecruit\.in\/jobs\/Careers\/\d+\/[^"']+)["']/i)?.[1])
    const applyId = applyUrl?.match(/\/Careers\/(\d+)\//)?.[1]
    const description = normalizeWhitespace(card.match(/class=["']job-desc["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const cities = locations?.split(',').map(value=>value.trim()) || []
    if (!title || !jobId || jobId !== controlId || jobId !== applyId || !description || seen.has(jobId) || !cities.length || cities.some(city=>!['Ahmedabad','Pune'].includes(city))) {
      throw new Error('InfoCusp verified Zoho card identity, application or India location changed')
    }
    seen.add(jobId)
    return {title,company:COMPANY,department:null,location:locations+', India',city:locations,country:'India',jobId,requisitionId:jobId,sourceUrl:CAREERS_URL,applyUrl,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:description}
  })
}

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Openings - Infocusp\s*<\/title>/i.test(rawHtml)
    && /rel=["']canonical["'][^>]+href=["']https:\/\/www\.infocusp\.com\/careers\/openings\/["']/i.test(rawHtml)
    && /Current Openings/i.test(normalized)
    && /Explore Open Positions/i.test(normalized)
    && (/jobs-container/i.test(rawHtml) || (/href=["']https:\/\/infocusp\.zohorecruit\.in\/jobs\/Careers\/?["']/i.test(rawHtml) && extractCurrentZohoJobs(rawHtml).length > 0))
}

export const extractCareersBundlePath = (html) =>
  String(html ?? '').match(/<script[^>]+src=["']([^"']*CurrentOpeningsList[^"']+\.js(?:\?[^"']*)?)["']/i)?.[1]
  ?? null

export const extractCareerConfig = (bundleJs) => {
  const identifier = parseConfigValue(bundleJs, 'identifier')
  const domain = normalizeDomain(parseConfigValue(bundleJs, 'domain'))
  const portalName = parseConfigValue(bundleJs, 'portalName') || 'default'

  if (!identifier || !domain) return null

  return { identifier, domain, portalName }
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const mapJob = (job, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)

  if (!location || !jobId || !title) return null

  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)
  const locationLabel = [city, state, 'India']
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
  const sourceUrl = buildJobDetailUrl({ domain, jobId })

  if (!sourceUrl) return null

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
    applyUrl: sourceUrl,
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

export const extractServerRenderedJobs = (html = '') => {
  const page = String(html ?? '')
  if (/aria-controls=["']job-details-\d+["']/i.test(page)) return extractCurrentZohoJobs(page)
  const jobs = []
  const seen = new Set()
  const cards = page.matchAll(/<div class=["']job-card\b[\s\S]*?(?=<div class=["']job-card\b|<\/section>|$)/gi)

  for (const match of cards) {
    const card = match[0]
    const jobId = card.match(/data-job-id=["']([^"']+)["']/i)?.[1]
    const title = normalizeWhitespace(card.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
    const locations = normalizeWhitespace(card.match(/data-locations=["']([^"']+)["']/i)?.[1])
    const applicationEmail = card.match(/href=["']mailto:careers@infocusp\.com[^"']*["']/i)?.[0]

    if (!jobId || !title || !locations || !applicationEmail || seen.has(jobId)) continue
    seen.add(jobId)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${locations}, India`,
      city: locations,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      // Applications are role-specific mailto links embedded on the verified careers page.
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(card),
    })
  }

  return jobs
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

export const createInfoCuspInnovationsScraper = ({
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
      const homepageHtml = await browserFallback.fetchText(HOMEPAGE_URL)
      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('InfoCusp Innovations verified homepage changed materially')
      }

      const careersHtml = await browserFallback.fetchText(CAREERS_URL)
      if (!hasVerifiedCareersPageSignal(careersHtml)) {
        throw new Error('InfoCusp Innovations verified careers page changed materially')
      }

      const renderedJobs = extractServerRenderedJobs(careersHtml)
      if (renderedJobs.length > 0) {
        const selectedJobs = maxJobs ? renderedJobs.slice(0, maxJobs) : renderedJobs
        const scrapedAt = now()

        return selectedJobs.map((job) => ({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt,
        }))
      }

      const bundlePath = extractCareersBundlePath(careersHtml)
      if (!bundlePath) {
        throw new Error('InfoCusp Innovations careers bundle changed materially')
      }

      const bundleUrl = new URL(bundlePath, HOMEPAGE_URL).toString()
      const bundleJs = await browserFallback.fetchText(bundleUrl)
      const careerConfig = extractCareerConfig(bundleJs)

      if (
        !careerConfig
        || careerConfig.identifier !== EXPECTED_IDENTIFIER
        || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
        || careerConfig.portalName !== 'default'
      ) {
        throw new Error('InfoCusp Innovations verified Keka configuration changed materially')
      }

      const activeJobsUrl = buildActiveJobsUrl(careerConfig)
      if (!activeJobsUrl) {
        throw new Error('Unable to build InfoCusp Innovations active jobs URL')
      }

      let payload
      try {
        payload = await browserFallback.fetchJson(activeJobsUrl)
      } catch (error) {
        try {
          const blockedJobsHtml = await browserFallback.fetchTextInBrowser(activeJobsUrl)
          if (hasVerifiedKekaForbiddenApiSignal(blockedJobsHtml)) {
            return []
          }
        } catch {}

        if (typeof fetchBrowserText === 'function') {
          const renderedCareersHtml = await fetchBrowserText(CAREERS_URL)
          if (pageShowsJobsLoadError(renderedCareersHtml)) {
            return []
          }
        }

        throw error
      }

      const jobs = extractSearchResults(payload, careerConfig)
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

export const run = async (options = {}) => createInfoCuspInnovationsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
