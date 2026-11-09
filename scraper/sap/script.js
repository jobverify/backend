import path from 'path'
import { fileURLToPath } from 'url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { inferMissingExperienceRequired } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.sap.com'
const DEFAULT_LOCATION = 'India'
const DEFAULT_LOCALE = 'en_US'
const PAGE_SIZE = 25

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractBalancedElementInnerHtml = (html, openingMatch) => {
  if (!openingMatch) return null

  const tagName = String(openingMatch[1] || '').toLowerCase()
  if (!tagName) return null

  const source = String(html ?? '')
  const startIndex = openingMatch.index + openingMatch[0].length
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = startIndex

  let depth = 1
  let match

  while ((match = tagPattern.exec(source))) {
    if (/^<\//.test(match[0])) {
      depth -= 1
    } else if (!/\/>\s*$/i.test(match[0])) {
      depth += 1
    }

    if (depth === 0) {
      return source.slice(startIndex, match.index)
    }
  }

  return null
}

const extractElementInnerHtmlByClass = (html, className) => {
  const pattern = new RegExp(
    `<(div|span)\\b[^>]*class=(["'])[^"']*\\b${escapeRegex(className)}\\b[^"']*\\2[^>]*>`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  return extractBalancedElementInnerHtml(html, match)
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCityFromLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const INDIAN_REGION = /^(?:AP|AR|AS|BR|CG|CH|DL|GA|GJ|HR|HP|JK|JH|KA|KL|LD|MP|MH|MN|ML|MZ|NL|OD|OR|PB|PY|RJ|SK|TN|TS|TR|UP|UK|UT|WB|AN|DN|DD|LA|Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Chandigarh|Delhi|New Delhi|Goa|Gujarat|Haryana|Himachal Pradesh|Jammu and Kashmir|Jharkhand|Karnataka|Kerala|Lakshadweep|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Orissa|Punjab|Puducherry|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar Islands|Dadra and Nagar Haveli|Daman and Diu|Ladakh)$/i
const countryFromLocation = (value) => {
  const parts = (stripTags(value) || '').split(',').map(x => x.trim())
  if (/^\d{6}$/.test(parts.at(-1))) parts.pop()
  if (!/^(?:IN|India)$/i.test(parts.pop() || '')) return null
  if (!parts[0] || parts.length > 2 || (parts.length === 2 && !INDIAN_REGION.test(parts[1]))) return null
  return 'India'
}
const normalizeSearchLocation = (value) => {
  const normalized = stripTags(value)
  return countryFromLocation(normalized) === 'India'
    ? extractCityFromLocation(normalized) + ', India'
    : normalized
}
const normalizeDetailLocation = normalizeSearchLocation

const extractListingJobId = (href) => normalizeWhitespace(
  extractFirst(/\/(\d+)\/?$/i, decodeHtmlEntities(href)),
)

const parsePostedDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeDescription = (value) => stripTags(value)
  ?.replace(/\s*\|\s*/g, ' | ')
  ?.replace(/\s+([|])/g, ' $1')
  ?.replace(/([|])\s+/g, '$1 ')
  ?? null

export const buildSearchUrl = ({
  startRow = 0,
  location = DEFAULT_LOCATION,
  locale = DEFAULT_LOCALE,
} = {}) => {
  const url = new URL('/search/', BASE_URL)
  url.searchParams.set('q', '')
  url.searchParams.set('locationsearch', location)
  url.searchParams.set('locale', locale)

  if (Number(startRow) > 0) {
    url.searchParams.set('startrow', String(Number(startRow)))
  }

  return url.toString()
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<tr class="data-row">([\s\S]*?)<\/tr>/gi,
)]
  .map((match) => {
    const rowHtml = match[1]
    const href = extractFirst(/<a href="([^"]+)" class="jobTitle-link">/i, rowHtml)
    const title = normalizeWhitespace(extractFirst(/<a [^>]*class="jobTitle-link">([\s\S]*?)<\/a>/i, rowHtml))
    const rawLocation = normalizeWhitespace(
      extractFirst(/<td class="colLocation[\s\S]*?<span class="jobLocation">([\s\S]*?)<\/span>/i, rowHtml),
    )
    const sourceUrl = toAbsoluteUrl(href)
    const jobId = extractListingJobId(href)

    if (!title || !rawLocation || !sourceUrl || !jobId) return null

    return {
      title,
      location: normalizeSearchLocation(rawLocation),
      city: extractCityFromLocation(rawLocation),
      country: countryFromLocation(rawLocation),
      rawLocation,
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const totalJobCount = Number.parseInt(
    extractFirst(/Results\s*<b>\d+\s*[–-]\s*\d+<\/b>\s*of\s*<b>(\d+)<\/b>/i, html) || '',
    10,
  )

  const pageRangeMatch = /Results\s*<b>(\d+)\s*[–-]\s*(\d+)<\/b>/i.exec(String(html))
  const pageSize = pageRangeMatch
    ? Number.parseInt(pageRangeMatch[2], 10) - Number.parseInt(pageRangeMatch[1], 10) + 1
    : null

  return {
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
    pageSize: Number.isFinite(pageSize) ? pageSize : null,
    firstRow: pageRangeMatch ? Number(pageRangeMatch[1]) : null,
    lastRow: pageRangeMatch ? Number(pageRangeMatch[2]) : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const rawLocation = stripTags(extractFirst(
    /<p id="job-location"[\s\S]*?<span class="jobGeoLocation">([\s\S]*?)<\/span>/i,
    html,
  ))
  const location = normalizeDetailLocation(rawLocation)
  const requisitionId = normalizeWhitespace(extractFirst(
    /data-careersite-propertyid="facility"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )) || listing.requisitionId || listing.jobId || null
  const postingDate = parsePostedDate(extractFirst(
    /data-careersite-propertyid="date"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )) || listing.postingDate || null
  const department = normalizeWhitespace(extractFirst(
    /data-careersite-propertyid="department"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const employmentType = normalizeWhitespace(extractFirst(
    /data-careersite-propertyid="shifttype"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const descriptionHtml = extractElementInnerHtmlByClass(html, 'jobdescription')
    || extractFirst(/<div class="jobdescription">([\s\S]*?)<\/div>\s*<div class="applylink/i, html)
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a[^>]+class="[^"]*applybutton[^"]*"[^>]+href="([^"]+)"/i, html)
      || extractFirst(/<a[^>]+href="([^"]+)"[^>]*>\s*Apply now/i, html),
  )
  const jobDescription = normalizeDescription(descriptionHtml)
  const experienceRequired = inferMissingExperienceRequired(
    {
      title: listing.title,
      jobDescription,
      description: jobDescription,
    },
    null,
    extractJobFilterSignals({
      title: listing.title,
      jobDescription,
      description: jobDescription,
    }).experienceProfile,
  )

  return {
    title: stripTags(extractFirst(/<h1>([\s\S]*?)<\/h1>/i, html)) || listing.title || null,
    location,
    country: countryFromLocation(rawLocation),
    rawLocation,
    city: extractCityFromLocation(location) || listing.city || null,
    jobId: requisitionId,
    requisitionId,
    employmentType,
    experienceRequired,
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
    department,
  }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  return { status: response.status, url: response.url, html: await response.text() }
}

const requirePage = async (url, fetchPage, signal) => {
  signal?.throwIfAborted()
  const page = await fetchPage(url, { signal })
  signal?.throwIfAborted()
  if (page.status !== 200) throw new Error('HTTP ' + page.status + ' for ' + url)
  let finalUrl
  try { finalUrl = new URL(page.url) } catch { throw new Error('SAP invalid public response URL') }
  const expectedUrl = new URL(url)
  const queryEntries = (value) => JSON.stringify([...value.searchParams.entries()].sort((a,b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])))
  if (finalUrl.origin !== BASE_URL || finalUrl.pathname !== expectedUrl.pathname || queryEntries(finalUrl) !== queryEntries(expectedUrl)) {
    throw new Error('SAP public page redirected off the verified employer route')
  }
  const canonical = extractFirst(/<link\b(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i, page.html)
  if (!canonical || new URL(decodeHtmlEntities(canonical), BASE_URL).origin !== BASE_URL || new URL(decodeHtmlEntities(canonical), BASE_URL).pathname !== finalUrl.pathname) {
    throw new Error('SAP public page canonical identity changed')
  }
  if (!/<title[^>]*>[^<]*\bSAP\b[^<]*<\/title>/i.test(page.html)) throw new Error('SAP employer identity changed')
  return page.html
}

const requireListing = (html, startRow, expectedTotal = null) => {
  const summary = extractPaginationSummary(html)
  const listings = extractSearchResults(html)
  const rawRows = [...String(html).matchAll(/<tr class="data-row">/gi)].length
  if (!/id=["']searchresults["']/i.test(html)
    || !Number.isInteger(summary.totalJobCount) || summary.totalJobCount < 1
    || summary.firstRow !== startRow + 1 || summary.lastRow > summary.totalJobCount
    || summary.pageSize !== listings.length || listings.length !== rawRows || !listings.length
    || (expectedTotal !== null && summary.totalJobCount !== expectedTotal)) {
    throw new Error('SAP native listing count, range or row contract changed; no authoritative empty inventory')
  }
  for (const listing of listings) {
    if (!Number.isSafeInteger(Number(listing.jobId)) || String(Number(listing.jobId)) !== listing.jobId) throw new Error('SAP noncanonical native posting ID alias')
    const url = new URL(listing.sourceUrl)
    if (url.origin !== BASE_URL || !/^\/job\/.+\/\d+\/$/.test(url.pathname) || listing.country !== 'India') {
      throw new Error('SAP listing lacks explicit India country or native employer identity')
    }
  }
  return { summary, listings }
}

export const run = async ({ fetchPage = defaultFetchPage, signal, now = () => new Date().toISOString(), maxPages = config.maxPages, maxJobs } = {}) => {
  signal?.throwIfAborted()
  for (const cap of [maxPages, maxJobs]) {
    if (cap != null && (!Number.isInteger(cap) || cap < 1)) throw new Error('SAP caller caps must be positive integers')
  }
  const pageLimit = Number.isInteger(maxPages) && maxPages > 0 ? maxPages : Infinity
  const jobLimit = Number.isInteger(maxJobs) && maxJobs > 0 ? maxJobs : Infinity
  const listings = []
  const seenIds = new Set()
  let total = null, startRow = 0, pagesFetched = 0, firstIds = null
  for (let page = 0; page < pageLimit; page++) {
    const html = await requirePage(buildSearchUrl({ startRow }), fetchPage, signal)
    const current = requireListing(html, startRow, total)
    total = current.summary.totalJobCount
    if (firstIds === null) firstIds = current.listings.map(x => x.jobId)
    for (const listing of current.listings) {
      if (seenIds.has(listing.jobId)) throw new Error('SAP duplicate native posting ID across listing pages')
      seenIds.add(listing.jobId)
      listings.push(listing)
    }
    pagesFetched++
    startRow = current.summary.lastRow
    if (startRow === total) break
  }
  const capped = listings.length < total || listings.length > jobLimit
  if (startRow === total && listings.length !== total) throw new Error('SAP inventory count disagrees with unique native postings')
  const jobs = [], seenRequisitions = new Set()
  let filledCount = 0
  for (const listing of listings.slice(0, jobLimit)) {
    const html = await requirePage(listing.sourceUrl, fetchPage, signal)
    const detail = extractJobDetail(html, listing)
    const nativeJobContent = extractElementInnerHtmlByClass(html, 'job') || ''
    if (!detail.jobDescription && /<p\b[^>]*>\s*<strong\b[^>]*>\s*Sorry, this position has been filled\.\s*<\/strong>\s*<\/p>/i.test(nativeJobContent)) {
      filledCount++
      continue
    }
    const nativeRequisition = stripTags(extractFirst(/data-careersite-propertyid=["']facility["'][^>]*>([\s\S]*?)<\/span>/i, html))
    const nativeTitle = stripTags(extractFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html))
    if (!nativeTitle || nativeTitle !== listing.title || detail.country !== 'India' || detail.city !== listing.city || detail.title !== listing.title
      || !/^\d+$/.test(nativeRequisition || '') || nativeRequisition !== detail.requisitionId || !detail.jobDescription || detail.jobDescription.length < 200
      || !/\bSAP\b/i.test(detail.jobDescription) || !detail.applyUrl) {
      throw new Error('SAP native detail title, employer, country, identity or full description changed')
    }
    const applyUrl = new URL(detail.applyUrl)
    if (applyUrl.origin !== BASE_URL || applyUrl.pathname !== '/talentcommunity/apply/' + listing.jobId + '/') {
      throw new Error('SAP native application route conflicts with posting identity')
    }
    if (seenRequisitions.has(detail.requisitionId)) throw new Error('SAP duplicate native requisition ID')
    seenRequisitions.add(detail.requisitionId)
    jobs.push({
      ...detail, company: 'SAP', country: 'India', source: 'sap', link: detail.applyUrl,
      scrapedAt: now(), sourceListingComplete: false,
      sourceListingIncompleteReason: 'SAP publishes roles across parallel recruiting platforms; the new jobs.sap.com platform is not covered.'
        + (capped ? ' Caller cap also limits this observed inventory.' : ''),
    })
  }
  const snapshot = requireListing(await requirePage(buildSearchUrl(), fetchPage, signal), 0, total)
  if (snapshot.listings.map(x => x.jobId).join(',') !== firstIds.join(',')) throw new Error('SAP native first-page snapshot changed during detail collection')
  return attachInventoryEvidence(jobs, {
    status: 'coverage-gap', surface: buildSearchUrl(), firstParty: true, listingComplete: false,
    pagesFetched, reportedTotal: total, indiaFacetCount: null, verifiedAt: now(),
    reason: 'The careers.sap.com India inventory was observed with native full descriptions, but SAP publishes a parallel new recruiting platform at jobs.sap.com that is not covered.'
      + (capped ? ' Caller cap limits the observed inventory.' : '')
      + (filledCount ? ' Native detail explicitly marked ' + filledCount + ' listed posting(s) filled; these were excluded.' : ''),
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running SAP scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'sap')
    console.log('DB result:', result)
    process.exit(0)
  }
}
