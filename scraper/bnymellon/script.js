import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const API_BASE_URL = 'https://eofe.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
const DETAIL_API_BASE_URL = 'https://eofe.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
const PUBLIC_CAREERS_BASE_URL = 'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/'
const SITE_NUMBER = 'CX_3001'
const DEFAULT_LOCATION = 'India'
const DEFAULT_LIMIT = 24
export const OFFICIAL_CAREERS_URL = 'https://www.bny.com/corporate/global/en/careers.html'
export const PUBLIC_SITE_URL = 'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+:/g, ':'),
)

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(',')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join(', ')
}

const extractCity = (location) => normalizeLocation(location)?.split(',')[0] || null

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => (
      Array.isArray(item?.requisitionList) ? item.requisitionList : []
    ))
  }

  if (Array.isArray(payload?.requisitionList)) {
    return payload.requisitionList
  }

  return []
}

const getRequisitionDetail = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const isIndiaJob = (record = {}) => {
  const country = normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase()
  const location = normalizeWhitespace(record.PrimaryLocation)?.toLowerCase()

  return country === 'IN' || location?.endsWith('india') || false
}

const toJob = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: 'BNY Mellon',
    department: normalizeWhitespace(record.Department || record.JobFunction || record.JobFamily),
    location: normalizeLocation(record.PrimaryLocation),
    city: extractCity(record.PrimaryLocation),
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(record.JobSchedule || record.JobType || record.ContractType),
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(record.PostedDate),
    closingDate: normalizeWhitespace(record.PostingEndDate),
    jobDescription: joinDescriptionParts(
      record.ShortDescriptionStr,
      record.ExternalResponsibilitiesStr,
    ),
  }
}

export const buildSearchUrl = ({
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const offset = Math.max(0, Number(page) || 0) * (Number(limit) || DEFAULT_LIMIT)

  return `${API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${Number(limit) || DEFAULT_LIMIT},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = (jobId) => `${PUBLIC_CAREERS_BASE_URL}${jobId}/`
export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}/${encodeURIComponent(normalizeWhitespace(jobId) || '')}?expand=all`

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toJob(record))

const extractExperienceRequired = ({
  title,
  minimumQualification,
  jobDescription,
}) => (
  extractJobFilterSignals({
    title,
    minimumQualification,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || null
)

export const extractJobDetail = (payload, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  const jobId = normalizeWhitespace(detail.Id)
  if (!jobId || (listing.jobId && jobId !== listing.jobId)
    || !normalizeWhitespace(detail.Title)
    || (listing.title && normalizeWhitespace(detail.Title).toLowerCase() !== listing.title.toLowerCase())) {
    throw new Error('BNY native detail identity or title does not match its listing')
  }
  if (normalizeWhitespace(detail.PrimaryLocationCountry)?.toUpperCase() !== 'IN'
    || !/,\s*India$/i.test(detail.PrimaryLocation || '')) throw new Error('BNY native detail primary India workplace is not qualified')
  const secondary = Array.isArray(detail.secondaryLocations) ? detail.secondaryLocations : []
  if (secondary.some(location => normalizeWhitespace(location.CountryCode)?.toUpperCase() !== 'IN'
    || !/,\s*India$/i.test(location.Name || ''))) throw new Error('BNY native alternate workplace country requires review')
  if (!stripTags(detail.ExternalDescriptionStr) || stripTags(detail.ExternalDescriptionStr).length < 100) {
    throw new Error('BNY native full description is unavailable; listing teaser cannot replace criteria')
  }
  const minimumQualification =
    stripTags(detail.StudyLevel || detail.ExternalQualificationsStr)
    || listing.minimumQualification
    || null
  const jobDescription = joinDescriptionParts(
    detail.ExternalDescriptionStr,
    detail.ShortDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ExternalQualificationsStr,
  )
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : listing.sourceUrl || listing.applyUrl || null

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: 'BNY Mellon',
    department: normalizeWhitespace(detail.Department || detail.JobFunction || detail.JobFamily) || listing.department || null,
    location: [detail.PrimaryLocation, ...secondary.map(location => location.Name)].map(normalizeLocation).filter(Boolean).join(' | '),
    city: extractCity(detail.PrimaryLocation) || listing.city || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(
      detail.JobSchedule || detail.JobType || detail.WorkerType || detail.ContractType || detail.RequisitionType,
    ) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired({
      title: normalizeWhitespace(detail.Title) || listing.title || null,
      minimumQualification,
      jobDescription,
    }) || listing.experienceRequired || null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeWhitespace(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription,
  }
}

const fetchResponse = async (url, fetchImpl = fetch, signal) => {
  signal?.throwIfAborted()
  const response = await fetchImpl(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response
}

export const run = async ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchImpl = fetch,
  signal,
  onAudit,
} = {}) => {
  let requests = 0
  const getJson = async url => { requests += 1; return (await fetchResponse(url, fetchImpl, signal)).json() }
  const getText = async url => { requests += 1; return (await fetchResponse(url, fetchImpl, signal)).text() }
  const binding = async () => {
    const official = await getText(OFFICIAL_CAREERS_URL)
    const site = await getText(PUBLIC_SITE_URL)
    if (!/href=["']https:\/\/eofe\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/BNY-Careers(?:[\/"'?])/i.test(official)
      || !/data-sitenumber=["']CX_3001["']/i.test(site)
      || !/sites\/BNY-Careers/.test(site)) throw new Error('BNY official company-to-Oracle site binding changed')
  }
  await binding()
  const collect = async () => {
    const records = []
    let total = null
    let complete = false
    const seen = new Set()
    for (let page = 0; page < Math.min(maxPages, 500); page += 1) {
      const payload = await getJson(buildSearchUrl({ page }))
      const meta = payload?.items?.[0]
      const rows = getRequisitionList(payload)
      const count = Number(meta?.TotalJobsCount)
      if (!meta || meta.SiteNumber !== SITE_NUMBER || Number(meta.Offset) !== page * DEFAULT_LIMIT
        || Number(meta.Limit) !== DEFAULT_LIMIT || !Number.isInteger(count) || count < 0
        || (total !== null && count !== total)) throw new Error('BNY native listing metadata or site identity changed')
      total = count
      for (const row of rows) {
        const id = normalizeWhitespace(row.Id)
        if (!id || !normalizeWhitespace(row.Title) || seen.has(id)) throw new Error('BNY native listing identity is missing or repeated')
        seen.add(id)
        records.push(row)
      }
      if (records.length === total) { complete = true; break }
      if (records.length > total || rows.length < DEFAULT_LIMIT) break
    }
    return { records, total, complete }
  }
  const opening = await collect()
  const india = opening.records.filter(isIndiaJob)
  const candidates = maxJobs ? india.slice(0, maxJobs) : india
  const results = new Array(candidates.length)
  const failures = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      const index = cursor++
      const listing = toJob(candidates[index])
      try {
        results[index] = extractJobDetail(await getJson(buildJobDetailApiUrl(listing.jobId)), listing)
      } catch (error) {
        signal?.throwIfAborted()
        failures.push({ stage: 'native-detail', jobId: listing.jobId, message: error.message })
      }
    }
  }))
  const closing = await collect()
  await binding()
  const signature = records => JSON.stringify(records.map(row => [row.Id, row.Title, row.PrimaryLocation, row.PrimaryLocationCountry, row.secondaryLocations, row.PostedDate, row.PostingEndDate]).sort((a, b) => a[0].localeCompare(b[0])))
  const stable = opening.total === closing.total && signature(opening.records) === signature(closing.records)
  const countryQualified = opening.records.every(row => normalizeWhitespace(row.PrimaryLocationCountry)?.toUpperCase() === 'IN' && /,\s*India$/i.test(row.PrimaryLocation || ''))
  const complete = opening.complete && closing.complete && stable && countryQualified && failures.length === 0 && candidates.length === india.length
  const jobs = results.filter(Boolean).map((job) => ({
    ...job,
    source: 'bnymellon',
    link: job.applyUrl || job.sourceUrl,
    sourceDetailComplete: true,
    sourceListingComplete: complete,
    scrapedAt: new Date().toISOString(),
  }))
  const audit = { source: 'bnymellon', candidateDetails: candidates.length, extractedDetailJobs: jobs.length,
    jobs: jobs.map(job => ({ id: job.jobId })), exclusions: [], failures,
    observedListingCount: opening.records.length, observedIndiaListingCount: india.length,
    nonIndiaListingCount: opening.records.length - india.length,
    listingPaginationComplete: opening.complete && candidates.length === india.length,
    closingInventoryMatches: closing.complete && stable, sourceScopeComplete: complete,
    openingTotal: opening.total, closingTotal: closing.total, stable, countryQualified, complete }
  if (jobs.length) jobs[0].nativeCollectionEvidence = audit
  onAudit?.(audit)
  return attachInventoryEvidence(jobs, {
    status: complete ? 'complete-inventory' : 'coverage-gap', firstParty: true,
    surface: PUBLIC_SITE_URL, listingComplete: complete, pagesFetched: requests,
    reportedTotal: opening.total, indiaFacetCount: countryQualified ? india.length : null,
    verifiedAt: new Date().toISOString(), reason: complete
      ? 'declared-BNY-official-company-handoff-to-CX_3001; full-identity-bound-native-India-details; opening-and-closing-total-and-unique-role-identities-reconciled'
      : `BNY-native-inventory-gap; opening-complete:${opening.complete}; closing-complete:${closing.complete}; stable:${stable}; country-qualified:${countryQualified}; missing-details:${failures.length}; capped:${candidates.length !== india.length}`,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running BNY Mellon scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'bnymellon')
    console.log('DB result:', result)
    process.exit(0)
  }
}
