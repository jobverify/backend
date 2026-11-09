import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { EXPERIAN_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = EXPERIAN_INDIA_CATALOG.source
export const COMPANY_NAME = EXPERIAN_INDIA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EXPERIAN_INDIA_CATALOG.officialBrandName
export const VERIFIED_AT = EXPERIAN_INDIA_CATALOG.verifiedOn
export const HOMEPAGE_URL = EXPERIAN_INDIA_CATALOG.homepageUrl
export const GLOBAL_CAREERS_URL = EXPERIAN_INDIA_CATALOG.globalCareersUrl
export const JOBS_PAGE_URL = EXPERIAN_INDIA_CATALOG.jobsPageUrl
export const VERIFIED_JOB_URL = EXPERIAN_INDIA_CATALOG.verifiedJobUrl
export const VERIFIED_APPLY_URL = EXPERIAN_INDIA_CATALOG.verifiedApplyUrl
export const INDIA_LOCATION_FILTER_ID = EXPERIAN_INDIA_CATALOG.verifiedIndiaLocationFilterId
export const VERIFIED_INDIA_LOCATION_COUNT = EXPERIAN_INDIA_CATALOG.verifiedIndiaLocationCount
export const VERIFIED_TOTAL_JOBS_COUNT = EXPERIAN_INDIA_CATALOG.verifiedTotalJobsCount
export const PROVIDER_METADATA = EXPERIAN_INDIA_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, '\'')
  .replace(/[\u2018\u2019]/g, '\'')
  .replace(/&#x2019;|&#8217;/gi, '\'')
  .replace(/&#x2013;|&#x2014;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(stripTags(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl = JOBS_PAGE_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const getCardStartIndexes = (html) => [...String(html ?? '').matchAll(/<div class="attrax-vacancy-tile\b/gi)]
  .map((match) => match.index)

const splitJobCards = (html) => {
  const pageHtml = String(html ?? '')
  const indexes = getCardStartIndexes(pageHtml)

  return indexes.map((start, index) => {
    const end = indexes[index + 1] ?? pageHtml.length
    return pageHtml.slice(start, end)
  })
}

const extractTitleAndUrl = (cardHtml) => {
  const match = /<a[^>]*class="[^"]*attrax-vacancy-tile__title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml)

  return {
    sourceUrl: toAbsoluteUrl(match?.[1]),
    title: normalizeWhitespace(match?.[2]),
  }
}

const extractLabeledValues = (html) => {
  const values = new Map()
  const pattern = /<p[^>]*class="[^"]*attrax-vacancy-tile__item-label[^"]*"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<p[^>]*class="[^"]*attrax-vacancy-tile__item-value[^"]*"[^>]*>([\s\S]*?)<\/p>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const label = normalizeWhitespace(match[1])?.toLowerCase()
    const value = normalizeWhitespace(match[2])

    if (!label || !value) continue

    const existing = values.get(label) ?? []
    existing.push(value)
    values.set(label, existing)
  }

  return values
}

const getFieldValues = (fields, ...labels) => labels.flatMap((label) => fields.get(label.toLowerCase()) ?? [])

const getFirstFieldValue = (fields, ...labels) => getFieldValues(fields, ...labels).find(Boolean) ?? null

const extractJobId = (cardHtml, sourceUrl) =>
  /data-jobid="(\d+)"/i.exec(cardHtml)?.[1]
  || /vacancyId=(\d+)/i.exec(sourceUrl ?? '')?.[1]
  || /jid-(\d+)/i.exec(sourceUrl ?? '')?.[1]
  || null

const normalizeClosingDate = (value) => {
  const normalized = normalizeWhitespace(value)

  if (!normalized) return null
  if (/^(?:0?1\/0?1\/0{3}[01]|jan\s+1,\s+0{3}[01])$/i.test(normalized)) return null

  return normalized
}

const locationImpliesIndia = (value) => /\bindia\b/i.test(value ?? '')

const getNormalizedLocation = (fields, cardHtml, sourceUrl) => {
  const locationValues = getFieldValues(fields, 'location')
  const location = locationValues.find(locationImpliesIndia)
    || locationValues[0]
    || null

  if (!location) return { location: null, city: null }

  const normalizedLocation = locationImpliesIndia(location) || !/attrax-vacancy-tile--india\b/i.test(cardHtml)
    ? location
    : `${location}, India`
  const cityToken = normalizedLocation.split(',')[0]

  return {
    location: normalizedLocation,
    city: normalizeCity(cityToken) || normalizeWhitespace(cityToken),
    sourceUrl,
  }
}

const isIndiaCard = (cardHtml, location, sourceUrl) =>
  /attrax-vacancy-tile--india\b/i.test(cardHtml)
  || locationImpliesIndia(location)
  || /-india-jid-\d+/i.test(sourceUrl ?? '')

const extractDescriptionWidgetHtml = (html) => {
  const pageHtml = String(html ?? '')
  const markerIndex = pageHtml.indexOf('description-widget')
  if (markerIndex === -1) return null

  const start = pageHtml.lastIndexOf('<div', markerIndex)
  const tail = pageHtml.slice(start === -1 ? markerIndex : start)
  const nextScriptIndex = tail.search(/<script\b/i)

  return nextScriptIndex === -1 ? tail : tail.slice(0, nextScriptIndex)
}

const extractQualificationsSectionHtml = (html) => {
  const descriptionWidgetHtml = extractDescriptionWidgetHtml(html)
  if (!descriptionWidgetHtml) return null

  const markerIndex = descriptionWidgetHtml.indexOf('jobad-qualifications')
  if (markerIndex === -1) return null

  const nextSectionIndex = descriptionWidgetHtml.indexOf('jobad-companydescription', markerIndex)
  return nextSectionIndex === -1
    ? descriptionWidgetHtml.slice(markerIndex)
    : descriptionWidgetHtml.slice(markerIndex, nextSectionIndex)
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractDetailOptions = (html) => {
  const values = new Map()
  const pattern = /<li class="([A-Za-z]+)-wrapper">[\s\S]*?<label class="[^"]+">[\s\S]*?<\/label>\s*([\s\S]*?)\s*<\/li>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const key = normalizeWhitespace(match[1])?.toLowerCase()
    const value = normalizeWhitespace(match[2])

    if (!key || !value) continue
    values.set(key, value)
  }

  return values
}

export const buildJobsPageUrl = (page = 1) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  return normalizedPage === 1 ? JOBS_PAGE_URL : `${JOBS_PAGE_URL}?page=${normalizedPage}`
}

export const extractIndiaLocationFilter = (html) => {
  const match = /data-option-id=['"](\d+)['"][^>]*>\s*<span class=['"]filter-contents['"][^>]*aria-label=['"]India['"][^>]*>[\s\S]*?<span class=['"]filter-text['"]>\s*India\s*<\/span>\s*<span class=['"]filter-count['"]>\((\d+)\)<\/span>/i.exec(String(html ?? ''))

  if (!match) return null

  return {
    id: match[1],
    count: Number.parseInt(match[2], 10),
  }
}

export const extractTotalResults = (html) => {
  const match = /attrax-pagination__total-results-hero">\s*(\d+)\s+Jobs\s*<\/span>/i.exec(String(html ?? ''))
    || /<strong>\s*(\d+)\s*<\/strong>\s*roles available/i.exec(String(html ?? ''))

  return match ? Number.parseInt(match[1], 10) : null
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const indiaFilter = extractIndiaLocationFilter(page)

  return /<title>\s*Search Jobs\s*\|\s*Experian\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.experian\.com\/careers["']/i.test(page)
    && /attrax-vacancy-tile/i.test(page)
    && /attrax-pagination__total-results-hero|roles available/i.test(page)
    && indiaFilter?.id === INDIA_LOCATION_FILTER_ID
}

export const hasOfficialDetailPageSignal = (html) => {
  const page = String(html ?? '')

  return /job in [^<]+ \|\s*Experian/i.test(page)
    && /jobApplyBtn/i.test(page)
    && /\/Workflow\?workflowId=/i.test(page)
    && /description-widget/i.test(page)
    && /jobad-qualifications/i.test(page)
}

export const extractTotalPages = (html) => {
  const pageNumbers = [...String(html ?? '').matchAll(/pagination\((\d+)\)|(?:\?|&)page=(\d+)/gi)]
    .map((match) => Number.parseInt(match[1] || match[2], 10))
    .filter(Number.isFinite)

  if (!pageNumbers.length) {
    return splitJobCards(html).length ? 1 : 0
  }

  return Math.max(...pageNumbers)
}

export const extractSearchResults = (html) => splitJobCards(html)
  .map((cardHtml) => {
    const { title, sourceUrl } = extractTitleAndUrl(cardHtml)
    const fields = extractLabeledValues(cardHtml)
    const { location, city } = getNormalizedLocation(fields, cardHtml, sourceUrl)
    const jobId = extractJobId(cardHtml, sourceUrl)

    if (!isIndiaCard(cardHtml, location, sourceUrl)) return null
    if (!title || !sourceUrl || !location || !city || !jobId) return null

    return {
      title,
      company: COMPANY_NAME,
      department: getFirstFieldValue(fields, 'department', 'job family'),
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: getFirstFieldValue(fields, 'reference', 'requisition id', 'req id') || jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: getFirstFieldValue(fields, 'employment', 'job type', 'type of contract', 'schedule'),
      experienceRequired: getFirstFieldValue(fields, 'experience level', 'experience'),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: normalizeClosingDate(getFirstFieldValue(fields, 'expiry date', 'closing date')),
      jobDescription: getFirstFieldValue(fields, 'description'),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const detailOptions = extractDetailOptions(html)
  const qualificationItems = extractListItems(extractQualificationsSectionHtml(html))

  return {
    ...listing,
    location: detailOptions.get('location')
      ? `${normalizeWhitespace(detailOptions.get('location'))}, India`
      : listing.location,
    city: detailOptions.get('location')
      ? normalizeCity(normalizeWhitespace(detailOptions.get('location'))) || normalizeWhitespace(detailOptions.get('location'))
      : listing.city,
    department: detailOptions.get('department') || listing.department,
    employmentType: detailOptions.get('employment') || listing.employmentType,
    applyUrl: toAbsoluteUrl(
      /<a[^>]*class="[^"]*jobApplyBtn[^"]*"[^>]*href="([^"]+)"/i.exec(html)?.[1],
      JOBS_PAGE_URL,
    ) || listing.applyUrl,
    minimumQualification: qualificationItems[0] || listing.minimumQualification || null,
    requiredSkills: qualificationItems.length ? qualificationItems : listing.requiredSkills || [],
    jobDescription: normalizeWhitespace(extractDescriptionWidgetHtml(html)) || listing.jobDescription || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  label: SOURCE,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  timeoutMs: 15000,
})

export const createExperianIndiaScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: overrideFetchText, now: overrideNow } = {}) {
    const fetcher = overrideFetchText || fetchText
    const getTimestamp = overrideNow || now

    const firstPageHtml = await fetcher(JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(firstPageHtml)) {
      throw new Error('Experian India verified jobs page no longer matches the trusted first-party Attrax surface')
    }

    const indiaFilter = extractIndiaLocationFilter(firstPageHtml)
    if (!indiaFilter || indiaFilter.id !== INDIA_LOCATION_FILTER_ID) {
      throw new Error('Experian India verified jobs page no longer exposes the trusted India location filter')
    }

    const totalPages = extractTotalPages(firstPageHtml)
    const pageLimit = Math.min(totalPages || 1, maxPages)
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= pageLimit; page += 1) {
      const pageHtml = page === 1 ? firstPageHtml : await fetcher(buildJobsPageUrl(page))

      if (!hasOfficialJobsPageSignal(pageHtml)) {
        throw new Error(`Experian India verified jobs page ${page} no longer matches the trusted first-party Attrax surface`)
      }

      const listings = extractSearchResults(pageHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let job = listing

        try {
          const detailHtml = await fetcher(listing.sourceUrl)
          if (hasOfficialDetailPageSignal(detailHtml)) {
            job = extractJobDetail(detailHtml, listing)
          }
        } catch {
          job = listing
        }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: getTimestamp(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createExperianIndiaScraper(options).run(options)

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
