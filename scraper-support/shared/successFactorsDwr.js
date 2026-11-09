import { randomBytes } from 'node:crypto'
import { parseDwrData } from '../utils/remoteScriptData.js'

import { withRetry } from '../utils/retry.js'

const NON_RETRIABLE_HTTP_STATUSES = new Set([401, 403, 404, 410, 451])

export const SUCCESSFACTORS_VIEW_ID = '/ui/rcmcareer/pages/careersite/career.jsp.xhtml'
export const SUCCESSFACTORS_DEFAULT_SORT_COLUMN = 'JOB_POSTING_DATE'
export const SUCCESSFACTORS_DEFAULT_SORT_ORDER = 'DESC'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
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

const extractHtmlTitle = (html) =>
  String(html ?? '').match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null

const buildHttpError = (response, url) => {
  const error = new Error(`HTTP ${response.status} for ${url}`)
  error.status = response.status

  if (NON_RETRIABLE_HTTP_STATUSES.has(response.status)) {
    error.abortRetries = true
  }

  return error
}

const buildUnexpectedHtmlResponseError = (url, html) => {
  const title = extractHtmlTitle(html)
  const error = new Error(`Expected SuccessFactors DWR JavaScript from ${url} but received HTML${title ? ` (${title})` : ''}`)

  if (/requested operation is not available|not authorized|access denied|forbidden/i.test(String(html ?? ''))) {
    error.abortRetries = true
  }

  return error
}

const getSearchPagePath = (searchUrl) => {
  const url = new URL(searchUrl)
  return `${url.pathname}${url.search}`
}

const extractAjaxToken = (html) =>
  normalizeWhitespace(String(html ?? '').match(/ajaxSecKey="([^"]+)"/i)?.[1])

const flattenPostingFields = (value) => {
  if (!value) return []
  if (!Array.isArray(value)) return [value]
  return value.flatMap((entry) => flattenPostingFields(entry))
}

export const createSuccessFactorsScriptSessionId = () =>
  `${randomBytes(16).toString('hex').toUpperCase()}240`

export const hasSuccessFactorsDwrBootstrapShellSignal = ({ html, companyToken }) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Career Opportunities\s*<\/title>/i.test(rawHtml)
    && /id=["']candidateProfileTitle["'][^>]*>\s*Career Opportunities\s*</i.test(rawHtml)
    && /id=["']career_ns["'][^>]+value=["']job_listing_summary["']/i.test(rawHtml)
    && new RegExp(`id=["']company["'][^>]+value=["']${companyToken}["']`, 'i').test(rawHtml)
    && /window\.addEventListener\(\s*["']load["']\s*,\s*getInitialJobSearchData\s*\)/i.test(rawHtml)
    && /careerJobSearchController\.getInitialJobSearchData\s*\(/i.test(rawHtml)
    && /id=["']careerJobSearchContainer["']/i.test(rawHtml)
}

export const hasSuccessFactorsDwrResponseSignal = (value) => {
  const raw = String(value ?? '')

  return /allowScriptTagRemoting is false\./i.test(raw)
    && /dwr\.engine\._remoteHandleCallback\(/i.test(raw)
    && /postingCount/i.test(raw)
}

export const buildInitialSearchDwrBody = ({
  searchUrl,
  pagePath = getSearchPagePath(searchUrl),
  scriptSessionId = createSuccessFactorsScriptSessionId(),
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

export const buildPaginatedSearchDwrBody = ({
  searchUrl,
  pagePath = getSearchPagePath(searchUrl),
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

export const fetchSuccessFactorsSearchSession = async ({
  searchUrl,
  fetchImpl = fetch,
  signal,
  userAgent,
  label = 'successfactors-bootstrap',
  missingAjaxTokenErrorMessage = 'SuccessFactors search bootstrap no longer exposes an ajaxSecKey token',
} = {}) => withRetry(async () => {
  signal?.throwIfAborted()
  const response = await fetchImpl(searchUrl, {
    signal,
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    },
  })
  signal?.throwIfAborted()

  if (!response.ok) {
    throw buildHttpError(response, searchUrl)
  }

  const html = await response.text()
  signal?.throwIfAborted()
  const csrfToken = extractAjaxToken(html)

  if (!csrfToken) {
    const error = new Error(missingAjaxTokenErrorMessage)
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
  label,
  signal,
})

export const postSuccessFactorsDwr = async ({
  searchUrl,
  endpoint,
  body,
  csrfToken,
  cookieHeader,
  companyToken,
  userAgent,
  label = `successfactors-${endpoint}`,
  responseContractErrorMessage = `SuccessFactors ${endpoint} response no longer matches the expected DWR contract`,
  refererUrl = searchUrl,
  subaction = 0,
  fetchImpl = fetch,
  signal,
  viewId = SUCCESSFACTORS_VIEW_ID,
} = {}) => {
  const origin = new URL(searchUrl).origin
  const url = `${origin}/xi/ajax/remoting/call/plaincall/careerJobSearchControllerProxy.${endpoint}.dwr`

  return withRetry(async () => {
    signal?.throwIfAborted()
    const response = await fetchImpl(url, {
      signal,
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        Accept: '*/*',
        'Content-Type': 'text/plain',
        Referer: refererUrl,
        Origin: origin,
        'x-csrf-token': csrfToken,
        'x-ajax-token': csrfToken,
        'x-sap-page-info': `companyId=${companyToken}`,
        'x-subaction': String(subaction),
        viewid: viewId,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body,
    })
    signal?.throwIfAborted()

    if (!response.ok) {
      throw buildHttpError(response, url)
    }

    const text = await response.text()
    signal?.throwIfAborted()
    if (/<html\b/i.test(text)) {
      throw buildUnexpectedHtmlResponseError(url, text)
    }
    if (!hasSuccessFactorsDwrResponseSignal(text)) {
      const error = new Error(responseContractErrorMessage)
      error.abortRetries = true
      throw error
    }

    return text
  }, {
    attempts: 3,
    baseDelayMs: 500,
    label,
    signal,
  })
}

export const extractDwrPayload = (
  responseText,
  {
    parseErrorMessage = 'SuccessFactors DWR payload could not be parsed',
    missingResultsErrorMessage = 'SuccessFactors DWR payload no longer exposes postings',
  } = {},
) => {
  const rawText = String(responseText ?? '')
  if (!hasSuccessFactorsDwrResponseSignal(rawText)) return null

  let callbackValue
  const executable = rawText.replace(/^\s*throw 'allowScriptTagRemoting is false\.';\s*/i, '')
  try {
    callbackValue = parseDwrData(executable)
  } catch (error) {
    throw new Error(parseErrorMessage, { cause: error })
  }

  const payload = callbackValue?.payload?.results
    ? callbackValue.payload
    : callbackValue

  if (!payload?.results || !Array.isArray(payload.results.postings)) {
    throw new Error(missingResultsErrorMessage)
  }

  return payload
}

export const buildSuccessFactorsPostingFieldMap = (
  posting,
  { normalize = (value) => value } = {},
) => {
  const fields = new Map()

  for (const entry of flattenPostingFields(posting?.otherValues)) {
    const fieldId = normalizeWhitespace(entry?.fieldId)
    if (!fieldId || fields.has(fieldId)) continue
    fields.set(fieldId, normalize(entry?.shortVal ?? entry?.longVal ?? entry?.internalVal))
  }

  return fields
}

export const parseSuccessFactorsDialogValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (!normalized.startsWith('[')) return normalized

  try {
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return normalizeWhitespace(parsed.at(-1))
    }
  } catch {
    const match = normalized.match(/^\[\s*"[^"]+"\s*(?:,\s*\d+)?\s*,\s*"([^"]*)"\s*\]$/i)
    if (match?.[1]) {
      return normalizeWhitespace(match[1])
    }
  }

  return normalized
}
