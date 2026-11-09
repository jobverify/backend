import { execFile as execFileCallback } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {
  buildInitialSearchDwrBody,
  buildPaginatedSearchDwrBody,
  buildSuccessFactorsPostingFieldMap,
  createSuccessFactorsScriptSessionId,
  extractDwrPayload,
  fetchSuccessFactorsSearchSession,
  hasSuccessFactorsDwrBootstrapShellSignal,
  hasSuccessFactorsDwrResponseSignal,
  postSuccessFactorsDwr,
} from '../../scraper-support/shared/successFactorsDwr.js'

import { BIOCON_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const execFile = promisify(execFileCallback)

export const PROVIDER_METADATA = BIOCON_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const SUCCESSFACTORS_BOARD_URL = PROVIDER_METADATA.successFactorsBoardUrl
export const SUCCESSFACTORS_SEARCH_URL = PROVIDER_METADATA.successFactorsSearchUrl
export const SUCCESSFACTORS_COMPANY_TOKEN = PROVIDER_METADATA.successFactorsCompanyToken
export const DETAIL_URL_PREFIX =
  `https://career10.successfactors.com/career?career_ns=job_listing&company=${SUCCESSFACTORS_COMPANY_TOKEN}&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const isBioconFirstPartyUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && (url.hostname === 'biocon.com' || url.hostname === 'www.biocon.com')
  } catch {
    return false
  }
}

const isLeafSignatureError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return true
    if (/unable to verify (?:the )?(?:first certificate|leaf signature)/i.test(current.message || '')) {
      return true
    }
    current = current.cause
  }

  return false
}

export const fetchBioconFirstPartyText = async (url, {
  fetchText = fetchTextWithRetry,
  execFile: runExecFile = execFile,
  signal,
} = {}) => {
  signal?.throwIfAborted()
  const fetchOptions = {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 3,
    baseDelayMs: 500,
    timeoutMs: 30000,
    label: `${SOURCE}-html`,
    signal,
  }

  try {
    const text = await fetchText(url, fetchOptions)
    signal?.throwIfAborted()
    return text
  } catch (error) {
    signal?.throwIfAborted()
    if (!isBioconFirstPartyUrl(url) || !isLeafSignatureError(error)) throw error

    try {
      const { stdout } = await runExecFile(process.platform === 'win32' ? 'curl.exe' : 'curl', [
        '--disable',
        '--fail-with-body',
        '--silent',
        '--show-error',
        '--location',
        '--max-redirs', '5',
        '--connect-timeout', '10',
        '--max-time', '30',
        '--user-agent', USER_AGENT,
        '--header', `Accept: ${fetchOptions.headers.Accept}`,
        '--proto', '=https',
        '--proto-redir', '=https',
        url,
      ], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        signal,
        windowsHide: true,
      })

      signal?.throwIfAborted()
      return stdout
    } catch (fallbackError) {
      signal?.throwIfAborted()
      throw fallbackError
    }
  }
}

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
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
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

export const buildDetailUrl = (requisitionId) =>
  `${DETAIL_URL_PREFIX}&career_job_req_id=${encodeURIComponent(String(requisitionId))}&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta`

export const extractSuccessFactorsHandoffUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/career10\.successfactors\.com\/career\?company=bioconlimi)["']/i)
  return match ? match[1] : null
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Careers at Biocon - Put your passion for science into practice\s*<\/title>/i.test(rawHtml)
    && /chance at Biocon to work alongside some of the brightest minds/i.test(normalized)
}

export const hasSuccessFactorsSearchPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return hasStaticSuccessFactorsSearchPageSignal(rawHtml)
    || hasSuccessFactorsDwrResponseSignal(rawHtml)
}

export const hasStaticSuccessFactorsSearchPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Career Opportunities\s*<\/title>/i.test(rawHtml)
    && /Search Results/i.test(normalized)
    && new RegExp(`company=${SUCCESSFACTORS_COMPANY_TOKEN}`, 'i').test(rawHtml)
    && (
      /class="jobResultItem"/i.test(rawHtml)
      || /\b\d+\s+Jobs?\s+match the selections\b/i.test(normalized)
      || /\b\d+\s+Jobs?\s+matched your search\b/i.test(normalized)
    )
}

export const hasZeroResultsSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /\b0\s+Jobs?\s+match the selections\b/i.test(normalized)
    || /\b0\s+Jobs?\s+matched your search\b/i.test(normalized)
}

export const hasSuccessFactorsDwrBootstrapSignal = (html) => hasSuccessFactorsDwrBootstrapShellSignal({
  html,
  companyToken: SUCCESSFACTORS_COMPANY_TOKEN,
})

const hasNextPage = (html) => /<a[^>]+title=["']Next Page["'][^>]*>/i.test(String(html ?? ''))

const parseSearchRow = (rowHtml) => {
  const title = stripTags(rowHtml.match(/<a[^>]*class=["']jobTitle["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '')
  const values = [...String(rowHtml ?? '').matchAll(/<span[^>]*class=["']jobContentEM["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  const requisitionId = normalizeWhitespace(values[0])
  const postingDate = toIsoDate(String(values[1] ?? '').replace(/^Posted on\s*/i, ''))
  const hiringEntity = normalizeWhitespace(values[2])
  const department = normalizeWhitespace(values[3])
  const country = normalizeWhitespace(values[4]) || 'India'

  if (!title || !requisitionId) return null

  const detailUrl = buildDetailUrl(requisitionId)

  return {
    title,
    company: COMPANY_NAME,
    hiringEntity,
    department,
    location: country,
    city: null,
    state: null,
    country,
    jobId: requisitionId,
    requisitionId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    link: detailUrl,
    postingDate,
    jobDescription: null,
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
    parseErrorMessage: 'Biocon verified SuccessFactors DWR search payload could not be parsed',
    missingResultsErrorMessage: 'Biocon verified SuccessFactors DWR payload no longer exposes postings',
  })

  return payload.results.postings
    .map((posting) => {
      const fields = buildSuccessFactorsPostingFieldMap(posting, { normalize: normalizeWhitespace })
      const requisitionId = normalizeWhitespace(posting?.id)

      if (!requisitionId) return null

      const country = fields.get('filter1') || 'India'
      const detailUrl = buildDetailUrl(requisitionId)

      return {
        title: normalizeWhitespace(posting?.title),
        company: COMPANY_NAME,
        hiringEntity: fields.get('legalEntity_obj') || null,
        department: fields.get('department_obj') || null,
        location: country,
        city: null,
        state: null,
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

const extractSectionText = (html, heading) => {
  const pattern = new RegExp(
    `<h2[^>]*>\\s*${heading}\\s*<\\/h2>\\s*<\\/div>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>\\s*<\\/div>`,
    'i',
  )
  const match = String(html ?? '').match(pattern)
  return stripTags(match?.[1] || '')
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: 'India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  const parts = normalized.split(/\s*,\s*/).filter(Boolean)
  if (parts.length >= 2) {
    const [city, state] = parts
    return {
      location: `${city}, ${state}, India`,
      city,
      state,
      country: 'India',
    }
  }

  return {
    location: `${normalized}, India`,
    city: normalized,
    state: null,
    country: 'India',
  }
}

const buildJobDescription = (html, fallbackLocation) => {
  const sections = []
  const locationMatch = String(html ?? '').match(/<h2[^>]*>\s*Job Location:\s*([^<]+?)\s*<\/h2>/i)
  const locationText = normalizeWhitespace(locationMatch?.[1] || fallbackLocation || '')

  if (locationText) {
    sections.push(`Job Location: ${locationText}`)
  }

  for (const heading of ['Department Details', 'Role Summary', 'Key Responsibilities']) {
    const content = extractSectionText(html, heading)
    if (content) {
      sections.push(`${heading}: ${content}`)
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : null
}

export const extractJobDetail = (html, listing = {}) => {
  const rawHtml = String(html ?? '')
  const bodyText = stripTags(rawHtml) || ''
  const title = normalizeWhitespace(
    (stripTags(rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || listing.title || '') || '')
      .replace(/^Career Opportunities:\s*/i, '')
      .replace(/\s*\(([^)]+)\)\s*$/i, ''),
  )
  const requisitionId = normalizeWhitespace(
    bodyText.match(/\bRequisition ID\s*([0-9]+)\b/i)?.[1] || listing.requisitionId || listing.jobId,
  )
  const postingDate = toIsoDate(
    bodyText.match(/\bPosted\s*([0-9/]{10})\b/i)?.[1] || listing.postingDate,
  )
  const department = extractSectionText(rawHtml, 'Department Details') || listing.department || null
  const locationMatch = rawHtml.match(/<h2[^>]*>\s*Job Location:\s*([^<]+?)\s*<\/h2>/i)
  const locationText = normalizeWhitespace(locationMatch?.[1] || '')
  const parsedLocation = parseLocation(locationText)
  const jobDescription = buildJobDescription(rawHtml, locationText) || listing.jobDescription || null

  return {
    title: title || listing.title || null,
    requisitionId,
    postingDate,
    department,
    location: parsedLocation.location,
    city: parsedLocation.city,
    state: parsedLocation.state,
    country: 'India',
    applyUrl: buildDetailUrl(requisitionId || listing.requisitionId || listing.jobId),
    jobDescription,
  }
}

const defaultFetchText = (url, options = {}) => fetchBioconFirstPartyText(url, options)

export const getLiveSearchPages = async ({
  fetchText = defaultFetchText,
  searchUrl = SUCCESSFACTORS_SEARCH_URL,
  fetchSearchSession = (options = {}) => fetchSuccessFactorsSearchSession(options),
  fetchDwrText = (options = {}) => postSuccessFactorsDwr(options),
  signal,
} = {}) => {
  const read = async operation => {
    signal?.throwIfAborted()
    try {
      const result = await operation()
      signal?.throwIfAborted()
      return result
    } catch (error) {
      signal?.throwIfAborted()
      throw error
    }
  }
  const html = await read(() => fetchText(searchUrl, { signal }))

  if (hasStaticSuccessFactorsSearchPageSignal(html)) {
    if (hasNextPage(html)) {
      throw new Error(
        'Biocon API-only migration required: the verified SuccessFactors board requires pagination, but no HTTP pagination request contract is available; browser automation is disabled.',
      )
    }

    return [html]
  }

  if (!hasSuccessFactorsDwrBootstrapSignal(html)) {
    return [html]
  }

  const session = await read(() => fetchSearchSession({
    signal,
    searchUrl,
    userAgent: USER_AGENT,
    label: `${SOURCE}-successfactors-bootstrap`,
    missingAjaxTokenErrorMessage:
      'Biocon verified SuccessFactors search bootstrap no longer exposes an ajaxSecKey token',
  }))

  if (!hasSuccessFactorsDwrBootstrapSignal(session.html)) {
    throw new Error('Biocon verified public SuccessFactors search surface no longer matches the known page')
  }

  const scriptSessionId = createSuccessFactorsScriptSessionId()
  const initialResponse = await read(() => fetchDwrText({
    signal,
    searchUrl,
    endpoint: 'getInitialJobSearchData',
    body: buildInitialSearchDwrBody({ searchUrl, scriptSessionId }),
    csrfToken: session.csrfToken,
    cookieHeader: session.cookieHeader,
    companyToken: SUCCESSFACTORS_COMPANY_TOKEN,
    userAgent: USER_AGENT,
    label: `${SOURCE}-successfactors-getInitialJobSearchData`,
    responseContractErrorMessage:
      'Biocon verified SuccessFactors getInitialJobSearchData response no longer matches the expected DWR contract',
    subaction: 0,
  }))
  const initialPayload = extractDwrPayload(initialResponse, {
    parseErrorMessage: 'Biocon verified SuccessFactors DWR search payload could not be parsed',
    missingResultsErrorMessage: 'Biocon verified SuccessFactors DWR payload no longer exposes postings',
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
  const sortByColumn = normalizeWhitespace(initialPayload.results.options?.sortByColumn) || undefined
  const sortOrder = normalizeWhitespace(initialPayload.results.options?.sortOrder) || undefined
  const pages = [initialResponse]

  for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
    pages.push(await read(() => fetchDwrText({
      signal,
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
      userAgent: USER_AGENT,
      label: `${SOURCE}-successfactors-search`,
      responseContractErrorMessage:
        'Biocon verified SuccessFactors search response no longer matches the expected DWR contract',
      subaction: currentPage - 1,
    })))
  }

  return pages
}

export const collectSummaryPages = (pages) => {
  const listings = []
  const seenRequisitionIds = new Set()

  if (!Array.isArray(pages) || pages.length === 0 || !hasSuccessFactorsSearchPageSignal(pages[0])) {
    throw new Error('Biocon verified public SuccessFactors search surface no longer matches the known page')
  }

  if (hasZeroResultsSignal(pages[0]) && extractSearchResults(pages[0]).length === 0) {
    return []
  }

  for (const html of pages) {
    const pageJobs = extractSearchResults(html)

    for (const job of pageJobs) {
      if (seenRequisitionIds.has(job.requisitionId)) continue
      seenRequisitionIds.add(job.requisitionId)
      listings.push(job)
    }
  }

  return listings
}

export const createBioconScraper = ({
  fetchText = defaultFetchText,
  getSearchPages = (options = {}) => getLiveSearchPages({ ...options, fetchText }),
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ signal } = {}) {
    const read = async operation => {
      signal?.throwIfAborted()
      try {
        const result = await operation()
        signal?.throwIfAborted()
        return result
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const readText = (url, options = {}) => read(() => fetchText(url, { ...options, signal: signal || options.signal }))
    const careersHtml = await readText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Biocon verified official careers page no longer matches the known public surface')
    }

    const handoffUrl = extractSuccessFactorsHandoffUrl(careersHtml)
    if (handoffUrl !== SUCCESSFACTORS_BOARD_URL) {
      throw new Error('Biocon verified Biocon careers page no longer exposes the known SuccessFactors handoff')
    }

    const searchPages = await read(() => getSearchPages({ searchUrl: SUCCESSFACTORS_SEARCH_URL, fetchText: readText, signal }))
    const listings = collectSummaryPages(searchPages)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await readText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...listing,
        ...detail,
        source: SOURCE,
        company: COMPANY_NAME,
        country: 'India',
        companyCareerPage: CAREERS_PAGE_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        link: detail.applyUrl || listing.applyUrl || listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createBioconScraper(options).run(options)

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
