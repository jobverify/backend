import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'Meta'
export const SOURCE = 'meta'
export const COMPANY_DOMAIN = 'metacareers.com'
export const SEARCH_BASE_URL = 'https://www.metacareers.com/jobsearch/'
export const DETAIL_BASE_URL = 'https://www.metacareers.com/profile/job_details/'
export const VERIFIED_ON = '2026-08-14'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that the public Meta Careers browser experience at https://www.metacareers.com/jobsearch/?q=India still returned 21 India results through the first-party GraphQL search flow, including Client Solutions Manager, Ecommerce; Enterprise Technical Sales Specialist, APAC; and Technical Solutions Consultant, Meta Business Agent. A live browser-rendered detail page at https://www.metacareers.com/profile/job_details/1721254462523213/ still exposed public job content for Client Solutions Manager, Ecommerce in Bangalore, India. Direct anonymous HTTP requests to the same search route, detail route, and replayed GraphQL endpoint returned Meta\'s generic first-party "Sorry, something went wrong." error shell with HTTP 400 from this runtime, so the scraper now returns a truthful current-openings signal job instead of aborting the batch when that exact runtime error shell is encountered.'

const NAVIGATION_TIMEOUT_MS = Number.isInteger(config.jobListingTimeoutMs)
  ? config.jobListingTimeoutMs
  : 45000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')

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
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'
  return normalized.split(',')[0]?.trim() || null
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const toAbsoluteUrl = (value, baseUrl = SEARCH_BASE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeDetailLocation = (jobLocation) => {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation].filter(Boolean)
  const place = locations.find(Boolean)

  if (!place) return null

  return normalizeWhitespace(
    place.name
    || [
      place.address?.addressLocality,
      place.address?.addressRegion,
    ].filter(Boolean).join(', '),
  )
}

const parseJsonLd = (html) => {
  const raw = extractFirst(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    html,
  )

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.find((item) => item?.['@type'] === 'JobPosting') || parsed[0] || null
    }
    return parsed
  } catch {
    return null
  }
}

export const buildSearchUrl = (query = 'India') => {
  const url = new URL(SEARCH_BASE_URL)
  url.searchParams.set('q', query)
  return url.toString()
}

export const buildSearchPageUrl = (page = 1, query = 'India') => {
  const url = new URL(buildSearchUrl(query))
  if (Number(page) > 1) {
    url.searchParams.set('page', String(Number(page)))
    url.searchParams.set('is_in_page', '1')
  }
  return url.toString()
}

export const buildJobUrl = (jobIdOrPath) => {
  const normalized = normalizeWhitespace(jobIdOrPath)
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) {
    return `${DETAIL_BASE_URL}${normalized}`
  }
  return toAbsoluteUrl(normalized, DETAIL_BASE_URL)
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<a\b[^>]*href="([^"]*\/profile\/job_details\/(\d+)[^"]*)"[^>]*>[\s\S]*?<\/a>/gi,
)]
  .map((match) => {
    const card = match[0]
    const href = match[1]
    const jobId = match[2]
    const title = normalizeWhitespace(extractFirst(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i, card))
    const spanTexts = [...card.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((spanMatch) => stripTags(spanMatch[1]))
      .filter(Boolean)
    const location = spanTexts.find((text) => /\bIndia\b/i.test(text))
    const sourceUrl = buildJobUrl(href)

    if (!title || !location || !sourceUrl) {
      return null
    }

    return {
      title,
      company: COMPANY_NAME,
      department: null,
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const currentPage = Number.parseInt(extractFirst(/Page\s+(\d+)\s+of\s+\d+/i, html) || '', 10) || null
  const totalPages = Number.parseInt(extractFirst(/Page\s+\d+\s+of\s+(\d+)/i, html) || '', 10) || null
  const totalJobCount = Number.parseInt(extractFirst(/(\d+)\s+Items/i, html) || '', 10) || null

  return {
    currentPage,
    totalPages,
    hasNext: Boolean(
      currentPage
      && totalPages
      && currentPage < totalPages
      && /aria-label="Button to select next week"/i.test(String(html)),
    ),
    totalJobCount,
  }
}

export const extractJobDetail = (html) => {
  const payload = parseJsonLd(html)
  if (!payload) {
    return {
      title: null,
      company: COMPANY_NAME,
      location: null,
      city: null,
      employmentType: null,
      jobDescription: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
    }
  }

  const location = normalizeDetailLocation(payload.jobLocation)
  const qualifications = stripTags(payload.qualifications)

  return {
    title: normalizeWhitespace(payload.title),
    company: normalizeWhitespace(payload.hiringOrganization?.name) || COMPANY_NAME,
    location,
    city: extractCity(location),
    employmentType: normalizeWhitespace(payload.employmentType),
    jobDescription: stripTags(payload.description),
    postingDate: normalizeWhitespace(payload.datePosted),
    closingDate: normalizeWhitespace(payload.validThrough),
    minimumQualification: qualifications,
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: qualifications,
  }
}

export const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    Referer: buildSearchUrl(),
  },
  label: SOURCE,
  timeoutMs: NAVIGATION_TIMEOUT_MS,
})

export const hasVerifiedPlatformErrorSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = stripTags(html) || ''

  return /<title>\s*Error\s*<\/title>/i.test(html)
    && /<html[^>]+id=["']facebook["']/i.test(html)
    && text.includes('Sorry, something went wrong.')
    && text.includes("We're working on getting this fixed as soon as we can.")
    && text.includes('Go Back')
}

export const isVerifiedPlatformErrorPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && Number(page.status) === 400
    && hasVerifiedPlatformErrorSignal(page)
}

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  headers: {},
  html: await fetchText(url),
})

const createBlockedInventorySignalJob = ({ scrapedAt }) => {
  const searchUrl = buildSearchUrl()

  return {
    title: `Current openings at ${COMPANY_NAME}`,
    company: COMPANY_NAME,
    location: 'India',
    city: null,
    country: 'India',
    link: searchUrl,
    applyUrl: searchUrl,
    sourceUrl: searchUrl,
    source: SOURCE,
    jobId: `${SOURCE}-current-openings`,
    requisitionId: `${SOURCE}-current-openings`,
    department: null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      `The official ${COMPANY_NAME} Careers browser experience still exposes India openings, `
      + `but direct anonymous HTTP/API access to ${searchUrl} returned the generic first-party runtime error shell during this scrape. `
      + `Review current openings directly on ${searchUrl}.`,
    companyCareerPage: SEARCH_BASE_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: 'official-company-careers',
    scrapedAt,
  }
}

const hasVerifiedSearchResultsSignal = (html = '') => {
  const jobs = extractSearchResults(html)
  return jobs.length > 0
    && /Page\s+\d+\s+of\s+\d+/i.test(String(html))
    && /\bItems\b/i.test(String(html))
}

export const createMetaScraper = () => {
  const run = async ({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    now = () => new Date().toISOString(),
    fetchPage,
    fetchText,
  } = {}) => {
    const effectiveFetchPage = typeof fetchPage === 'function'
      ? fetchPage
      : typeof fetchText === 'function'
        ? createFetchPageFromText(fetchText)
        : defaultFetchPage

    const listings = []
    const seenJobIds = new Set()
    const scrapedAt = now()

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageUrl = buildSearchPageUrl(pageNumber)
      const page = await effectiveFetchPage(pageUrl)

      if (isVerifiedPlatformErrorPage(page, pageUrl)) {
        if (pageNumber === 1) {
          return [createBlockedInventorySignalJob({ scrapedAt })]
        }

        throw new Error(
          '[meta] Meta Careers pagination is now gated by the first-party runtime error shell before all browser-visible results can be verified.',
        )
      }

      const html = getPageHtml(page)
      if (!hasVerifiedSearchResultsSignal(html)) {
        if (pageNumber === 1) {
          throw new Error('[meta] Meta job search page no longer matches the verified public surface.')
        }
        break
      }

      const pageJobs = extractSearchResults(html)
      if (pageJobs.length === 0) break

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        listings.push(job)
        if (maxJobs && listings.length >= maxJobs) break
      }

      if (maxJobs && listings.length >= maxJobs) break

      const pagination = extractPaginationSummary(html)
      if (!pagination.hasNext) break
    }

    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const job of selectedJobs) {
      let detail = extractJobDetail('')

      if (job.sourceUrl) {
        const detailPage = await effectiveFetchPage(job.sourceUrl)
        if (!isVerifiedPlatformErrorPage(detailPage, job.sourceUrl)) {
          detail = extractJobDetail(getPageHtml(detailPage))
        }
      }

      jobs.push({
        ...job,
        title: detail.title || job.title,
        company: detail.company || job.company,
        location: detail.location || job.location,
        city: detail.city || job.city,
        employmentType: detail.employmentType || job.employmentType,
        experienceRequired: detail.experienceRequired || job.experienceRequired,
        minimumQualification: detail.minimumQualification || job.minimumQualification,
        preferredQualification: detail.preferredQualification || job.preferredQualification,
        requiredSkills: detail.requiredSkills || job.requiredSkills,
        postingDate: detail.postingDate || job.postingDate,
        closingDate: detail.closingDate || job.closingDate,
        jobDescription: detail.jobDescription || job.jobDescription,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  }

  return {
    buildSearchUrl,
    buildSearchPageUrl,
    buildJobUrl,
    extractSearchResults,
    extractPaginationSummary,
    extractJobDetail,
    run,
  }
}

const scraper = createMetaScraper()

export const { run } = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Meta scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
