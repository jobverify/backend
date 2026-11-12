import path from 'path'
import { fileURLToPath } from 'url'

import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { DEFAULT_JOB_RETENTION_DAYS } from '../../src/utils/jobLifecycle.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { AMAZON_NATIVE_PAGE_SIZE, hasAmazonNativeBody, verifyAmazonNativeInventory } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nativeDefaults = loadNativePaginationDefaults(currentDir)

export const BASE_URL = 'https://www.amazon.jobs'
export const SEARCH_COUNTRY_CODE = 'IND'
export const DEFAULT_PAGE_SIZE = 10
export const DEFAULT_DETAIL_FETCH_RETENTION_DAYS = DEFAULT_JOB_RETENTION_DAYS

const MONTH_INDEX = {
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

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(0, 10)
  }

  const match = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return null

  const [, monthName, day, year] = match
  const month = MONTH_INDEX[monthName.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

const formatExperienceDuration = (minimum, {
  maximum = null,
  suffix = '',
  unit = 'years',
} = {}) => {
  if (!minimum) return null
  const normalizedUnit = /^mo/i.test(unit) ? 'month' : 'year'
  const singular = Number.parseFloat(maximum ?? minimum) === 1 && !maximum && suffix !== '+'
  if (maximum) return `${minimum}-${maximum} ${normalizedUnit}s`
  return `${minimum}${suffix} ${singular ? normalizedUnit : `${normalizedUnit}s`}`
}

const extractExperienceRequired = (value) => {
  const text = stripTags(value)
  if (!text) return null

  let match = text.match(/\b(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*((?:years?|yrs?|months?|mos?))\b[^.]{0,120}\bexperience\b/i)
  if (match) {
    return formatExperienceDuration(match[1], {
      maximum: match[2],
      unit: match[3],
    })
  }

  match = text.match(/\b(\d+(?:\.\d+)?)\s*(\+|plus)\s*((?:years?|yrs?|months?|mos?))\b[^.]{0,120}\bexperience\b/i)
  if (match) {
    return formatExperienceDuration(match[1], {
      suffix: '+',
      unit: match[3],
    })
  }

  match = text.match(/\b(\d+(?:\.\d+)?)\s*((?:years?|yrs?|months?|mos?))\b[^.]{0,120}\bexperience\b/i)
  if (match) {
    return formatExperienceDuration(match[1], {
      unit: match[2],
    })
  }

  return null
}

const extractMetaContent = (html, key) => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+property=["']${key}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const value = extractFirst(pattern, html)
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const extractSectionText = (html, heading) => stripTags(
  extractFirst(
    new RegExp(`<div[^>]*class=["'][^"']*section[^"']*["'][^>]*>\\s*<h2>\\s*${heading}\\s*<\\/h2>([\\s\\S]*?)<\\/div>`, 'i'),
    html,
  ),
)

const extractDetailTitle = (html, listing = {}) => {
  const ogTitle = extractMetaContent(html, 'og:title')
  if (ogTitle) return ogTitle

  const titleTag = normalizeWhitespace(extractFirst(/<title>\s*([\s\S]*?)\s*<\/title>/i, html))
  if (titleTag) {
    return normalizeWhitespace(
      titleTag
        .replace(/\s*-\s*Job ID:\s*\d+[\s\S]*$/i, '')
        .replace(/\s*\|\s*Amazon\.jobs\s*$/i, ''),
    )
  }

  return listing.title || null
}

const parseIsoDate = (value) => {
  const normalized = normalizeDate(value)
  if (!normalized) return null
  const parsed = new Date(`${normalized}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const shouldFetchDetailForJob = (job, {
  now = new Date(),
  detailFetchRetentionDays = DEFAULT_DETAIL_FETCH_RETENTION_DAYS,
} = {}) => {
  const postingDate = parseIsoDate(job?.postingDate)
  if (!postingDate) return true

  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(0, Number(detailFetchRetentionDays) || DEFAULT_DETAIL_FETCH_RETENTION_DAYS))
  cutoff.setUTCHours(0, 0, 0, 0)
  return postingDate >= cutoff
}

export const extractJobDetail = (html, listing = {}) => {
  const description = extractSectionText(html, 'Description')
  const basicQualifications = extractSectionText(html, 'Basic Qualifications')
  const preferredQualifications = extractSectionText(html, 'Preferred Qualifications')
  const detailText = [
    description,
    basicQualifications,
    preferredQualifications,
  ].filter(Boolean).join('\n\n')

  return {
    title: extractDetailTitle(html, listing),
    experienceRequired: extractExperienceRequired(basicQualifications || preferredQualifications || detailText),
    minimumQualification: basicQualifications || null,
    preferredQualification: preferredQualifications || null,
    jobDescription: detailText || listing.jobDescription || null,
  }
}

const normalizeLocation = (record = {}) => {
  const normalizedLocation = normalizeWhitespace(record.normalized_location)
  if (normalizedLocation) {
    return normalizedLocation.replace(/\bIND\b/i, 'India')
  }

  const city = normalizeWhitespace(record.city)
  return city ? `${city}, India` : null
}

const extractCity = (record = {}, normalizedLocation) =>
  normalizeWhitespace(record.city)
  || normalizeWhitespace(normalizedLocation)?.split(',')[0]
  || null

export const buildSearchApiUrl = ({
  offset = 0,
  resultLimit = DEFAULT_PAGE_SIZE,
  sort = 'relevant',
} = {}) => {
  const url = new URL('/en/search.json', `${BASE_URL}/`)
  url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)))
  url.searchParams.set('result_limit', String(Math.max(1, Number(resultLimit) || DEFAULT_PAGE_SIZE)))
  url.searchParams.set('sort', normalizeWhitespace(sort) || 'relevant')
  url.searchParams.append('normalized_country_code[]', SEARCH_COUNTRY_CODE)
  return url.toString()
}

export const buildJobUrl = (jobPath) => {
  const normalized = normalizeWhitespace(jobPath)
  return normalized ? new URL(normalized, `${BASE_URL}/`).toString() : null
}

export const buildApplyUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized).toString()
  } catch {
    return null
  }
}

export const extractPaginationSummary = (payload, {
  offset = 0,
  resultLimit = DEFAULT_PAGE_SIZE,
} = {}) => {
  const totalRecords = Number(payload?.hits) || 0
  const safeOffset = Math.max(0, Number(offset) || 0)
  const safeResultLimit = Math.max(1, Number(resultLimit) || DEFAULT_PAGE_SIZE)
  const totalPages = Math.ceil(totalRecords / safeResultLimit)

  return {
    offset: safeOffset,
    resultLimit: safeResultLimit,
    totalRecords,
    totalPages,
    hasNext: safeOffset + safeResultLimit < totalRecords,
  }
}

export const extractSearchResults = (payload) => (Array.isArray(payload?.jobs) ? payload.jobs : [])
  .filter((record) => normalizeWhitespace(record.country_code) === SEARCH_COUNTRY_CODE)
  .map((record) => {
    const title = normalizeWhitespace(record.title)
    const jobId = normalizeWhitespace(record.id_icims)
    const requisitionId = normalizeWhitespace(record.id)
    const sourceUrl = buildJobUrl(record.job_path)
    const applyUrl = buildApplyUrl(record.url_next_step)
    const location = normalizeLocation(record)
    const city = extractCity(record, location)

    if (!title || !jobId || !requisitionId || !sourceUrl || !applyUrl || !location) {
      return null
    }

    return {
      title,
      company: 'Amazon',
      department: normalizeWhitespace(record.job_category),
      location,
      city,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      employmentType: normalizeEmploymentType(record.job_schedule_type),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeDate(record.posted_date),
      closingDate: null,
      jobDescription: stripTags(record.description),
    }
  })
  .filter(Boolean)

const fetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const fetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createAmazonScraper = ({
  pageSize = AMAZON_NATIVE_PAGE_SIZE,
  maxJobs = nativeDefaults.maxJobs,
  maxPages = nativeDefaults.maxPages,
} = {}) => ({
  async run(options = {}) {
    const signal = options.signal
    signal?.throwIfAborted()
    const limits = nativePaginationLimits(options, { maxPages, maxJobs })
    const pagination = createNativePagination({ surface: buildSearchApiUrl(), limits, signal, collectionBudgetMs: options.collectionBudgetMs, identityScope: 'native-raw' })
    const fetchJsonImpl = options.fetchJson || fetchJson
    const fetchTextImpl = options.fetchText || fetchText
    const now = options.now ? new Date(options.now) : new Date()
    const detailFetchRetentionDays = Number.isInteger(options.detailFetchRetentionDays)
      ? options.detailFetchRetentionDays
      : Number.parseInt(process.env.SCRAPER_JOB_POSTED_WITHIN_DAYS || '', 30) || DEFAULT_DETAIL_FETCH_RETENTION_DAYS
    const jobs = []
    return pagination.run(jobs, async () => {
      const seenJobIds = new Set()
      const nativePages = []
      const finish = async (exhausted = false) => {
        const proof = exhausted ? await verifyAmazonNativeInventory({ pages: nativePages, pageSize, fetchJson: fetchJsonImpl,
          fetchText: fetchTextImpl, buildSearchApiUrl, signal: pagination.signal }) : null
        const result = pagination.finish(jobs, { exhausted })
        const inventory = readInventoryEvidence(result)
        if (!proof?.complete || jobs.some(job => job.sourceDetailComplete !== true)
          || jobs.length !== proof.reportedTotal || inventory.reason.includes('native-total-') || inventory.reason.includes('native-malformed-')) {
          return attachInventoryEvidence(result, { ...inventory, lifecycleCleanupAllowed: false,
            ...(proof && !proof.complete ? { reason: inventory.reason + ';' + proof.reason } : {}) })
        }
        for (const job of jobs) Object.assign(job, { sourceListingComplete: true, sourceScopeComplete: true, lifecycleCleanupAllowed: true })
        if (jobs[0]) jobs[0].sourceInventoryEvidence = proof
        Object.defineProperty(result, 'amazonNativeInventoryEvidence', { value: proof })
        return attachInventoryEvidence(result, { status: jobs.length ? 'complete-inventory' : 'verified-empty',
          surface: buildSearchApiUrl({ resultLimit: pageSize }), firstParty: true, listingComplete: true, lifecycleCleanupAllowed: true,
          pagesFetched: proof.openingPages + proof.closingPages + proof.terminalChecks, reportedTotal: proof.reportedTotal,
          indiaFacetCount: jobs.length, verifiedAt: proof.verifiedAt, reason: proof.reason })
      }
      let offset = 0

      for (let page = 0; page < limits.maxPages; page += 1) {
        const payload = await readNativeWithSignal(() => fetchJsonImpl(buildSearchApiUrl({ offset, resultLimit: pageSize }), { signal: pagination.signal }), pagination.signal)
        const listings = extractSearchResults(payload)
        const rawRows = Array.isArray(payload?.jobs) ? payload.jobs : []
        const total = Number.isSafeInteger(payload?.hits) && payload.hits >= 0 ? payload.hits : null
        const hasNext = total !== null ? offset + rawRows.length < total : rawRows.length >= pageSize
        nativePages.push({ offset, payload })
        const progress = pagination.page(rawRows.map(record => normalizeWhitespace(record?.id_icims)), total)
        if (!progress) return finish(!hasNext)
        const nativeRowsById = new Map(rawRows.map(record => [normalizeWhitespace(record?.id_icims), record]))

        for (const job of listings) {
          if (seenJobIds.has(job.jobId)) continue
          seenJobIds.add(job.jobId)

          let detail = {}
          const native = nativeRowsById.get(job.jobId)
          const fullNativeBody = hasAmazonNativeBody(native)
          if (fullNativeBody) {
            const basic = stripTags(native.basic_qualifications)
            const preferred = stripTags(native.preferred_qualifications)
            detail = { experienceRequired: extractExperienceRequired(basic || preferred), minimumQualification: basic,
              preferredQualification: preferred, jobDescription: [stripTags(native.description), basic, preferred].filter(Boolean).join('\n\n') }
          } else if (shouldFetchDetailForJob(job, { now, detailFetchRetentionDays })) {
            try {
              detail = extractJobDetail(await readNativeWithSignal(() => fetchTextImpl(job.sourceUrl, { signal: pagination.signal }), pagination.signal), job)
            } catch {
              signal?.throwIfAborted()
              pagination.throwIfAborted()
              detail = {}
            }
          }

          jobs.push({
            ...job,
            title: detail.title || job.title,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            jobDescription: detail.jobDescription || job.jobDescription,
            source: 'amazon',
            link: job.applyUrl || job.sourceUrl,
            scrapedAt: new Date().toISOString(),
            sourceDetailComplete: fullNativeBody,
            ...(fullNativeBody ? { sourceDetailEvidence: 'amazon-search-native-full-body-v1' } : { sourceDetailFailureKind: 'native-full-criteria-unverified' }),
          })

          if (jobs.length >= limits.maxJobs) {
            return finish()
          }
        }

        if (!hasNext) {
          return finish(true)
        }
        offset += rawRows.length
      }

      return finish()
    })
  },
})

export const run = async (options = {}) => createAmazonScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Amazon scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'amazon', {
      enrichPublicExperience: false,
    })
    console.log('DB result:', result)
    process.exit(0)
  }
}
