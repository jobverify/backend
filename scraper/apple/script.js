import path from 'path'
import { fileURLToPath } from 'url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://jobs.apple.com/en-in/search?location=india-INDC'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDescription = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractHydrationPayload = (html) => {
  const document = String(html ?? '')
  const marker = 'window.__staticRouterHydrationData = JSON.parse("'
  const start = document.indexOf(marker)

  if (start === -1) {
    throw new Error('Apple hydration payload marker not found')
  }

  let encoded = ''
  let slashCount = 0

  for (let index = start + marker.length; index < document.length; index += 1) {
    const char = document[index]

    if (char === '\\') {
      slashCount += 1
      encoded += char
      continue
    }

    if (char === '"' && slashCount % 2 === 0) {
      break
    }

    slashCount = 0
    encoded += char
  }

  return JSON.parse(JSON.parse(`"${encoded}"`))
}

const buildMergedDescription = (...parts) => {
  const normalizedParts = parts
    .map((value) => normalizeDescription(value))
    .filter(Boolean)

  return normalizedParts.length > 0 ? normalizedParts.join('\n\n') : null
}

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length)
  const limit = Math.max(1, Number(concurrency) || 1)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )

  return results
}

const formatLocationEntry = (location) => {
  if (!location || typeof location !== 'object') return null

  const primary = normalizeWhitespace(
    location.name
      || location.city
      || location.metro
      || location.region
      || location.stateProvince
      || location.countryName,
  )
  const country = normalizeWhitespace(location.countryName)

  if (!primary) return country
  if (!country || primary.toLowerCase() === country.toLowerCase()) return primary

  return `${primary}, ${country}`
}

const extractCity = (locations) => {
  for (const location of Array.isArray(locations) ? locations : []) {
    const explicitCity = normalizeWhitespace(location?.city || location?.metro)
    if (explicitCity) return explicitCity

    const name = normalizeWhitespace(location?.name)
    const country = normalizeWhitespace(location?.countryName)
    if (name && (!country || name.toLowerCase() !== country.toLowerCase())) {
      return name
    }
  }

  return null
}

const buildDetailUrl = (job) => {
  const defaultDetailId = normalizeWhitespace(job?.reqId || job?.id || job?.positionId)
  const positionId = normalizeWhitespace(job?.positionId)
  const detailId = job?.type === 'PIPE' && positionId
    ? positionId
    : defaultDetailId
  const titleSlug = normalizeWhitespace(job?.transformedPostingTitle) || slugify(job?.postingTitle)

  if (!detailId || !titleSlug) return null

  const url = new URL(`/en-in/details/${detailId}/${titleSlug}`, 'https://jobs.apple.com')
  const teamCode = normalizeWhitespace(job?.team?.teamCode)
  if (teamCode) {
    url.searchParams.set('team', teamCode)
  }
  return url.toString()
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(CAREER_PAGE_URL)
  const pageNumber = Math.max(1, Number(page) || 1)

  if (pageNumber > 1) {
    url.searchParams.set('page', String(pageNumber))
  }

  return url.toString()
}

export const extractPaginationSummary = (html) => {
  const search = extractHydrationPayload(html)?.loaderData?.search ?? {}
  const page = Math.max(1, Number(search.page) || 1)
  const pageSize = Array.isArray(search.searchResults) ? search.searchResults.length : 0
  const totalRecords = Number(search.totalRecords) || 0
  const totalPages = pageSize > 0 ? Math.ceil(totalRecords / pageSize) : 0

  return {
    page,
    pageSize,
    totalRecords,
    totalPages,
    hasNext: totalPages > 0 ? page < totalPages : false,
  }
}

export const extractSearchResults = (html) => {
  const search = extractHydrationPayload(html)?.loaderData?.search ?? {}
  const listings = Array.isArray(search.searchResults) ? search.searchResults : []

  return listings.map((job) => {
    const formattedLocations = [...new Set(
      (Array.isArray(job.locations) ? job.locations : [])
        .map((location) => formatLocationEntry(location))
        .filter(Boolean),
    )]
    const sourceUrl = buildDetailUrl(job)
    const requisitionId = normalizeWhitespace(job.reqId || job.positionId)

    if (!sourceUrl || !requisitionId) {
      return null
    }

    return {
      title: normalizeWhitespace(job.postingTitle),
      company: 'Apple',
      department: normalizeWhitespace(job.team?.teamName),
      location: formattedLocations.join(' | ') || null,
      city: extractCity(job.locations),
      jobId: requisitionId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job.postingDate),
      closingDate: null,
      jobDescription: normalizeDescription(job.jobSummary),
    }
  }).filter(Boolean)
}

export const extractJobDetail = (html) => {
  const jobsData = extractHydrationPayload(html)?.loaderData?.jobDetails?.jobsData ?? {}
  const localizedPosting = jobsData?.localizations?.en_US?.posting ?? {}
  const minimumQualification = normalizeDescription(
    localizedPosting.minimumQualifications || jobsData.minimumQualifications,
  )
  const preferredQualification = normalizeDescription(
    localizedPosting.preferredQualifications || jobsData.preferredQualifications,
  )
  const jobDescription = buildMergedDescription(
    localizedPosting.jobSummary || jobsData.jobSummary,
    localizedPosting.description || jobsData.description,
    localizedPosting.responsibilities || jobsData.responsibilities,
  )
  const { experienceProfile } = extractJobFilterSignals({
    minimumQualification,
    preferredQualification,
    jobDescription,
  })

  return {
    minimumQualification,
    preferredQualification,
    experienceRequired: experienceProfile?.confidence === 'high'
      ? normalizeWhitespace(experienceProfile.evidence)
      : null,
    jobDescription,
  }
}

const detailIdentityMatches = (job, detail) => {
  const reqId = normalizeWhitespace(detail?.reqId)
  const id = normalizeWhitespace(detail?.id)
  const position = normalizeWhitespace(detail?.positionId)
  const jobNumber = normalizeWhitespace(detail?.jobNumber)
  if (reqId && id && reqId !== id) return false
  const declared = new Set([reqId, id, jobNumber].filter(Boolean))
  const locations = Array.isArray(detail?.locations) ? detail.locations : []
  if (locations.length && !locations.some(location => /^india$/i.test(normalizeWhitespace(location.countryName) || ''))) return false
  const localized = new Set()
  if (position) {
    for (const internal of [reqId, id].filter(Boolean)) {
      const typed = internal.match(/^(?:PIPE|REQ)-(.+)$/)
      if (typed && typed[1] !== position) return false
    }
    for (const location of locations) {
      const posting = normalizeWhitespace(location?.postingIdentifier)
      if (posting && /^india$/i.test(normalizeWhitespace(location.countryName) || '')) localized.add(`${position}-${posting}`)
    }
    if (jobNumber && jobNumber !== position && !localized.has(jobNumber)) return false
  }
  // These aliases are published by this role's own native detail. Never strip
  // arbitrary locale suffixes or infer identity from a similar title.
  return declared.has(job.jobId) || localized.has(job.jobId)
}

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createAppleScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  detailConcurrency = Number.isInteger(config.detailConcurrency) ? config.detailConcurrency : 8,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const { signal } = options
    signal?.throwIfAborted()
    const jobs = []
    const seenJobIds = new Set()
    const openingRoles = new Map()
    const incomplete = new Set()
    let reportedTotal = null
    let pagesFetched = 0
    let listingPages = 0
    const identity = job => JSON.stringify([job.title, job.location, job.sourceUrl])
    const readPage = async page => {
      signal?.throwIfAborted()
      const html = await fetchText(buildSearchUrl({ page }), { signal })
      signal?.throwIfAborted()
      pagesFetched++
      const search = extractHydrationPayload(html)?.loaderData?.search
      const total = Number(search?.totalRecords)
      if (!search || !Array.isArray(search.searchResults) || search.totalRecords == null
        || search.totalRecords === '' || !Number.isSafeInteger(total) || total < 0) {
        throw new Error('Apple search inventory envelope is missing or invalid')
      }
      const listings = extractSearchResults(html)
      if (listings.length !== search.searchResults.length || listings.some(job => !job.title)) incomplete.add('unmapped-native-listing')
      if (search.searchResults.some(job => !Array.isArray(job.locations) || !job.locations.length
        || job.locations.some(location => !normalizeWhitespace(location?.countryName)))) incomplete.add('native-country-unavailable')
      if (search.searchResults.some(job => !Array.isArray(job.locations)
        || !job.locations.some(location => /^india$/i.test(normalizeWhitespace(location?.countryName) || '')))) {
        incomplete.add('native-india-filter-scope-unverified')
      }
      return { listings, total, summary: extractPaginationSummary(html) }
    }

    for (let page = 1; page <= maxPages; page += 1) {
      const { listings, total, summary } = await readPage(page)
      listingPages++
      if (reportedTotal === null) reportedTotal = total
      else if (total !== reportedTotal) incomplete.add('native-total-changed')
      const freshListings = []

      for (const job of listings) {
        if (seenJobIds.has(job.jobId)) {
          incomplete.add('duplicate-native-listing')
          continue
        }
        seenJobIds.add(job.jobId)
        openingRoles.set(job.jobId, identity(job))
        freshListings.push(job)
      }

      const remainingJobs = maxJobs == null
        ? freshListings.length
        : Math.max(0, maxJobs - jobs.length)
      const selectedListings = freshListings.slice(0, remainingJobs)
      const hydratedJobs = await mapWithConcurrency(
        selectedListings,
        detailConcurrency,
        async (job) => {
          signal?.throwIfAborted()
          try {
            const detailHtml = await fetchText(job.sourceUrl, { signal })
            signal?.throwIfAborted()
            const nativeDetail = extractHydrationPayload(detailHtml)?.loaderData?.jobDetails?.jobsData
            const identityMatches = detailIdentityMatches(job, nativeDetail)
            if (!identityMatches) throw new Error('Apple detail role identity changed or is unavailable')
            if (nativeDetail?.postingTitle && normalizeWhitespace(nativeDetail.postingTitle) !== job.title) throw new Error('Apple detail role title changed')
            const detail = extractJobDetail(detailHtml)
            const sourceDetailComplete = hasSourceDescription(detail)
            return { ...job, ...detail, jobDescription: detail.jobDescription || null,
              source: 'apple', link: job.applyUrl || job.sourceUrl, scrapedAt: new Date().toISOString(),
              sourceDetailComplete, ...(!sourceDetailComplete ? { sourceDetailFailureKind: 'native-detail-content-unavailable',
                sourceNativeListingDescription: job.jobDescription, preserveExistingSourceContent: true } : {}) }
          } catch (error) {
            signal?.throwIfAborted()
            return { ...job, jobDescription: null, sourceNativeListingDescription: job.jobDescription,
              preserveExistingSourceContent: true, source: 'apple', link: job.applyUrl || job.sourceUrl,
              scrapedAt: new Date().toISOString(), sourceDetailComplete: false,
              sourceDetailFailureKind: 'native-detail-unavailable' }
          }
        },
      )

      jobs.push(...hydratedJobs)

      if (maxJobs && jobs.length >= maxJobs) break

      // The last page is shorter; dividing the total by its row count would
      // invent additional pages. The native total and unique IDs bound this run.
      if (seenJobIds.size >= reportedTotal || !summary.hasNext || !freshListings.length) break
    }

    if (reportedTotal == null || seenJobIds.size !== reportedTotal || jobs.length !== reportedTotal) incomplete.add('listing-cap-or-count-mismatch')
    if (jobs.some(job => job.sourceDetailComplete !== true)) incomplete.add('native-detail-incomplete')
    // An empty result still needs an independently verified India filter. Do
    // not promote an unexplained empty search into authoritative zero jobs.
    if (reportedTotal === 0) incomplete.add('empty-native-india-filter-unverified')
    if (!incomplete.size) {
      try {
        const closing = new Map()
        for (let page = 1; page <= listingPages; page++) {
          const frame = await readPage(page)
          if (frame.total !== reportedTotal) incomplete.add('closing-total-changed')
          for (const job of frame.listings) {
            if (closing.has(job.jobId)) incomplete.add('duplicate-closing-role')
            closing.set(job.jobId, identity(job))
          }
        }
        if (closing.size !== openingRoles.size || [...openingRoles].some(([id, value]) => closing.get(id) !== value)) incomplete.add('closing-inventory-changed')
      } catch (error) {
        signal?.throwIfAborted()
        incomplete.add('closing-inventory-unavailable')
      }
    }
    const listingComplete = incomplete.size === 0
    if (!listingComplete) for (const job of jobs) job.sourceListingComplete = false
    return attachInventoryEvidence(jobs, {
      status: listingComplete ? 'complete-inventory' : 'discovery-only', surface: CAREER_PAGE_URL,
      firstParty: true, listingComplete, pagesFetched, reportedTotal,
      indiaFacetCount: listingComplete ? jobs.filter(job => /\bindia\b/i.test(job.location || '')).length : null,
      verifiedAt: new Date().toISOString(), reason: listingComplete
        ? 'apple-native-pagination-details-and-closing-inventory-reconciled'
        : `apple-inventory-incomplete:${[...incomplete].join(';')}`,
    })
  },
})

export const run = async (options = {}) => createAppleScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Apple scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'apple')
    console.log('DB result:', result)
    process.exit(0)
  }
}
