import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { enrichJobsWithPublicExperience } from '../../scraper-support/utils/publicExperienceEnrichment.js'

import REVOLUT_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = REVOLUT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const POSITION_URL_LOCALE = 'en-IN'
// Revolut's Cloudflare-protected detail pages intermittently fail under
// parallel live detail fetches, so keep the enrichment path serialized.
const DEFAULT_EXPERIENCE_ENRICHMENT_CONCURRENCY = 1
const DEFAULT_NAVIGATION_TIMEOUT_MS = 120000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const slugifyPositionTitle = (value) => normalizeWhitespace(value)
  ?.normalize('NFKD')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-+/g, '-')
  || null

const isIndiaLocation = (location = {}) =>
  /india/i.test(normalizeWhitespace(location.country) || '')
  || /india/i.test(normalizeWhitespace(location.name) || '')

const getIndiaLocations = (locations) => (Array.isArray(locations) ? locations : [])
  .filter((location) => isIndiaLocation(location))

const isRemoteLocation = (location = {}) =>
  /remote/i.test(normalizeWhitespace(location.type) || '')
  || /remote/i.test(normalizeWhitespace(location.name) || '')

const buildLocationLabel = (locations) => unique(
  locations.map((location) => normalizeWhitespace(location.name)),
).join(', ') || null

const getCity = (locations) => {
  const officeLocation = locations.find((location) => !isRemoteLocation(location))
  const city = normalizeWhitespace(officeLocation?.name)

  return city && !/remote/i.test(city) ? city : null
}

const getRemoteStatus = (locations) => {
  const hasRemote = locations.some((location) => isRemoteLocation(location))
  const hasOffice = locations.some((location) => !isRemoteLocation(location))

  if (hasRemote && hasOffice) return 'Hybrid'
  if (hasRemote) return 'Remote'
  return 'On-site'
}

export const hasOfficialCareersSignal = (html) => {
  const source = String(html ?? '')

  return /<title[^>]*>\s*Careers \| Revolut India\s*<\/title>/i.test(source)
    && /\bopen positions\b/i.test(source)
    && (
      /Join the people creating a one-stop shop for financial freedom/i.test(source)
      || /The future of money is here\.\s*Be the one who creates it\./i.test(source)
      || /Search from \d+ open positions/i.test(source)
    )
}

export const hasVerifiedSecurityCheckSignal = (html = '') => {
  const source = String(html ?? '')

  return /<title[^>]*>\s*Just a quick security check \| Revolut\s*<\/title>/i.test(source)
    && /\bsecurity check\b/i.test(source)
    && /revolut/i.test(source)
}

export const extractPositionsPayload = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  try {
    const payload = JSON.parse(match[1])
    return payload?.props?.pageProps?.positions ?? null
  } catch {
    return null
  }
}

const createTimeoutSignal = (timeoutMs) =>
  typeof AbortSignal?.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) return current
    current = current?.cause
  }

  return null
}

const hasHttpStatus = (error, status) =>
  Boolean(findErrorInChain(error, (candidate) => Number(candidate?.status) === status))

const fetchTextAllowingSecurityCheck = async (url, timeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS) => {
  try {
    return await fetchTextWithRetry(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
      label: 'revolut-text',
      timeoutMs,
    })
  } catch (error) {
    if (!hasHttpStatus(error, 403)) {
      throw error
    }

    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
      signal: createTimeoutSignal(timeoutMs),
    })
    const html = await response.text()

    if (response.status === 403 && hasVerifiedSecurityCheckSignal(html)) {
      return html
    }

    if (response.ok) {
      return html
    }

    throw error
  }
}

const defaultFetchText = (url, timeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS) =>
  fetchTextAllowingSecurityCheck(url, timeoutMs)

export const buildPositionDetailUrl = (jobId, title = null) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  const slug = slugifyPositionTitle(title)
  const baseUrl = `https://www.revolut.com/${POSITION_URL_LOCALE}/careers/position/`

  return slug
    ? `${baseUrl}${slug}-${encodeURIComponent(normalizedId)}/`
    : `${baseUrl}${encodeURIComponent(normalizedId)}/`
}

export const buildPositionApplyUrl = (jobId) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  return `https://www.revolut.com/${POSITION_URL_LOCALE}/careers/apply/${encodeURIComponent(normalizedId)}/`
}

export const extractIndiaJobs = (positions) => (Array.isArray(positions) ? positions : [])
  .map((position) => {
    const title = normalizeWhitespace(position?.text)
    const jobId = normalizeWhitespace(position?.id)
    const indiaLocations = getIndiaLocations(position?.locations)

    if (!title || !jobId || indiaLocations.length === 0) {
      return null
    }

    const sourceUrl = buildPositionDetailUrl(jobId, title)
    const applyUrl = buildPositionApplyUrl(jobId)

    if (!sourceUrl || !applyUrl) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(position?.team),
      location: buildLocationLabel(indiaLocations),
      city: getCity(indiaLocations),
      state: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(position?.description),
      remoteStatus: getRemoteStatus(indiaLocations),
    }
  })
  .filter(Boolean)

export const createRevolutScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now: defaultNow = () => new Date().toISOString(),
  experienceEnrichmentConcurrency = DEFAULT_EXPERIENCE_ENRICHMENT_CONCURRENCY,
  navigationTimeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS,
} = {}) => ({
  async run({
    fetchText = (url) => defaultFetchText(url, navigationTimeoutMs),
    fetchPublicJobText = null,
    now = defaultNow,
    } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (hasVerifiedSecurityCheckSignal(careersHtml)) {
      return []
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified official Revolut careers page')
    }

    const positions = extractPositionsPayload(careersHtml)
    if (!Array.isArray(positions)) {
      throw new Error('Revolut careers page no longer exposes the verified positions payload')
    }

    const indiaJobs = extractIndiaJobs(positions)
    const selectedJobs = maxJobs ? indiaJobs.slice(0, maxJobs) : indiaJobs
    const detailTextFetcher = typeof fetchPublicJobText === 'function'
      ? fetchPublicJobText
      : fetchText
    const jobsWithPublicDetails = selectedJobs.length > 0
      ? await enrichJobsWithPublicExperience(selectedJobs, {
          fetchText: detailTextFetcher,
          useBrowserFallback: false,
          concurrency: Math.min(
            experienceEnrichmentConcurrency,
            Math.max(1, selectedJobs.length),
          ),
        })
      : selectedJobs

    return jobsWithPublicDetails.map((job) => ({
      ...job,
      publicExperienceChecked: job.publicExperienceChecked === true,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createRevolutScraper(options).run(options)

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
