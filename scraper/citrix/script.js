import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'citrix'
export const COMPANY = 'Citrix'
export const COMPANY_DOMAIN = 'cloud.com'
export const CAREERS_URL = 'https://careers.cloud.com/jobs/search'
export const CITRIX_BRAND_UID = '52b9daa103e374ed61d42e7d1d80b7ad'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|section|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractComponentValue = (html, componentClass) =>
  normalizeWhitespace(
    extractFirst(
      new RegExp(
        `${escapeRegex(componentClass)}[\\s\\S]*?<span[^>]*>\\s*([\\s\\S]*?)\\s*<\\/span>`,
        'i',
      ),
      html,
    ),
  )

const isCitrixBrand = (value) => normalizeWhitespace(value)?.toLowerCase() === 'citrix'

const isIndiaLocation = (value) => getValidIndiaCityForJob({
  location: normalizeWhitespace(value),
  country: 'India',
}) !== null

const extractCanonicalUrl = (html) =>
  normalizeWhitespace(
    extractFirst(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, html)
      || extractFirst(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i, html),
  )

const extractStructuredJobPosting = (html) => {
  const raw = extractFirst(
    /<script type=["']application\/ld\+json["'][^>]*>\s*({[\s\S]*?})\s*<\/script>/i,
    html,
  )

  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const extractStructuredLocation = (structuredJobPosting) => {
  const address = structuredJobPosting?.jobLocation?.[0]?.address
  if (!address) return null

  const country = normalizeWhitespace(address.addressCountry)?.toUpperCase() === 'IN'
    ? 'India'
    : normalizeWhitespace(address.addressCountry)

  return normalizeWhitespace([
    address.addressLocality,
    address.addressRegion,
    country,
  ].filter(Boolean).join(', '))
}

const extractAtsRequisitionId = (html) =>
  normalizeWhitespace(
    extractFirst(/<strong>\s*Req ID:\s*<\/strong>\s*<span[^>]*>\s*([^<]+)\s*<\/span>/i, html)
      || extractFirst(/"ats_uid":"([^"]+)"/i, html),
  )

const extractDepartmentFromDataLayer = (html) =>
  normalizeWhitespace(extractFirst(/"categories":\["([^"]+)"\]/i, html))

const inferRemoteStatus = ({ structuredJobPosting, visibleRemoteStatus, location }) => {
  if (normalizeWhitespace(structuredJobPosting?.jobLocationType)?.toUpperCase() === 'TELECOMMUTE') {
    return 'Remote'
  }

  const normalizedVisible = normalizeWhitespace(visibleRemoteStatus)
  if (/^remote$/i.test(normalizedVisible || '')) return 'Remote'
  if (/^hybrid$/i.test(normalizedVisible || '')) return 'Hybrid'
  if (/^on[\s-]?site$/i.test(normalizedVisible || '')) return 'On-site'
  if (/^india$/i.test(normalizeWhitespace(location) || '')) return 'Remote'
  return 'On-site'
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const buildSearchUrl = (page = 1) => {
  const url = new URL(CAREERS_URL)
  url.searchParams.append('country_codes[]', 'IN')
  url.searchParams.append('dropdown_field_3_uids[]', CITRIX_BRAND_UID)

  if (Number.isFinite(page) && page > 1) {
    url.searchParams.set('page', String(page))
  }

  return url.toString()
}

export const hasOfficialSearchSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career Search - Cloud Software Group\s*<\/title>/i.test(page)
    && /data-controller=["'][^"']*jobs--search/i.test(page)
    && new RegExp(`name=["']country_codes\\[\\]["'][^>]+value=["']IN["']`, 'i').test(page)
    && new RegExp(
      `name=["']dropdown_field_3_uids\\[\\]["'][^>]+value=["']${escapeRegex(CITRIX_BRAND_UID)}["']`,
      'i',
    ).test(page)
    && /https:\/\/careers\.cloud\.com\/jobs\/search/i.test(page)
    && /active-filter[\s\S]*?>\s*India\s*</i.test(page)
    && /active-filter[\s\S]*?>\s*Citrix\s*</i.test(page)
}

export const extractSearchResults = (html) => {
  const cards = [...String(html ?? '').matchAll(
    /<article class="col-12 job-search-results-card-col"[\s\S]*?<\/article>/gi,
  )]

  return cards
    .map((match) => {
      const card = match[0]
      const title = normalizeWhitespace(
        extractFirst(/<a id="link_job_title_[^"]+" href="[^"]+">([\s\S]*?)<\/a>/i, card),
      )
      const sourceUrl = normalizeWhitespace(
        extractFirst(/<a id="link_job_title_[^"]+" href="([^"]+)"/i, card),
      )
      const location = extractComponentValue(card, 'job-component-location')
      const remoteStatus = extractComponentValue(card, 'job-component-workplace-type')
      const brand = extractComponentValue(card, 'job-component-dropdown-field-3')
      const department = extractComponentValue(card, 'job-component-dropdown-field-4')
      const summary = stripTags(
        extractFirst(/<p class="card-text job-search-results-summary"[^>]*>([\s\S]*?)<\/p>/i, card),
      )

      if (!title || !sourceUrl || !location || !isCitrixBrand(brand) || !isIndiaLocation(location)) {
        return null
      }

      return {
        title,
        sourceUrl,
        location,
        remoteStatus: remoteStatus || 'On-site',
        brand,
        department,
        summary,
      }
    })
    .filter(Boolean)
}

export const extractPagination = (html) => {
  const page = String(html ?? '')
  const singleEntry = page.match(/Displaying\s*<b>\s*(\d+)\s*<\/b>\s*entry/i)
  const range = page.match(
    /Displaying\s*<b>\s*(\d+)\s*(?:&nbsp;|\s)*-\s*(?:&nbsp;|\s)*(\d+)\s*<\/b>\s*of\s*<b>\s*(\d+)\s*<\/b>/i,
  )

  const displayedCount = singleEntry
    ? Number.parseInt(singleEntry[1], 10)
    : range
      ? (Number.parseInt(range[2], 10) - Number.parseInt(range[1], 10)) + 1
      : 0

  const totalCount = singleEntry
    ? Number.parseInt(singleEntry[1], 10)
    : range
      ? Number.parseInt(range[3], 10)
      : 0

  const hasDisabledNext = /class="[^"]*\bnext_page\b[^"]*\bdisabled\b/i.test(page)
  const hasNextLink = /aria-label="Next page"|class="[^"]*\bnext_page\b/i.test(page)

  return {
    displayedCount,
    totalCount,
    hasNext: hasNextLink && !hasDisabledNext,
  }
}

export const extractJobDetail = (html, { sourceUrl = null } = {}) => {
  const page = String(html ?? '')
  const structuredJobPosting = extractStructuredJobPosting(page)
  const title = normalizeWhitespace(
    extractFirst(/<h3[^>]+class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i, page)
      || structuredJobPosting?.title,
  )
  const location = normalizeWhitespace(
    extractComponentValue(page, 'job-component-location') || extractStructuredLocation(structuredJobPosting),
  )
  const visibleRemoteStatus = extractComponentValue(page, 'job-component-workplace-type')
  const remoteStatus = inferRemoteStatus({
    structuredJobPosting,
    visibleRemoteStatus,
    location,
  })
  const brand = extractComponentValue(page, 'job-component-dropdown-field-3')
  const requisitionId = extractAtsRequisitionId(page)
  const canonicalUrl = extractCanonicalUrl(page) || normalizeWhitespace(sourceUrl)

  if (!title || !location || !isCitrixBrand(brand) || !requisitionId || !canonicalUrl) {
    throw new Error('Citrix job detail page no longer matches the verified first-party detail surface')
  }

  return {
    title,
    location,
    remoteStatus,
    brand,
    department: extractDepartmentFromDataLayer(page),
    requisitionId,
    jobId: requisitionId,
    employmentType: normalizeWhitespace(structuredJobPosting?.employmentType),
    jobDescription: structuredJobPosting?.description || null,
    postingDate: normalizeWhitespace(structuredJobPosting?.datePosted),
    closingDate: normalizeWhitespace(structuredJobPosting?.validThrough),
    applyUrl: canonicalUrl,
    sourceUrl: canonicalUrl,
  }
}

export const run = async ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
  maxPages = 5,
  maxJobs = null,
} = {}) => {
  const scrapedAt = now()
  const jobs = []

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
    const searchHtml = await fetchText(buildSearchUrl(pageIndex))

    if (!hasOfficialSearchSurface(searchHtml)) {
      throw new Error('Citrix careers page no longer matches the verified official first-party India search surface')
    }

    const searchResults = extractSearchResults(searchHtml)
    const pagination = extractPagination(searchHtml)

    if (!searchResults.length) {
      if (
        pagination.totalCount === 0
        || /There are currently no jobs matching this criteria/i.test(searchHtml)
      ) {
        return []
      }

      throw new Error('Citrix careers search page no longer exposes the verified India result cards')
    }

    for (const searchResult of searchResults) {
      const detailHtml = await fetchText(searchResult.sourceUrl)
      const detail = extractJobDetail(detailHtml, { sourceUrl: searchResult.sourceUrl })
      const location = detail.location || searchResult.location
      const city = getValidIndiaCityForJob({ location, country: 'India' })

      if (!city) continue

      jobs.push({
        title: detail.title || searchResult.title,
        company: COMPANY,
        location,
        city,
        country: 'India',
        link: detail.applyUrl || searchResult.sourceUrl,
        applyUrl: detail.applyUrl || searchResult.sourceUrl,
        sourceUrl: searchResult.sourceUrl,
        source: SOURCE,
        jobId: detail.jobId,
        requisitionId: detail.requisitionId,
        department: searchResult.department || detail.department || null,
        employmentType: detail.employmentType || null,
        experienceRequired: null,
        jobDescription: detail.jobDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: detail.postingDate || null,
        closingDate: detail.closingDate || null,
        remoteStatus: detail.remoteStatus || searchResult.remoteStatus || 'On-site',
        scrapedAt,
      })

      if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) {
        return jobs.slice(0, maxJobs)
      }
    }

    if (!pagination.hasNext) break
  }

  return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
}

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
