import path from 'node:path'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { resolvePublishedMainClient, parsePublishedAnonymousBootstrap, assertPublishedApiBase } from './publicBootstrap.js'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { enrichJobsWithPublicExperience } from '../../scraper-support/utils/publicExperienceEnrichment.js'

import { RESERVE_BANK_INFORMATION_TECHNOLOGY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RESERVE_BANK_INFORMATION_TECHNOLOGY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_LOGIN_API_URL = 'https://rebit.org.in/web/api/auth/login'
export const CURRENT_OPENINGS_API_URL = 'https://rebit.org.in/web/api/current-openings'
export const CAREERS_PORTAL_BASE_URL = PROVIDER_METADATA.careersPortalBaseUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_EXPERIENCE_ENRICHMENT_CONCURRENCY = 4
const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const normalizeWhitespace = (value = '') => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }


  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  if (/india$/i.test(normalized) && parts.length >= 3) {
    const [city, state] = parts
    return {
      location: normalized,
      city,
      state,
      country: 'India',
    }
  }

  const explicitIndia = /\bIndia$/i.test(normalized)
  const namedIndiaCities = parts.every(part => {
    const key = part.toLowerCase()
    const city = Object.hasOwn(CANONICAL_CITIES, key) ? CANONICAL_CITIES[key] : null
    return typeof city === 'string' && !['None', 'Remote'].includes(city)
  })
  if (!explicitIndia && !namedIndiaCities) {
    const error = new Error('ReBIT incomplete country scope: unverified location ' + normalized)
    error.softFailure = true
    error.failureKind = 'incomplete_location_scope'
    error.abortRetries = true
    throw error
  }

  if (parts.length > 1) {
    return {
      location: normalized,
      city: null,
      state: null,
      country: 'India',
    }
  }

  return {
    location: `${normalized}, India`,
    city: normalized,
    state: null,
    country: 'India',
  }
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/^(\d+(?:\+)?)\s*-\s*(\d+)\s*(?:years?)?$/i)
  if (rangeMatch) {
    return `${rangeMatch[1]} - ${rangeMatch[2]} Years`
  }

  const singleMatch = normalized.match(/^(\d+(?:\+)?)\s*(?:years?)?$/i)
  if (singleMatch) {
    return `${singleMatch[1]} Years`
  }

  return normalized.replace(/\byears?\b/i, 'Years')
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null

  const [, day, monthName, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${day.padStart(2, '0')}`
}

const parseCurrentOpeningsPayload = (payload) => {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  if (!Array.isArray(parsed) || parsed.some(record => !record || typeof record !== 'object'
    || Array.isArray(record) || typeof record.job_status !== 'boolean')) {
    throw new Error('Reserve Bank Information Technology current openings payload changed materially')
  }

  return parsed
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html)
  return /<title>\s*ReBIT - Reserve Bank Information Technology\s*<\/title>/i.test(page)
    && /<base href="\/">/i.test(page)
    && /google\.com\/recaptcha\/api\.js\?render=explicit/i.test(page)
    && /<app-root/i.test(page)
    && /src="[^"]*main-[^"]+\.js"/i.test(page)
}

const buildJobDescription = (job, apiDescription = null) => {
  const normalizedApiDescription = normalizeWhitespace(apiDescription)
  if (normalizedApiDescription) {
    return normalizedApiDescription
  }

  return null
}

const guardedFirstPartyFetch = async (url, options = {}) => {
  const requested = new URL(url)
  const changed = () => Object.assign(new Error('ReBIT first-party response identity or redirect changed'), {
    code: 'REBIT_SOURCE_IDENTITY_CHANGED', softFailure: true, abortRetries: true,
    failureKind: 'surface_drift_or_fail_closed',
  })
  if (requested.origin !== 'https://rebit.org.in' || requested.username || requested.password) throw changed()
  const response = await fetch(url, { ...options, redirect: 'manual' })
  let actual
  try { actual = new URL(response.url) } catch { throw changed() }
  if (response.status >= 300 && response.status < 400 || actual.href !== requested.href) throw changed()
  return response
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  fetchImpl: guardedFirstPartyFetch,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultPostJson = (url, body) => fetchJsonWithRetry(url, {
  fetchImpl: guardedFirstPartyFetch,
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    Origin: HOMEPAGE_URL.replace(/\/$/, ''),
    Referer: CAREERS_URL,
  },
  body: JSON.stringify(body),
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, { accessToken } = {}) => fetchJsonWithRetry(url, {
  fetchImpl: guardedFirstPartyFetch,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json; charset=utf-8',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    Referer: CAREERS_URL.replace(/\/$/, ''),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractIndiaJobsFromCurrentOpeningsPayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => parseCurrentOpeningsPayload(payload)
  .filter((record) => record && typeof record === 'object')
  .filter((record) => record.job_status !== false)
  .map((record) => {
    const title = normalizeWhitespace(record.job_title)
    const department = normalizeWhitespace(record.department) || null
    const locationDetails = normalizeLocation(record.location)
    const applyUrl = toAbsoluteUrl(record.apply_now_link)
    const experienceRequired = normalizeExperience(record.job_experience)
    const jobId = normalizeWhitespace(record.id)

    let trustedApplication = false
    try {
      const url = new URL(applyUrl)
      trustedApplication = url.origin === 'https://rebithr.darwinbox.in'
        && /^\/ms\/candidatev2\/main\/careers\/jobDetails\/[a-z0-9]+$/.test(url.pathname)
        && !url.username && !url.password
    } catch {}
    if (!title || !locationDetails.location || !trustedApplication || !jobId) {
      throw new Error('Reserve Bank Information Technology current openings payload changed materially')
    }

    const job = {
      title,
      company: COMPANY,
      department,
      ...locationDetails,
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: parsePostingDate(record.created_on),
      closingDate: null,
      remoteStatus: 'On-site',
      source: SOURCE,
      link: applyUrl,
      scrapedAt,
      publicExperienceChecked: Boolean(experienceRequired),
    }

    return {
      ...job,
      jobDescription: buildJobDescription(job, record.job_desc),
    }
  })

export const createReserveBankInformationTechnologyScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  experienceEnrichmentConcurrency = DEFAULT_EXPERIENCE_ENRICHMENT_CONCURRENCY,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    postJson = defaultPostJson,
    fetchJson = defaultFetchJson,
    fetchPublicJobText = null,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Reserve Bank Information Technology verified careers page no longer matches the trusted first-party SPA contract')
    }

    const clientUrl = resolvePublishedMainClient(careersHtml)
    const bootstrap = parsePublishedAnonymousBootstrap(await fetchText(clientUrl), clientUrl)
    assertPublishedApiBase(await fetchText(bootstrap.configUrl))
    const authPayload = await postJson(CAREERS_LOGIN_API_URL, bootstrap.body)
    const accessToken = normalizeWhitespace(authPayload?.access_token)
    if (!accessToken) {
      throw new Error('Reserve Bank Information Technology careers API login changed materially')
    }

    const scrapedAt = now()
    const openingsPayload = parseCurrentOpeningsPayload(await fetchJson(CURRENT_OPENINGS_API_URL, { accessToken }))
    const collectedJobs = extractIndiaJobsFromCurrentOpeningsPayload(openingsPayload, { scrapedAt })
    if (new Set(collectedJobs.map(job => job.jobId)).size !== collectedJobs.length) {
      throw new Error('ReBIT current openings contain duplicate job identity')
    }

    const shouldEnrichPublicDetails =
      collectedJobs.some((job) => !job.experienceRequired)
      && (typeof fetchPublicJobText === 'function' || fetchText === defaultFetchText)
    const enrichedPublicJobs = shouldEnrichPublicDetails
      ? await enrichJobsWithPublicExperience(collectedJobs.filter(job => !job.experienceRequired), {
          ...(typeof fetchPublicJobText === 'function'
            ? {
                fetchText: fetchPublicJobText,
                useBrowserFallback: false,
              }
            : {}),
          concurrency: Math.min(
            experienceEnrichmentConcurrency,
            Math.max(1, collectedJobs.length),
          ),
        })
      : []
    const enrichedById = new Map(enrichedPublicJobs.map(job => [job.jobId, job]))
    const jobsWithPublicDetails = collectedJobs.map(job => enrichedById.get(job.jobId) || job)

    const jobs = jobsWithPublicDetails
      .map((job) => ({
        ...job,
        publicExperienceChecked: job.publicExperienceChecked === true || Boolean(job.experienceRequired),
      }))
      .sort((left, right) => left.title.localeCompare(right.title))
    return attachInventoryEvidence(jobs, {
      status: openingsPayload.length ? 'complete-inventory' : 'verified-empty',
      surface: CURRENT_OPENINGS_API_URL, firstParty: true, listingComplete: true,
      pagesFetched: 1, reportedTotal: openingsPayload.length, indiaFacetCount: jobs.length,
      verifiedAt: scrapedAt, reason: 'Published anonymous SPA bootstrap and unpaginated first-party current-openings inventory. Missing descriptions remain null.'
    })
  },
})

export const run = async (options = {}) => createReserveBankInformationTechnologyScraper(options).run(options)

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
