import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildInitialSearchDwrBody,
  buildPaginatedSearchDwrBody,
  buildSuccessFactorsPostingFieldMap,
  createSuccessFactorsScriptSessionId,
  extractDwrPayload,
  fetchSuccessFactorsSearchSession,
  hasSuccessFactorsDwrBootstrapShellSignal,
  hasSuccessFactorsDwrResponseSignal,
  parseSuccessFactorsDialogValue,
  postSuccessFactorsDwr,
} from '../../scraper-support/shared/successFactorsDwr.js'

import { DATALOGIC_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DATALOGIC_INDIA_CATALOG
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const SUCCESSFACTORS_BOARD_URL = PROVIDER_METADATA.successFactorsBoardUrl
export const SUCCESSFACTORS_SEARCH_URL = PROVIDER_METADATA.successFactorsSearchUrl
export const SUCCESSFACTORS_COMPANY_TOKEN = PROVIDER_METADATA.successFactorsCompanyToken

const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_MAX_PAGES = 10

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
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

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) return normalized

  const [, first, second, year] = match
  const firstNumber = Number.parseInt(first, 10)
  const secondNumber = Number.parseInt(second, 10)

  if (firstNumber > 12 && secondNumber <= 12) {
    return `${year}-${second}-${first}`
  }

  const month = first
  const day = second
  return `${year}-${month}-${day}`
}

const normalizeState = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized && !/^n\/a$/i.test(normalized) ? normalized : null
}

const buildLocation = (city, country) => {
  const normalizedCity = normalizeWhitespace(city)
  const normalizedCountry = normalizeWhitespace(country)

  if (!normalizedCity && !normalizedCountry) return null
  if (!normalizedCity) return normalizedCountry
  if (!normalizedCountry) return normalizedCity
  return `${normalizedCity}, ${normalizedCountry}`
}

export const buildDetailUrl = (requisitionId) =>
  `https://career2.successfactors.eu/career?career_ns=job_listing&company=${SUCCESSFACTORS_COMPANY_TOKEN}&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=${String(requisitionId)}&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta`

export const normalizeSuccessFactorsUrl = (value) => {
  try {
    const sanitizedValue = decodeHtmlEntities(String(value ?? ''))
      .replace(/&amp%3b/gi, '&')
      .replace(/amp%3b/gi, '')
    const url = new URL(sanitizedValue, SUCCESSFACTORS_SEARCH_URL)
    url.searchParams.delete('_s.crb')
    return url.toString().replace('Asia%2FCalcutta', 'Asia/Calcutta')
  } catch {
    return String(value ?? '')
  }
}

export const extractSuccessFactorsHandoffUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/career2\.successfactors\.eu\/career\?company=datalogics)["']/i)
  return match ? match[1] : null
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Careers - Datalogic\s*<\/title>/i.test(rawHtml)
    && /interest in a career with Datalogic/i.test(normalized)
    && /SEE ALL OPEN JOBS/i.test(normalized)
}

export const hasSuccessFactorsSearchPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml) || ''

  return hasStaticSuccessFactorsSearchPageSignal(rawHtml)
    || hasSuccessFactorsDwrResponseSignal(rawHtml)
}

export const hasStaticSuccessFactorsSearchPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml) || ''

  return /<title>\s*Career Opportunities\s*<\/title>/i.test(rawHtml)
    && /Search for Openings/i.test(normalized)
    && /Jobs matched your search/i.test(normalized)
    && /class=["']jobResultItem["']/i.test(rawHtml)
    && /company=datalogics/i.test(rawHtml)
}

export const hasSuccessFactorsDwrBootstrapSignal = (html) => hasSuccessFactorsDwrBootstrapShellSignal({
  html,
  companyToken: SUCCESSFACTORS_COMPANY_TOKEN,
})

export const extractSearchSummary = (html) => {
  const normalized = stripTags(html) || ''
  const totalMatch = normalized.match(/(\d+)\s+Jobs?\s+matched your search/i)
  const pageMatch = normalized.match(/Page\s+(\d+)\s+of\s+(\d+)/i)
  const pageSizeMatch = normalized.match(/Items per page\s+(\d+)/i)

  return {
    totalJobs: totalMatch ? Number.parseInt(totalMatch[1], 10) : null,
    currentPage: pageMatch ? Number.parseInt(pageMatch[1], 10) : null,
    totalPages: pageMatch ? Number.parseInt(pageMatch[2], 10) : null,
    pageSize: pageSizeMatch ? Number.parseInt(pageSizeMatch[1], 10) : null,
  }
}

const parseSearchRow = (rowHtml) => {
  const title = stripTags(rowHtml.match(/<a[^>]*class=["']jobTitle["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '')
  const href = decodeHtmlEntities(
    rowHtml.match(/<a[^>]*class=["']jobTitle["'][^>]*href=["']([^"']+)["']/i)?.[1] || '',
  ) || null
  const values = [...String(rowHtml ?? '').matchAll(/<span[^>]*class=["']jobContentEM["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  const requisitionId = normalizeWhitespace(values[0])
  const postingDate = toIsoDate(String(values[1] ?? '').replace(/^Posted on\s*/i, ''))
  const city = normalizeWhitespace(values[2])
  const country = normalizeWhitespace(values[3])
  const state = normalizeState(values[4])

  if (!title || !requisitionId || !city || !country) return null

  return {
    title,
    location: buildLocation(city, country),
    city,
    state,
    country,
    jobId: requisitionId,
    requisitionId,
    sourceUrl: normalizeSuccessFactorsUrl(href) || buildDetailUrl(requisitionId),
    applyUrl: normalizeSuccessFactorsUrl(href) || buildDetailUrl(requisitionId),
    postingDate,
  }
}

export const extractSearchResults = (html) => {
  if (hasSuccessFactorsDwrResponseSignal(html)) {
    return extractDwrSearchResults(html)
  }

  const rows = []

  for (const match of String(html ?? '').matchAll(/<tr[^>]*class=["']jobResultItem["'][^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = parseSearchRow(match[1])
    if (row) rows.push(row)
  }

  return rows
}

export const extractDwrSearchResults = (responseText) => {
  const payload = extractDwrPayload(responseText, {
    parseErrorMessage: 'Datalogic India verified SuccessFactors DWR search payload could not be parsed',
    missingResultsErrorMessage: 'Datalogic India verified SuccessFactors DWR payload no longer exposes postings',
  })

  return payload.results.postings
    .map((posting) => {
      const fields = buildSuccessFactorsPostingFieldMap(posting, { normalize: normalizeWhitespace })
      const requisitionId = normalizeWhitespace(posting?.id)
      const city = parseSuccessFactorsDialogValue(fields.get('location_obj'))
      const country = fields.get('filter1')
      const state = normalizeState(fields.get('filter2'))

      if (!requisitionId || !city || !country) return null

      const sourceUrl = buildDetailUrl(requisitionId)

      return {
        title: normalizeWhitespace(posting?.title),
        location: buildLocation(city, country),
        city,
        state,
        country,
        jobId: requisitionId,
        requisitionId,
        sourceUrl,
        applyUrl: sourceUrl,
        postingDate: toIsoDate(posting?.postingDate),
      }
    })
    .filter(Boolean)
}

const extractSectionHtml = (html, heading) => {
  const pattern = new RegExp(
    `<h2[^>]*>\\s*${heading}\\s*<\\/h2>\\s*([\\s\\S]*?)(?=<h2\\b|<\\/main>|<\\/body>)`,
    'i',
  )
  return String(html ?? '').match(pattern)?.[1] || ''
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const buildJobDescription = (html) => {
  const sections = []

  for (const heading of ['Job Description', 'Role Mission', 'Key Responsibilities', 'Requirements']) {
    const sectionText = stripTags(extractSectionHtml(html, heading))
    if (sectionText) {
      sections.push(`${heading}: ${sectionText}`)
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : null
}

const buildRequiredSkills = (html) => {
  const sectionOrder = ['Key Responsibilities', 'Requirements']
  const skills = []

  for (const heading of sectionOrder) {
    skills.push(...extractListItems(extractSectionHtml(html, heading)))
  }

  return skills
}

export const extractJobDetail = (html, listing = {}) => {
  const rawHtml = String(html ?? '')
  const bodyText = stripTags(rawHtml) || ''
  const rawTitle = stripTags(rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || listing.title || '')
  const title = normalizeWhitespace(
    rawTitle
      ?.replace(/^Career Opportunities:\s*/i, '')
      .replace(/\s*\(([0-9]+)\)\s*$/i, ''),
  ) || listing.title || null
  const requisitionId = normalizeWhitespace(
    bodyText.match(/\bRequisition ID\s*([0-9]+)\b/i)?.[1] || listing.requisitionId || listing.jobId,
  )
  const postingDate = toIsoDate(
    bodyText.match(/\bPosted\s*([0-9/]{10})\b/i)?.[1] || listing.postingDate,
  )
  const summaryMatch = rawHtml.match(
    /Requisition ID\s*[0-9]+\s*-\s*Posted\s*[0-9/]{10}\s*-\s*([^<\n-]+?)\s*-\s*India\s*-\s*([^<\n]+)/i,
  )
  const city = normalizeWhitespace(summaryMatch?.[1] || listing.city) || listing.city || null
  const country = 'India'
  const state = normalizeState(summaryMatch?.[2] || listing.state)
  const sourceUrl = listing.sourceUrl || buildDetailUrl(requisitionId || listing.jobId)

  return {
    title,
    location: buildLocation(city, country),
    city,
    state,
    country,
    jobId: requisitionId || listing.jobId || null,
    requisitionId: requisitionId || listing.requisitionId || listing.jobId || null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: buildJobDescription(rawHtml) || listing.jobDescription || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: buildRequiredSkills(rawHtml),
    postingDate,
    applyUrl: sourceUrl,
    sourceUrl,
    publicExperienceChecked: true,
  }
}

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const getLiveSearchPages = async ({
  searchUrl = SUCCESSFACTORS_SEARCH_URL,
  maxPages = DEFAULT_MAX_PAGES,
  fetchText: fetchTextImpl = fetchText,
  fetchSearchSession = (options = {}) => fetchSuccessFactorsSearchSession(options),
  fetchDwrText = (options = {}) => postSuccessFactorsDwr(options),
} = {}) => {
  const html = await fetchTextImpl(searchUrl)

  if (hasStaticSuccessFactorsSearchPageSignal(html)) {
    const summary = extractSearchSummary(html)

    if ((summary.totalPages ?? 1) > 1) {
      throw new Error(
        '[datalogicindia] API-only migration required: the verified SuccessFactors board requires pagination, but no HTTP pagination request contract is available; browser automation is disabled.',
      )
    }

    return [html]
  }

  if (!hasSuccessFactorsDwrBootstrapSignal(html)) {
    return [html]
  }

  const session = await fetchSearchSession({
    searchUrl,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    label: `${SOURCE}-successfactors-bootstrap`,
    missingAjaxTokenErrorMessage:
      'Datalogic India verified SuccessFactors search bootstrap no longer exposes an ajaxSecKey token',
  })

  if (!hasSuccessFactorsDwrBootstrapSignal(session.html)) {
    throw new Error('Datalogic India verified public SuccessFactors search surface no longer matches the known page')
  }

  const scriptSessionId = createSuccessFactorsScriptSessionId()
  const initialResponse = await fetchDwrText({
    searchUrl,
    endpoint: 'getInitialJobSearchData',
    body: buildInitialSearchDwrBody({ searchUrl, scriptSessionId }),
    csrfToken: session.csrfToken,
    cookieHeader: session.cookieHeader,
    companyToken: SUCCESSFACTORS_COMPANY_TOKEN,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    label: `${SOURCE}-successfactors-getInitialJobSearchData`,
    responseContractErrorMessage:
      'Datalogic India verified SuccessFactors getInitialJobSearchData response no longer matches the expected DWR contract',
    subaction: 0,
  })
  const initialPayload = extractDwrPayload(initialResponse, {
    parseErrorMessage: 'Datalogic India verified SuccessFactors DWR search payload could not be parsed',
    missingResultsErrorMessage: 'Datalogic India verified SuccessFactors DWR payload no longer exposes postings',
  })
  const initialPagination = initialPayload.results.options?.pagination || {}
  const pageSize = Math.max(
    1,
    Number.parseInt(initialPagination.pageSize, 10) || initialPayload.results.postings.length || 10,
  )
  const totalCount = Math.max(
    initialPayload.results.postings.length,
    Number.parseInt(initialPagination.totalCount, 10)
      || Number.parseInt(initialPayload.results.postingCount, 10)
      || initialPayload.results.postings.length,
  )
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  if (totalPages > maxPages) {
    throw new Error(
      `[datalogicindia] API-only migration required: the verified SuccessFactors board spans ${totalPages} pages, which exceeds the configured safe page limit of ${maxPages}.`,
    )
  }

  const sortByColumn = normalizeWhitespace(initialPayload.results.options?.sortByColumn) || undefined
  const sortOrder = normalizeWhitespace(initialPayload.results.options?.sortOrder) || undefined
  const pages = [initialResponse]

  for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
    pages.push(await fetchDwrText({
      searchUrl,
      endpoint: 'search',
      body: buildPaginatedSearchDwrBody({
        searchUrl,
        scriptSessionId,
        currentPage,
        pageSize,
        totalCount,
        sortByColumn,
        sortOrder,
        batchId: currentPage - 1,
      }),
      csrfToken: session.csrfToken,
      cookieHeader: session.cookieHeader,
      companyToken: SUCCESSFACTORS_COMPANY_TOKEN,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      label: `${SOURCE}-successfactors-search`,
      responseContractErrorMessage:
        'Datalogic India verified SuccessFactors search response no longer matches the expected DWR contract',
      subaction: currentPage - 1,
    }))
  }

  return pages
}

export const createDatalogicIndiaScraper = ({
  fetchText: fetchTextImpl = fetchText,
  getSearchPages = (options = {}) => getLiveSearchPages({ ...options, fetchText: fetchTextImpl }),
  now = () => new Date().toISOString(),
  maxPages = DEFAULT_MAX_PAGES,
} = {}) => ({
  async run() {
    const careersHtml = await fetchTextImpl(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Datalogic India verified official Datalogic careers page no longer matches the known public surface')
    }

    const handoffUrl = extractSuccessFactorsHandoffUrl(careersHtml)
    if (handoffUrl !== SUCCESSFACTORS_BOARD_URL) {
      throw new Error('Datalogic India verified official Datalogic careers page no longer exposes the known SuccessFactors handoff')
    }

    const searchPages = await getSearchPages({
      searchUrl: SUCCESSFACTORS_SEARCH_URL,
      maxPages,
      fetchText: fetchTextImpl,
    })

    if (!Array.isArray(searchPages) || searchPages.length === 0 || !hasSuccessFactorsSearchPageSignal(searchPages[0])) {
      throw new Error('Datalogic India verified public SuccessFactors search surface no longer matches the known page')
    }

    const seenIds = new Set()
    const indiaListings = []

    for (const pageHtml of searchPages) {
      for (const listing of extractSearchResults(pageHtml)) {
        if (!/india/i.test(String(listing.country ?? ''))) continue
        if (seenIds.has(listing.requisitionId)) continue
        seenIds.add(listing.requisitionId)
        indiaListings.push(listing)
      }
    }

    const jobs = []

    for (const listing of indiaListings) {
      const detailHtml = await fetchTextImpl(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        title: detail.title || listing.title,
        company: COMPANY_NAME,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        state: detail.state || listing.state,
        country: detail.country || listing.country,
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        applyUrl: detail.applyUrl || listing.applyUrl,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: SOURCE,
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        department: null,
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        publicExperienceChecked: detail.publicExperienceChecked === true,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate || listing.postingDate,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createDatalogicIndiaScraper(options).run()

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
