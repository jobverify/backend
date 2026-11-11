import path from 'node:path'
import {normalizeNativeLocation,strictCreatedCalendarDate,attachUnqualifiedApiObservations,literalApiText,literalApiRecordID} from './nativeFields20261111.js'
import { resolvePublishedMainClient, parsePublishedAnonymousBootstrap, assertPublishedApiBase } from './publicBootstrap.js'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

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

const normalizeExperience = (value) => {
  const normalized = literalApiText(value)
  if (!normalized) return null
  if (/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(normalized)) return null

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
) => {
  const records = parseCurrentOpeningsPayload(payload)
  const jobs = records
  .filter((record) => record && typeof record === 'object')
  .filter((record) => record.job_status !== false)
  .flatMap((record) => {
    const title = literalApiText(record.job_title)
    const department = literalApiText(record.department)
    const locationDetails = normalizeNativeLocation(record.location, record)
    const applyUrl = literalApiText(record.apply_now_link) ? toAbsoluteUrl(record.apply_now_link) : null
    const rawExperience = literalApiText(record.job_experience) ? normalizeExperience(record.job_experience) : null
    const experienceRequired = rawExperience && !/^(?:n\/?a|none|null|unknown|tbd|not (?:specified|available))$/i.test(rawExperience) ? rawExperience : null
    const jobId = literalApiRecordID(record.id)

    let trustedApplication = false
    try {
      const url = new URL(applyUrl)
      trustedApplication = url.origin === 'https://rebithr.darwinbox.in'
        && /^\/ms\/candidatev2\/main\/careers\/jobDetails\/[a-z0-9]+$/.test(url.pathname)
        && !url.username && !url.password
    } catch {}
    if (!title || !trustedApplication || !jobId) {
      return []
    }

    const job = {
      title,
      company: COMPANY,
      department,
      ...locationDetails,
      jobId,
      requisitionId: null,
      nativeJobId: null,
      nativeRequisitionId: null,
      sourceNativeAPIRecord: structuredClone(record),
      sourceInternalIdBasis: 'native-api-record-id-not-formal-requisition',
      sourceRecordKind: 'api-role-observation',
      nativeLegalEmployer: null,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      sourceNativeCreatedOn: record.created_on ?? null,
      sourceNativeCreatedDate: strictCreatedCalendarDate(record.created_on),
      sourceNativeCreatedDateKind: 'api-record-creation-not-employer-publication',
      closingDate: null,
      remoteStatus: null,
      source: SOURCE,
      link: applyUrl,
      scrapedAt,
      publicExperienceChecked: false,
      sourceExperienceScopeUnresolved: !experienceRequired,
      skipPublicExperienceEnrichment: true,
      sourceDetailComplete: false,
      sourceDetailFailureKind: 'current-native-api-program-unqualified',
      sourceScopeComplete: false,
      sourceListingComplete: false,
      lifecycleCleanupAllowed: false,
      companyIndiaTotal: null,
      companyGlobalTotal: null,
    }

    return {
      ...job,
      jobDescription: null,
      sourceDescription: null,
      description: null,
    }
  })
  return attachUnqualifiedApiObservations(jobs,records,{source:SOURCE,surface:CURRENT_OPENINGS_API_URL,scrapedAt})
}

export const createReserveBankInformationTechnologyScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    postJson = defaultPostJson,
    fetchJson = defaultFetchJson,
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

    const jobs = collectedJobs.sort((left,right)=>left.title.localeCompare(right.title))
    return jobs
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
