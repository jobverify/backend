import path from 'path'
import { fileURLToPath } from 'url'
import { setTimeout as wait } from 'node:timers/promises'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { DETAIL_URL, TENANT_URL, PUBLICATION_DATES_URL, validateNativeTenant, nativePublicationDates, extractNativeShareChatJob } from './nativeDetails.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const API_BASE_URL = 'https://sharechat.com/api/careersList'
const JOB_BASE_URL = 'https://sharechat.mynexthire.com/employer/jobs'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(/[\s_-]+/)
    .map((part) => {
      if (!part) return part
      return part[0].toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

const formatEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'part_time' || normalized === 'part-time') return null

  const mapped = {
    contract: 'Contract',
    intern: 'Internship',
    internship: 'Internship',
    full_time: 'Full-time',
    'full-time': 'Full-time',
    fulltime: 'Full-time',
  }

  return mapped[normalized] || toTitleCase(normalized)
}

const formatExperienceRange = (minYears, maxYears) => {
  const min = Number(minYears)
  const max = Number(maxYears)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return `${min}-${max} years`
}

const formatLocation = (officeLocationNames) => {
  const location = Array.isArray(officeLocationNames)
    ? normalizeWhitespace(officeLocationNames.find(Boolean))
    : normalizeWhitespace(officeLocationNames)

  if (!location) return { location: null, city: null }
  if (/^india$/i.test(location)) return { location: 'India', city: null }
  if (/india/i.test(location)) {
    return {
      location,
      city: normalizeWhitespace(location.split(',')[0]),
    }
  }

  return {
    location: `${location}, India`,
    city: location,
  }
}

const getCareersList = (payload) => Array.isArray(payload?.data?.careersList)
  ? payload.data.careersList
  : []

export const buildSearchUrl = ({ limit = 100, offsetToken } = {}) => {
  const url = new URL(API_BASE_URL)
  url.searchParams.set('limit', String(limit))

  if (offsetToken) {
    url.searchParams.set('offsetToken', offsetToken)
  }

  return url.toString()
}

export const buildJobUrl = (requisitionId) => {
  if (!/^[1-9]\d*$/.test(String(requisitionId)) || !Number.isSafeInteger(Number(requisitionId))) throw new Error('ShareChat native requisition identity is invalid')
  const reqId = Number(requisitionId)
  const encodedPayload = Buffer.from(JSON.stringify({
    pageType: 'jd',
    cvSource: 'careers',
    reqId,
    requester: {
      id: '',
      code: '',
      name: '',
    },
    page: 'careers',
    bufilter: -1,
    customFields: {},
  })).toString('base64')

  return `${JOB_BASE_URL}?src=careers&p=${encodedPayload}`
}

export const extractSearchResults = (payload) => getCareersList(payload)
  .flatMap((group) => {
    const department = normalizeWhitespace(group?.orgUnitName || group?.title)
    const records = Array.isArray(group?.data) ? group.data : []

    return records.map((record) => {
      const requisitionId = normalizeWhitespace(record?.requisitionId)
      const title = normalizeWhitespace(record?.requisitionTitle || record?.designation)
      const { location, city } = formatLocation(record?.officeLocationNames)
      const jobUrl = requisitionId ? buildJobUrl(requisitionId) : null

      if (!requisitionId || !title || !jobUrl) return null

      return {
        title,
        company: 'ShareChat',
        department: normalizeWhitespace(record?.orgUnitName) || department,
        location,
        city,
        jobId: requisitionId,
        requisitionId,
        sourceUrl: jobUrl,
        applyUrl: jobUrl,
        employmentType: formatEmploymentType(record?.employmentType),
        experienceRequired: formatExperienceRange(record?.yrsOfExpMin, record?.yrsOfExpMax),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
  })
  .filter(Boolean)

export const extractPaginationSummary = (payload) => ({
  hasNext: payload?.data?.hasNext === true,
  offsetToken: normalizeWhitespace(payload?.data?.offsetToken),
  totalJobCount: Number.isFinite(payload?.data?.count) ? payload.data.count : null,
})

const defaultFetchPage = async (url, { method = 'GET', body, signal } = {}) => {
  const response = await fetch(url, {
    method, body, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)), redirect: 'error',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

  if (Number(response.headers.get('content-length')) > 2000000) throw new Error('ShareChat native body exceeds 2MB bound')
  const html = await response.text()
  if (Buffer.byteLength(html) > 2000000) throw new Error('ShareChat native body exceeds 2MB bound')
  signal?.throwIfAborted()
  return { status: response.status, url: response.url, html }
}

const receiveWithAbort = async (action, signal) => {
  signal.throwIfAborted()
  let onAbort, settlementTimer
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  const operation = Promise.resolve().then(action)
  try { return await Promise.race([operation, aborted]) }
  catch (error) {
    if (!signal.aborted) throw error
    await Promise.race([operation.catch(() => {}), new Promise(resolve => { settlementTimer = setTimeout(resolve, 100) })])
    throw signal.reason
  } finally { signal.removeEventListener('abort', onAbort); clearTimeout(settlementTimer) }
}

export const run = async ({ fetchPage = defaultFetchPage, fetchText, fetchBrowserText, signal, now = () => new Date().toISOString(),
  maxJobs = config.maxJobs ?? null, maxPages = config.maxPages ?? 10, sourceBudgetMs = 120000, requestIntervalMs = 500,
} = {}) => {
  signal?.throwIfAborted()
  if (fetchText || fetchBrowserText || typeof fetchPage !== 'function') throw new Error('ShareChat native transport requires response receipts')
  if ((maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 1 || maxJobs > 100))
    || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10
    || !Number.isSafeInteger(sourceBudgetMs) || sourceBudgetMs < 1 || sourceBudgetMs > 120000
    || !Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0 || requestIntervalMs > 5000) throw new Error('ShareChat native bounded run options are invalid')
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(new Error(`ShareChat native ${sourceBudgetMs}ms source deadline exhausted`)), sourceBudgetMs)
  let lastStart = 0, pagesFetched = 0
  const loadJson = async (url, body) => {
    combined.throwIfAborted()
    const remaining = requestIntervalMs - (Date.now() - lastStart)
    if (remaining > 0) { try { await wait(remaining, undefined, { signal: combined }) } catch (error) { combined.throwIfAborted(); throw error } }
    combined.throwIfAborted(); lastStart = Date.now()
    const response = await receiveWithAbort(() => fetchPage(url, { method: body ? 'POST' : 'GET',
      ...(body ? { body: JSON.stringify(body) } : {}), signal: combined }), combined)
    combined.throwIfAborted()
    if (!Number.isSafeInteger(response?.status) || response.url !== url || typeof response.html !== 'string') throw new Error('ShareChat native response receipt or URL is invalid')
    if (Buffer.byteLength(response.html) > 2000000) throw new Error('ShareChat native body exceeds 2MB bound')
    if (response.status !== 200) throw Object.assign(new Error(`ShareChat native HTTP ${response.status}`), { status: response.status })
    try { return JSON.parse(response.html) } catch { throw new Error('ShareChat native response JSON is malformed') }
  }
  try {
    const listings = [], seen = new Set(), tokens = new Set()
    let offsetToken = null
    while (pagesFetched < maxPages) {
      const payload = await loadJson(buildSearchUrl({ offsetToken })); pagesFetched++
      if (!Array.isArray(payload?.data?.careersList) || typeof payload.data.hasNext !== 'boolean') throw new Error('ShareChat native listing envelope is malformed')
      for (const group of payload.data.careersList) {
        if (!Array.isArray(group?.data)) throw new Error('ShareChat native listing group is malformed')
        for (const raw of group.data) {
          if (!Number.isSafeInteger(raw?.requisitionId) || raw.requisitionId < 1 || !normalizeWhitespace(raw.requisitionTitle)) throw new Error('ShareChat native listing identity is missing')
          if (seen.has(raw.requisitionId)) throw new Error('ShareChat native listing repeats a role identity')
          seen.add(raw.requisitionId)
          if (seen.size > 100) throw new Error('ShareChat native listing exceeds 100-role bound')
          const [listing] = extractSearchResults({ data: { careersList: [{ ...group, data: [raw] }] } })
          listings.push({ listing, raw })
        }
      }
      const summary = extractPaginationSummary(payload)
      if (!summary.hasNext) break
      if (!summary.offsetToken || summary.offsetToken.length > 512 || tokens.has(summary.offsetToken)) throw new Error('ShareChat native pagination token is missing or repeated')
      tokens.add(summary.offsetToken); offsetToken = summary.offsetToken
    }
    const tenant = validateNativeTenant(await loadJson(TENANT_URL))
    const selected = maxJobs == null ? listings : listings.slice(0, maxJobs), jobs = [], errors = []
    let dates
    if (selected.length) {
      const ids = selected.map(item => item.raw.requisitionId)
      try { dates = nativePublicationDates(await loadJson(PUBLICATION_DATES_URL, { srcShortName: 'careers', requisitionIdList: ids }), ids, now()) }
      catch (error) { combined.throwIfAborted(); errors.push(error) }
    }
    if (dates) for (const { listing, raw } of selected) {
      try {
        const payload = await loadJson(DETAIL_URL, { source: 'careers', id: '', code: '', reqId: raw.requisitionId })
        const job = extractNativeShareChatJob(listing, raw, tenant, payload, dates.get(raw.requisitionId))
        jobs.push({ ...job, source: 'sharechat', link: job.applyUrl, scrapedAt: now(), publicExperienceChecked: true,
          companyDomain: 'sharechat.com', companyCareerPage: 'https://sharechat.com/careers', atsPlatform: 'mynexthire' })
      } catch (error) { combined.throwIfAborted(); errors.push(error) }
    }
    combined.throwIfAborted()
    return attachInventoryEvidence(jobs, { status: jobs.length ? 'discovery-only' : 'coverage-gap', firstParty: true,
      surface: 'https://sharechat.com/careers', listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched,
      verifiedAt: now(), reason: `full-company-scope-unverified;observed-listings=${listings.length};selected-details=${selected.length};verified-details=${jobs.length};detail-failures=${errors.length}${errors.length ? ';' + errors.map(error => error.message).join(';') : ''}` })
  } finally { clearTimeout(timer) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ShareChat scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'sharechat')
    console.log('DB result:', result)
    process.exit(0)
  }
}
