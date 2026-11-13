import { execFile as execFileCallback } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
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
import {runCurrentBiocon20261113} from './currentNative20261113.js'

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
  normalizeWhitespace(rawHtml)

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

const parseSearchRow = (doc, row) => {
  const titles = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'jobTitle'), row)
  const title = titles.length === 1 ? normalizeWhitespace(doc.text(titles[0])) : null
  // Keep inactive fields as empty positional slots. Dropping a hidden or empty
  // department must never promote another field into the country column.
  const columns = node => node.tag === 'template' ? []
    : node.tag === 'span' && doc.hasClass(node, 'jobContentEM') ? [node]
      : node.children.filter(child => typeof child !== 'string').flatMap(columns)
  const values = columns(row).map(node => normalizeWhitespace(doc.text(node)))

  const requisitionId = normalizeWhitespace(values[0])
  const postingDate = toIsoDate(String(values[1] ?? '').replace(/^Posted on\s*/i, ''))
  const hiringEntity = normalizeWhitespace(values[2])
  const department = normalizeWhitespace(values[3])
  const country = values.length === 5 ? nativeCountryName(values[4]) : null

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
  const doc = readNativeDocument(String(html ?? ''))

  for (const node of doc.nodes(node => node.tag === 'tr' && doc.hasClass(node, 'jobResultItem'))) {
    const row = parseSearchRow(doc, node)
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

      const country = fields.get('filter1') || null
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

const extractSectionText = (doc, heading) => {
  const headings = doc.nodes(node => node.tag === 'h2' && doc.text(node).toLowerCase() === heading.toLowerCase())
  if (headings.length !== 1) return null
  const headingNode = headings[0]
  const parent = doc.nodes(node => node.children.includes(headingNode))[0]
  const elements = parent?.children.filter(child => typeof child !== 'string') || []
  const frame = parent?.tag === 'div' && elements.length === 1 ? parent : headingNode
  const container = doc.nodes(node => node.children.includes(frame))[0]
  const siblings = container?.children.filter(child => typeof child !== 'string') || []
  const content = siblings[siblings.indexOf(frame) + 1]
  if (!content || content.tag !== 'div' || content.inert || doc.nodes(node => node.tag === 'h2', content).length) return null
  // Visibility is evaluated on the original document, before text extraction.
  const activeText = doc.text(content).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return extractActiveDescription(activeText)
}

const extractLocationText = doc => {
  const locations = doc.nodes(node => node.tag === 'h2' && /^Job Location:\s*/i.test(doc.text(node)))
  if (locations.length > 1) throw Object.assign(new Error('Biocon native location identity is ambiguous'), {
    softFailure: true, abortRetries: true, lifecycleCleanupAllowed: false,
  })
  return locations.length === 1 ? normalizeWhitespace(doc.text(locations[0]).replace(/^Job Location:\s*/i, '')) : null
}

const parseLocation = (value, country = null) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: country,
      city: null,
      state: null,
      country,
    }
  }

  const parts = normalized.split(/\s*,\s*/).filter(Boolean)
  const writtenCountry=nativeLocationCountryName(normalized)
  if(writtenCountry)parts.pop()
  const location=writtenCountry||!country?normalized:`${normalized}, ${country}`
  if (parts.length >= 2) {
    const [city, state] = parts
    return {
      location,
      city,
      state,
      country,
    }
  }

  return {
    location,
    city: parts[0] || null,
    state: null,
    country,
  }
}

const buildJobDescription = (doc, fallbackLocation) => {
  const sections = []
  if(!['Role Summary','Key Responsibilities'].some(heading=>extractSectionText(doc,heading)))return null
  // The native posting frame owns all authored sections, including education
  // and experience. Selecting a few known headings drops mandatory criteria.
  const rawNodes = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(rawNodes)]
  const originalFrames = rawNodes(doc.nodes(node => node.tag === 'root')[0])
    .filter(node => node.tag === 'div' && doc.hasClass(node, 'joqReqDescription'))
  if (originalFrames.length) {
    if (originalFrames.length !== 1 || originalFrames[0].inert) return null
    const originalText = doc.text(originalFrames[0])
    return extractActiveDescription(originalText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
  }
  const locationText = extractLocationText(doc) || normalizeWhitespace(fallbackLocation)

  if (locationText) {
    sections.push(`Job Location: ${locationText}`)
  }

  for (const heading of ['Department Details', 'Role Summary', 'Key Responsibilities']) {
    const content = extractSectionText(doc, heading)
    if (content) {
      sections.push(`${heading}: ${content}`)
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : null
}

export const extractJobDetail = (html, listing = {}) => {
  const rawHtml = String(html ?? '')
  const doc=readNativeDocument(rawHtml),root=doc.nodes(node=>node.tag==='root')[0]
  const bodyText=doc.text(root),headings=doc.nodes(node=>node.tag==='h1').map(node=>doc.text(node))
  const nativeHeadingId=headings[0]?.match(/\((\d+)\)\s*$/)?.[1]
  const nativeBodyIds=[...new Set([...bodyText.matchAll(/\bRequisition ID\s*([0-9]+)\b/gi)].map(match=>match[1]))]
  const nativeBodyId=nativeBodyIds[0]
  const nativeId=nativeBodyId||nativeHeadingId
  const listingId=normalizeWhitespace(listing.requisitionId||listing.jobId)
  const fail=message=>{throw Object.assign(Error('Biocon native '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})}
  if(headings.length!==1||nativeBodyIds.length>1||!nativeId||nativeHeadingId&&nativeHeadingId!==nativeId||listingId&&listingId!==nativeId)fail('requisition identity conflicts with listing')
  const title = normalizeWhitespace(
    (headings[0] || '')
      .replace(/^Career Opportunities:\s*/i, '')
      .replace(/\s*\(\d+\)\s*$/i, ''),
  )
  if(!title||listing.title&&title.toLowerCase()!==normalizeWhitespace(listing.title).toLowerCase())fail('title identity conflicts with listing')
  const requisitionId = normalizeWhitespace(
    nativeId,
  )
  let postingDate = toIsoDate(
    bodyText.match(/\bPosted\s*([0-9/]{10})\b/i)?.[1] || listing.postingDate,
  )
  const nativeDateFields = doc.nodes(node => node.tag === 'input' && node.attrs.id === 'postedOnFastDate')
  if (nativeDateFields.length) {
    const patterns = doc.nodes(node => node.tag === 'input' && node.attrs.id === 'pattern')
    if (nativeDateFields.length !== 1 || patterns.length !== 1 || patterns[0].attrs.value !== 'MM/dd/yyyy'
      || !/^\d{13}$/.test(nativeDateFields[0].attrs.value || '')) fail('posting date metadata changed')
    const date = new Date(Number(nativeDateFields[0].attrs.value))
    if (!Number.isFinite(date.getTime())) fail('posting date epoch is invalid')
    // This public detail URL explicitly requests browserTimeZone=Asia/Calcutta.
    // The native client formats its epoch; the DWR date string is ambiguous.
    postingDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
  }
  const department = extractSectionText(doc, 'Department Details') || listing.department || null
  const locationText = extractLocationText(doc)
  const headerCountries=doc.nodes(node=>['div','p'].includes(node.tag)).flatMap(node=>{
    const fields=doc.text(node).split(/\s+-\s+/)
    if(fields.length!==5||fields[0]!==`Requisition ID ${requisitionId}`||!/^Posted\s+[0-9/]{10}$/.test(fields[1]))return[]
    return nativeCountryName(fields[4])?[nativeCountryName(fields[4])]:[]
  })
  const countries=[...new Set([nativeCountryName(listing.country),nativeLocationCountryName(locationText),...headerCountries].filter(Boolean))]
  const parsedLocation = parseLocation(locationText,countries.length===1?countries[0]:null)
  const jobDescription = buildJobDescription(doc, locationText)

  return {
    title: title || listing.title || null,
    requisitionId,
    postingDate,
    department,
    location: parsedLocation.location,
    city: parsedLocation.city,
    state: parsedLocation.state,
    country: parsedLocation.country,
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
      if(!detail.country||!detail.jobDescription)continue

      jobs.push({
        ...listing,
        ...detail,
        source: SOURCE,
        company: COMPANY_NAME,
        sourceScopeComplete:false,
        lifecycleCleanupAllowed:false,
        companyCareerPage: CAREERS_PAGE_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        link: detail.applyUrl || listing.applyUrl || listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:listings.length,
      observedVacancyCount:listings.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_PAGE_URL,firstParty:false,listingComplete:false,
      lifecycleCleanupAllowed:false,pagesFetched:1+searchPages.length+listings.length,reportedTotal:null,indiaFacetCount:null,
      verifiedAt:null,reason:'native-country-and-role-criteria-required;legacy-text-transport-and-company-scope-unverified;cleanup-forbidden'})
  },
})

export const run = async (options = {}) => options.reviewedCurrent || (!options.fetchText && !options.getSearchPages)
  ? runCurrentBiocon20261113(options) : createBioconScraper(options).run(options)

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
