import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractDwrPayload as extractSharedDwrPayload } from '../../scraper-support/shared/successFactorsDwr.js'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'volkswagengrouptechnologysolutionsindia'
export const COMPANY = 'Volkswagen Group Technology Solutions India'
export const CAREERS_URL = 'https://www.vwg-digitalsolutions.in/'
export const BOARD_URL =
  'https://career10.successfactors.com/career?company=volkswag04&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&'
export const SUCCESSFACTORS_COMPANY_TOKEN = 'volkswag04'
export const VERIFIED_ON = '2026-08-13'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const SUCCESSFACTORS_VIEW_ID = '/ui/rcmcareer/pages/careersite/career.jsp.xhtml'
const SUCCESSFACTORS_DEFAULT_SORT_COLUMN = 'JOB_POSTING_DATE'
const SUCCESSFACTORS_DEFAULT_SORT_ORDER = 'DESC'
const SUCCESSFACTORS_DWR_ENDPOINT_BASE =
  'https://career10.successfactors.com/xi/ajax/remoting/call/plaincall/careerJobSearchControllerProxy'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) return normalized || null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const buildLocation = ({ city, state, country = 'India' }) => {
  const normalizedCountry = /india/i.test(String(country ?? '')) ? 'India' : normalizeWhitespace(country)
  const parts = [normalizeWhitespace(city), normalizeWhitespace(state), normalizedCountry].filter(Boolean)
  return parts.join(', ') || 'India'
}

export const buildDetailUrl = (requisitionId) =>
  `https://career10.successfactors.com/career?career_ns=job_listing&company=${SUCCESSFACTORS_COMPANY_TOKEN}&navBarLevel=JOB_SEARCH&rcm_site_locale=en_GB&career_job_req_id=${encodeURIComponent(String(requisitionId))}&selected_lang=en_GB&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta`

export const hasSuccessFactorsBoardShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /<title>\s*Career Opportunities\s*<\/title>/i.test(rawHtml)
    && /id=["']candidateProfileTitle["'][^>]*>\s*Career Opportunities\s*</i.test(rawHtml)
    && /id=["']career_ns["'][^>]+value=["']job_listing_summary["']/i.test(rawHtml)
    && new RegExp(`id=["']company["'][^>]+value=["']${SUCCESSFACTORS_COMPANY_TOKEN}["']`, 'i').test(rawHtml)
    && /window\.addEventListener\(\s*["']load["']\s*,\s*getInitialJobSearchData\s*\)/i.test(rawHtml)
    && /careerJobSearchController\.getInitialJobSearchData\s*\(/i.test(rawHtml)
    && /ajaxSecKey=/i.test(rawHtml)
    && /id=["']careerJobSearchContainer["']/i.test(rawHtml)
}

const hasSuccessFactorsDwrResponseSignal = (value = '') => {
  const raw = String(value ?? '')
  return /allowScriptTagRemoting is false\./i.test(raw)
    && /dwr\.engine\._remoteHandleCallback\(/i.test(raw)
    && /postingCount/i.test(raw)
}

const buildHttpError = (response, url) => {
  const error = new Error(`HTTP ${response.status} for ${url}`)
  error.status = response.status
  if ([401, 403, 404, 410, 451].includes(response.status)) {
    error.abortRetries = true
  }
  return error
}

const extractCookieHeader = (response) => {
  const setCookies = typeof response?.headers?.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []

  const cookies = setCookies
    .map((value) => normalizeWhitespace(String(value ?? '').split(';', 1)[0]))
    .filter(Boolean)

  return cookies.length > 0 ? cookies.join('; ') : null
}

const getSearchPagePath = (searchUrl = BOARD_URL) => {
  const url = new URL(searchUrl)
  return `${url.pathname}${url.search}`
}

const createScriptSessionId = () => `${randomBytes(16).toString('hex').toUpperCase()}240`

const extractAjaxToken = (html) =>
  normalizeWhitespace(String(html ?? '').match(/ajaxSecKey="([^"]+)"/i)?.[1])

const buildInitialSearchDwrBody = ({
  pagePath = getSearchPagePath(),
  scriptSessionId = createScriptSessionId(),
  browserTimeZone = 'Asia/Calcutta',
} = {}) => [
  'callCount=1',
  `page=${pagePath}`,
  'httpSessionId=',
  `scriptSessionId=${scriptSessionId}`,
  'c0-scriptName=careerJobSearchControllerProxy',
  'c0-methodName=getInitialJobSearchData',
  'c0-id=0',
  'c0-e1=string:',
  'c0-e2=string:',
  'c0-e3=string:',
  `c0-e4=string:${encodeURIComponent(browserTimeZone)}`,
  'c0-param0=Object_Object:{filterOnly:reference:c0-e1, jobAlertId:reference:c0-e2, returnToList:reference:c0-e3, browserTimeZone:reference:c0-e4}',
  'batchId=0',
  '',
].join('\n')

const buildPaginatedSearchDwrBody = ({
  pagePath = getSearchPagePath(),
  scriptSessionId,
  currentPage,
  pageSize,
  totalCount,
  sortByColumn = SUCCESSFACTORS_DEFAULT_SORT_COLUMN,
  sortOrder = SUCCESSFACTORS_DEFAULT_SORT_ORDER,
  batchId = Math.max(1, currentPage - 1),
  increaseCandSummaryPagination = false,
} = {}) => {
  const safePageSize = Math.max(1, Number.parseInt(pageSize, 10) || 10)
  const safeTotalCount = Math.max(safePageSize, Number.parseInt(totalCount, 10) || safePageSize)
  const safeCurrentPage = Math.max(1, Number.parseInt(currentPage, 10) || 1)
  const startRow = ((safeCurrentPage - 1) * safePageSize) + 1
  const endRow = Math.min(safeCurrentPage * safePageSize, safeTotalCount)

  return [
    'callCount=1',
    `page=${pagePath}`,
    'httpSessionId=',
    `scriptSessionId=${scriptSessionId}`,
    'c0-scriptName=careerJobSearchControllerProxy',
    'c0-methodName=search',
    'c0-id=0',
    `c0-e2=number:${safeCurrentPage}`,
    `c0-e3=number:${endRow}`,
    `c0-e4=boolean:${increaseCandSummaryPagination ? 'true' : 'false'}`,
    `c0-e5=number:${safePageSize}`,
    `c0-e6=number:${startRow}`,
    `c0-e7=number:${safeTotalCount}`,
    'c0-e1=Object_Object:{currentPage:reference:c0-e2, endRow:reference:c0-e3, increaseCandSummaryPagination:reference:c0-e4, pageSize:reference:c0-e5, startRow:reference:c0-e6, totalCount:reference:c0-e7}',
    `c0-e8=string:${sortByColumn}`,
    `c0-e9=string:${sortOrder}`,
    'c0-param0=Object_Object:{pagination:reference:c0-e1, sortByColumn:reference:c0-e8, sortOrder:reference:c0-e9}',
    `batchId=${Math.max(1, Number.parseInt(batchId, 10) || 1)}`,
    '',
  ].join('\n')
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 500,
  timeoutMs: 30000,
  label: `${SOURCE}-html`,
  signal,
})

const fetchSuccessFactorsSearchSession = async ({
  searchUrl = BOARD_URL,
  fetchImpl = fetch,
  signal,
} = {}) => withRetry(async () => {
  const response = await fetchImpl(searchUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    },
    signal,
  })

  if (!response.ok) {
    throw buildHttpError(response, searchUrl)
  }

  const html = await response.text()
  if (!hasSuccessFactorsBoardShellSignal(html)) {
    const error = new Error('The Volkswagen SuccessFactors board bootstrap no longer matches the verified public contract')
    error.abortRetries = true
    throw error
  }

  const csrfToken = extractAjaxToken(html)
  if (!csrfToken) {
    const error = new Error('The Volkswagen SuccessFactors board bootstrap no longer exposes an ajaxSecKey token')
    error.abortRetries = true
    throw error
  }

  return {
    html,
    csrfToken,
    cookieHeader: extractCookieHeader(response),
  }
}, {
  attempts: 3,
  baseDelayMs: 500,
  label: `${SOURCE}-successfactors-bootstrap`,
  signal,
})

const postSuccessFactorsDwr = async ({
  endpoint,
  body,
  csrfToken,
  cookieHeader,
  refererUrl = BOARD_URL,
  subaction = 0,
  fetchImpl = fetch,
  signal,
} = {}) => {
  const url = `${SUCCESSFACTORS_DWR_ENDPOINT_BASE}.${endpoint}.dwr`

  return withRetry(async () => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        'Content-Type': 'text/plain',
        Referer: refererUrl,
        Origin: 'https://career10.successfactors.com',
        'x-csrf-token': csrfToken,
        'x-ajax-token': csrfToken,
        'x-sap-page-info': `companyId=${SUCCESSFACTORS_COMPANY_TOKEN}`,
        'x-subaction': String(subaction),
        viewid: SUCCESSFACTORS_VIEW_ID,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body,
      signal,
    })

    if (!response.ok) {
      throw buildHttpError(response, url)
    }

    const text = await response.text()
    if (/<html\b/i.test(text)) {
      const error = new Error(`Expected SuccessFactors DWR JavaScript from ${url} but received HTML`)
      if (/requested operation is not available|not authorized|access denied|forbidden/i.test(text)) {
        error.abortRetries = true
      }
      throw error
    }
    if (!hasSuccessFactorsDwrResponseSignal(text)) {
      const error = new Error(`The Volkswagen SuccessFactors ${endpoint} response no longer matches the expected DWR contract`)
      error.abortRetries = true
      throw error
    }

    return text
  }, {
    attempts: 3,
    baseDelayMs: 500,
    label: `${SOURCE}-successfactors-${endpoint}`,
    signal,
  })
}

export const extractDwrPayload = responseText => extractSharedDwrPayload(responseText, {
  parseErrorMessage: 'The Volkswagen SuccessFactors DWR payload could not be parsed',
  missingResultsErrorMessage: 'The Volkswagen SuccessFactors DWR payload no longer exposes postings',
})

const flattenPostingFields = (value) => {
  if (!value) return []
  if (!Array.isArray(value)) return [value]
  return value.flatMap((entry) => flattenPostingFields(entry))
}

const buildPostingFieldMap = (posting) => {
  const fields = new Map()

  for (const entry of flattenPostingFields(posting?.otherValues)) {
    const fieldId = normalizeWhitespace(entry?.fieldId)
    if (!fieldId || fields.has(fieldId)) continue
    fields.set(fieldId, normalizeWhitespace(entry?.shortVal ?? entry?.longVal ?? entry?.internalVal))
  }

  return fields
}

export const extractDwrSearchResults = (responseText) => {
  const payload = extractDwrPayload(responseText)

  return Array.from(payload.results.postings, (posting) => {
      const requisitionId = normalizeWhitespace(posting?.id)
      if (!requisitionId) return null

      const fields = buildPostingFieldMap(posting)
      const state = fields.get('filter2') || null
      const city = fields.get('filter3') || null
      const country = /india/i.test(fields.get('filter1') || '')
        ? 'India'
        : 'India'
      const detailUrl = buildDetailUrl(requisitionId)

      return {
        title: normalizeWhitespace(posting?.title),
        company: COMPANY,
        location: buildLocation({ city, state, country }),
        city,
        state,
        country,
        jobId: requisitionId,
        requisitionId,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        link: detailUrl,
        postingDate: toIsoDate(posting?.postingDate),
        jobDescription: null,
      }
    })
    .filter(Boolean)
}

const extractDescriptionFromText = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const explicitSection = normalized.match(/(Responsibilities|Role overview|Job description|About the role)[\s\S]+$/i)?.[0]
  return explicitSection || normalized
}

export const extractJobDetail = (html, listing = {}) => {
  const rawHtml = String(html ?? '')
  const bodyText = stripTags(rawHtml) || ''
  const detailSectionHtml = rawHtml.match(/<div[^>]*class="jobdescription"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
  const title = normalizeWhitespace(
    (rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      || rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      || listing.title
      || '')
      .replace(/^Career Opportunities:\s*/i, '')
      .replace(/\s*\(\d+\)\s*$/i, ''),
  )
  const requisitionId = normalizeWhitespace(
    bodyText.match(/\bRequisition ID\s*([0-9]+)\b/i)?.[1] || listing.requisitionId || listing.jobId,
  )
  const jobDescription = detailSectionHtml
    ? stripTags(detailSectionHtml)
    : extractDescriptionFromText(bodyText)

  return {
    title: title || listing.title || null,
    requisitionId,
    postingDate: listing.postingDate || null,
    applyUrl: buildDetailUrl(requisitionId || listing.requisitionId || listing.jobId),
    jobDescription: jobDescription || listing.jobDescription || null,
  }
}

const getLiveSearchPages = async ({
  searchUrl = BOARD_URL,
  fetchImpl = fetch,
  signal,
} = {}) => {
  const session = await fetchSuccessFactorsSearchSession({
    searchUrl,
    fetchImpl,
    signal,
  })
  const pagePath = getSearchPagePath(searchUrl)
  const scriptSessionId = createScriptSessionId()
  const initialResponse = await postSuccessFactorsDwr({
    endpoint: 'getInitialJobSearchData',
    body: buildInitialSearchDwrBody({ pagePath, scriptSessionId }),
    csrfToken: session.csrfToken,
    cookieHeader: session.cookieHeader,
    refererUrl: searchUrl,
    subaction: 0,
    fetchImpl,
    signal,
  })
  const initialPayload = extractDwrPayload(initialResponse)
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
  const sortByColumn = normalizeWhitespace(initialPayload.results.options?.sortByColumn)
    || SUCCESSFACTORS_DEFAULT_SORT_COLUMN
  const sortOrder = normalizeWhitespace(initialPayload.results.options?.sortOrder)
    || SUCCESSFACTORS_DEFAULT_SORT_ORDER
  const pages = [initialResponse]

  for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
    pages.push(await postSuccessFactorsDwr({
      endpoint: 'search',
      body: buildPaginatedSearchDwrBody({
        pagePath,
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
      refererUrl: searchUrl,
      subaction: currentPage - 1,
      fetchImpl,
      signal,
    }))
  }

  return pages
}

const collectSummaryPages = (pages) => {
  if (!Array.isArray(pages) || pages.length === 0 || !hasSuccessFactorsDwrResponseSignal(pages[0])) {
    throw new Error('The Volkswagen SuccessFactors DWR results no longer match the verified public contract')
  }

  const listings = []
  const seenRequisitionIds = new Set()

  for (const page of pages) {
    const pageJobs = extractDwrSearchResults(page)
    for (const job of pageJobs) {
      if (seenRequisitionIds.has(job.requisitionId)) continue
      seenRequisitionIds.add(job.requisitionId)
      listings.push(job)
    }
  }

  return listings
}

export const createVolkswagenGroupTechnologySolutionsIndiaScraper = ({
  now = () => new Date().toISOString(),
  fetchText = defaultFetchText,
  getSearchPages = (options = {}) => getLiveSearchPages(options),
} = {}) => ({
  async run({
    fetchText: fetchTextOverride = fetchText,
    getSearchPages: getSearchPagesOverride = getSearchPages,
    signal,
  } = {}) {
    const boardHtml = await fetchTextOverride(BOARD_URL, { signal })
    if (!hasSuccessFactorsBoardShellSignal(boardHtml)) {
      throw new Error('The Volkswagen SuccessFactors board bootstrap no longer matches the verified public contract')
    }

    const searchPages = await getSearchPagesOverride({ searchUrl: BOARD_URL, signal })
    const listings = collectSummaryPages(searchPages)
    const jobs = []

    for (const listing of listings) {
      let detail = listing

      try {
        const detailHtml = await fetchTextOverride(listing.sourceUrl, { signal })
        detail = extractJobDetail(detailHtml, listing)
      } catch {
        detail = listing
      }

      jobs.push({
        ...listing,
        ...detail,
        title: detail.title || listing.title,
        source: SOURCE,
        company: COMPANY,
        country: listing.country || 'India',
        link: detail.applyUrl || listing.applyUrl || listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = (options = {}) =>
  createVolkswagenGroupTechnologySolutionsIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
