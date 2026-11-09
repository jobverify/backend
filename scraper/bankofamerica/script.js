import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.bankofamerica.com'
const LISTING_PATH = '/services/jobssearchservlet'
const DEFAULT_ROWS = 10

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#43;/gi, '+')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const parseUsDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month}-${day}`
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/,\s*$/u, '')
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern|internship|apprentice/.test(normalized)) return 'Internship'
  if (/contract|temporary|fixed term/.test(normalized)) return 'Contract'
  if (/full\s*-?\s*time/.test(normalized)) return 'Full-time'
  if (/part\s*-?\s*time/.test(normalized)) return 'Part-time'
  return null
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^n\/a$/i.test(normalized)) return null
  return normalized
}

const buildAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return normalized
  return new URL(normalized, BASE_URL).toString()
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractTaggedSectionValue = (html, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return extractFirst(
    new RegExp(`<p><b>${escapedHeading}\\s*:?\\s*<\\/b>\\s*:?\\s*([\\s\\S]*?)<\\/p>`, 'i'),
    html,
    (match) => stripTags(match[1]),
  ) || extractFirst(
    new RegExp(`<p><b>${escapedHeading}<\\/b><\\/p>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'),
    html,
    (match) => stripTags(match[1]),
  )
}

const extractDescriptionHtml = (html) => extractFirst(
  /<div class="job-description-body__internal[^"]*">([\s\S]*?)<\/div>\s*(?:<div class="job-description-body__video-wrapper|<meta |<script )/i,
  html,
)

const extractJobPostingJson = (html) => {
  const scripts = [...String(html ?? '').matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi)]
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks.
    }
  }

  return null
}

const extractAttributeMap = (html) => {
  const openingTag = extractFirst(/<div class="job-description-body[^"]*"([^>]*)>/i, html, (match) => match[1])
  if (!openingTag) return {}

  return [...openingTag.matchAll(/\s(data-[a-zA-Z0-9-]+)="([^"]*)"/g)].reduce((accumulator, match) => {
    accumulator[match[1]] = decodeHtmlEntities(match[2])
    return accumulator
  }, {})
}

export const buildListingUrl = ({
  search = 'jobsByCountry',
  country = 'India',
  start = 0,
  rows = DEFAULT_ROWS,
} = {}) => {
  const url = new URL(LISTING_PATH, BASE_URL)
  url.searchParams.set('search', search)
  url.searchParams.set('country', country)
  url.searchParams.set('start', String(start))
  url.searchParams.set('rows', String(rows))
  return url.toString()
}

export const extractListingSummary = (payload = {}) => ({
  totalCount: Number(payload?.totalMatches || 0),
})

export const extractListings = (payload = {}) =>
  (payload?.jobsList || [])
    .map((posting) => ({
      title: normalizeWhitespace(posting.postingTitle),
      location: normalizeLocation(posting.location || posting.primaryLocation),
      city: normalizeWhitespace(posting.city),
      jobId: normalizeWhitespace(posting.jobRequisitionId),
      requisitionId: normalizeWhitespace(posting.jobRequisitionId),
      employmentType: normalizeEmploymentType(posting.timeType || posting.job_type_text),
      experienceRequired: normalizeExperience(posting.yearsOfExperience),
      postingDate: parseUsDate(posting.postedDate),
      closingDate: null,
      sourceUrl: buildAbsoluteUrl(posting.jcrURL),
      applyUrl: null,
      department: normalizeWhitespace(posting.area),
    }))
    .filter((posting) => posting.jobId && posting.title && /india/i.test(posting.location || ''))

export const extractJobDetail = (html, listing = {}) => {
  const attributes = extractAttributeMap(html)
  const jobPosting = extractJobPostingJson(html)
  const descriptionHtml = extractDescriptionHtml(html) || jobPosting?.description || ''
  const locationFromAttributes = normalizeLocation(attributes['data-jobSaveLocation'])
  const cityFromJson = normalizeWhitespace(jobPosting?.jobLocation?.[0]?.address?.addressLocality)
  const sourceUrl = listing.sourceUrl || buildAbsoluteUrl(
    extractFirst(/<meta name="job-path" content="([^"]+)"/i, html),
  )

  return {
    title: normalizeWhitespace(attributes['data-jobTitle']) || normalizeWhitespace(jobPosting?.title) || listing.title || null,
    location: locationFromAttributes || listing.location || null,
    city: cityFromJson || listing.city || null,
    jobId: normalizeWhitespace(attributes['data-jobRequisitionID']) || normalizeWhitespace(jobPosting?.identifier?.value) || listing.jobId || null,
    requisitionId: normalizeWhitespace(attributes['data-jobRequisitionID']) || normalizeWhitespace(jobPosting?.identifier?.value) || listing.requisitionId || null,
    department: normalizeWhitespace(attributes['data-jobFamily']) || listing.department || null,
    employmentType: normalizeEmploymentType(attributes['data-jobTimeType'] || jobPosting?.employmentType),
    experienceRequired: extractTaggedSectionValue(descriptionHtml, 'Experience Range') || listing.experienceRequired || null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: extractTaggedSectionValue(descriptionHtml, 'Education'),
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: parseUsDate(
      extractFirst(/data-postedDate="([^"]+)"/i, html)
      || jobPosting?.datePosted
      || null,
    ) || listing.postingDate || null,
    closingDate: null,
    sourceUrl,
    applyUrl: buildAbsoluteUrl(
      extractFirst(/<a href="(https:\/\/ghr\.wd1\.myworkdayjobs\.com\/[^"]+)"/i, html),
    ),
  }
}

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
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

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
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

export const createBankOfAmericaScraper = ({
  fetchJson = defaultFetchJson,
  fetchText = defaultFetchText,
} = {}) => ({
  run: async ({
    fetchJson: overrideFetchJson,
    fetchText: overrideFetchText,
    maxPages: overrideMaxPages,
    rows: overrideRows,
    signal,
    onAudit,
  } = {}) => {
    const fetchJsonImpl = overrideFetchJson || fetchJson
    const fetchTextImpl = overrideFetchText || fetchText
    signal?.throwIfAborted()
    let requests = 0
    const readJson = async url => { signal?.throwIfAborted(); requests += 1; return fetchJsonImpl(url, { signal }) }
    const readText = async url => { signal?.throwIfAborted(); requests += 1; return fetchTextImpl(url, { signal }) }
    const maxPages = Number.isInteger(overrideMaxPages)
      ? overrideMaxPages
      : Number.isInteger(config.maxPages)
        ? config.maxPages
        : Number.POSITIVE_INFINITY
    const rows = Number.isInteger(overrideRows) ? overrideRows : DEFAULT_ROWS

    const collect = async () => {
      const records = [], listings = [], seen = new Set(), cache = new Map()
      let total = null
      let complete = false
      for (let pageIndex = 0; pageIndex < Math.min(maxPages, 500); pageIndex += 1) {
      const start = pageIndex * rows
      let listingPayload = cache.get(start) || await readJson(buildListingUrl({ start, rows }))
      let summary = extractListingSummary(listingPayload)
      let pageListings = extractListings(listingPayload)
      let usedSinglePageFallback = false

      // Some BOA searches report the full total count but ignore non-zero offsets.
      // When that happens, retry once with a single larger first-page request.
      if (pageIndex === 0 && summary.totalCount > pageListings.length && pageListings.length === rows) {
        const offsetProbePayload = await readJson(buildListingUrl({ start: rows, rows }))
        const offsetProbeListings = extractListings(offsetProbePayload)
        if (offsetProbeListings.length === 0 || offsetProbeListings.some(job => pageListings.some(first => first.jobId === job.jobId))) {
          listingPayload = await readJson(buildListingUrl({ start: 0, rows: summary.totalCount }))
          summary = extractListingSummary(listingPayload)
          pageListings = extractListings(listingPayload)
          usedSinglePageFallback = true
        } else cache.set(rows, offsetProbePayload)
      }
      const nativeRows = listingPayload?.jobsList
      if (!Array.isArray(nativeRows) || !Object.hasOwn(listingPayload, 'totalMatches')
        || !Number.isSafeInteger(summary.totalCount) || summary.totalCount < 0 || summary.totalCount > 5000
        || (total !== null && total !== summary.totalCount)) throw new Error('Bank of America native total metadata changed')
      total = summary.totalCount
      for (const row of nativeRows) {
        const id = normalizeWhitespace(row.jobRequisitionId)
        if (!id || seen.has(id)) throw new Error('Bank of America native role identities repeat or are missing')
        seen.add(id); records.push(row)
      }
      listings.push(...pageListings)
      if (records.length === total) { complete = true; break }
      if (usedSinglePageFallback || nativeRows.length < rows || records.length > total) break
      }
      return { records, listings, total, complete }
    }
    const opening = await collect()
    const results = new Array(opening.listings.length), failures = []
    let cursor = 0
    await Promise.all(Array.from({ length: Math.min(4, results.length) }, async () => {
      while (cursor < opening.listings.length) {
        const index = cursor++, listing = opening.listings[index]
        try {
          const source = new URL(listing.sourceUrl)
          if (source.origin !== BASE_URL || !source.pathname.startsWith(`/en-us/job-detail/${listing.jobId}/`)) throw new Error('Native detail URL is outside its listed employer/post identity')
          const detailHtml = await readText(listing.sourceUrl)
          const attributes = extractAttributeMap(detailHtml)
          const detail = extractJobDetail(detailHtml, listing)
          if (normalizeWhitespace(attributes['data-jobRequisitionID']) !== listing.jobId
            || normalizeWhitespace(attributes['data-jobTitle'])?.toLowerCase() !== listing.title?.toLowerCase()
            || detail.jobId !== listing.jobId || detail.title?.toLowerCase() !== listing.title?.toLowerCase()) throw new Error('Native detail identity/title does not match the listed post')
          if (attributes['data-jobCountry'] !== 'India' || attributes['data-jobCountryName'] !== 'India') throw new Error('Native detail India country is not qualified')
          const application = new URL(detail.applyUrl)
          if (application.protocol !== 'https:' || application.hostname !== 'ghr.wd1.myworkdayjobs.com'
            || !new RegExp(`_${listing.jobId}(?:-\\d+)?/?$`).test(application.pathname)) throw new Error('Native Workday application is not bound to the same employer/post')
          if (!detail.jobDescription || detail.jobDescription.length < 100) throw new Error('Full native role criteria unavailable')
          results[index] = {
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: 'Bank of America',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          link: detail.applyUrl || detail.sourceUrl || listing.applyUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'bankofamerica',
          country: 'India',
          sourceDetailComplete: true,
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired || listing.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate || listing.closingDate,
          scrapedAt: new Date().toISOString(),
          }
        } catch (error) { signal?.throwIfAborted(); failures.push({ stage: 'native-detail', jobId: listing.jobId, message: error.message }) }
      }
    }))
    const closing = await collect()
    const signature = records => JSON.stringify(records.map(row => [row.jobRequisitionId, row.postingTitle, row.primaryLocation, row.location, row.country, row.jcrURL, row.postedDate, row.applyByDate]).sort((a, b) => a[0].localeCompare(b[0])))
    const stable = opening.total === closing.total && signature(opening.records) === signature(closing.records)
    const countryQualified = opening.listings.length === opening.records.length && opening.records.every(row => !row.country || row.country === 'India')
    const complete = opening.complete && closing.complete && stable && countryQualified && failures.length === 0
    const jobs = results.filter(Boolean)
    for (const job of jobs) job.sourceListingComplete = complete
    const audit = { source: 'bankofamerica', candidateDetails: opening.listings.length, extractedDetailJobs: jobs.length,
      jobs: jobs.map(job => ({ id: job.jobId })), exclusions: [], failures, observedListingCount: opening.records.length,
      observedIndiaListingCount: opening.listings.length, nonIndiaListingCount: opening.records.length - opening.listings.length,
      listingPaginationComplete: opening.complete, closingInventoryMatches: closing.complete && stable,
      sourceScopeComplete: complete, openingTotal: opening.total, closingTotal: closing.total, countryQualified }
    if (jobs.length) jobs[0].nativeCollectionEvidence = audit
    onAudit?.(audit)
    return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', firstParty: true,
      surface: buildListingUrl(), listingComplete: complete, pagesFetched: requests, reportedTotal: opening.total,
      indiaFacetCount: countryQualified ? opening.listings.length : null, verifiedAt: new Date().toISOString(), reason: complete
        ? 'declared-Bank-of-America-first-party-India-board; full-country-and-application-identity-bound-details; opening-and-closing-native-total-and-unique-roles-reconciled'
        : `Bank-of-America-native-gap; opening-complete:${opening.complete}; closing-complete:${closing.complete}; stable:${stable}; country-qualified:${countryQualified}; failed-details:${failures.length}` })
  },
})

export const run = async (options = {}) => createBankOfAmericaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Bank of America scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'bankofamerica')
    console.log('DB result:', result)
    process.exit(0)
  }
}
