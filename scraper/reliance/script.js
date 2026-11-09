import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.ril.com/rilcareers/'
const ENTRY_PATH = 'index.aspx'
const DEFAULT_FUNCTION_CODES = ['307', '308', '311', '312', '315', '321', '324', '331']
const NEXT_BUTTON_NAME = 'ctl00$MainContent$rgJobs$ctl13$lnkNext'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x2F;/gi, '/')
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
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|table|tbody|thead|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<t[dh]\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u2022\u00d8]/g, '-'),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const normalizeTitle = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\[\s*(\d+)\s*\]/g, '( $1 )'),
)

const extractJobId = (value) => extractFirst(/(?:\(|\[)\s*(\d{5,})\s*(?:\)|\])/, value)

const extractFieldHtmlById = (html, fieldId) => extractFirst(
  new RegExp(`<span id="${fieldId}">([\\s\\S]*?)<\\/span>`, 'i'),
  html,
)

const extractLineItems = (value) => {
  const text = String(value ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|table|tbody|thead|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<t[dh]\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u2022\u00d8]/g, '-')

  const lines = decodeHtmlEntities(text)
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line?.replace(/^[-:]+/, '')))
    .filter(Boolean)
    .filter((line) => line !== '.')

  return [...new Set(lines)]
}

const mergeCookies = (cookieJar, response) => {
  const setCookieHeaders = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)

  for (const cookieHeader of setCookieHeaders) {
    const [cookiePair] = String(cookieHeader).split(';')
    const separatorIndex = cookiePair.indexOf('=')
    if (separatorIndex <= 0) continue

    const name = cookiePair.slice(0, separatorIndex).trim()
    const value = cookiePair.slice(separatorIndex + 1).trim()
    if (!name) continue
    cookieJar.set(name, value)
  }
}

const createSessionFetchText = () => {
  const cookieJar = new Map()

  const fetchText = async (url, options = {}, attempt = 0) => {
    try {
      const cookieHeader = [...cookieJar.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(options.body ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: options.referer || url,
            Origin: new URL(BASE_URL).origin,
          } : {}),
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...(options.headers || {}),
        },
        body: options.body,
      })

      mergeCookies(cookieJar, response)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`)
      }

      return response.text()
    } catch (error) {
      if (attempt >= ((config.retryAttempts || 1) - 1)) throw error
      const delay = (config.retryBaseDelayMs || 1000) * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return fetchText(url, options, attempt + 1)
    }
  }

  return fetchText
}

export const extractAspNetState = (html) => {
  const state = {}

  for (const match of String(html).matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)) {
    state[match[1]] = decodeHtmlEntities(match[2])
  }

  return state
}

export const buildSearchPayload = (state = {}, { functionCode } = {}) => ({
  ...state,
  'ctl00$head$txtKeyword': '',
  'ctl00$head$ddlFunction': functionCode || '',
  'ctl00$head$MultiCheckCombo1': '',
  'ctl00$ContentPlaceHolder1$hdnKeyword': '',
  'ctl00$ContentPlaceHolder1$hdnfuncation': functionCode || '',
  'ctl00$ContentPlaceHolder1$hdnLocation': '',
  'ctl00$head$Button1': 'Search',
})

export const extractSearchResultsUrl = (html) => toAbsoluteUrl(
  decodeHtmlEntities(extractFirst(/<form[^>]*action="([^"]*frmJobSearch\.aspx[^"]*)"/i, html) || ''),
)

export const hasNoResults = (html) => /Sorry,\s*there are no current openings that match your search criteria!/i.test(String(html))

export const hasNextPage = (html) => /id="MainContent_rgJobs_lnkNext"/i.test(String(html))
  && !/id="MainContent_rgJobs_lnkNext"[^>]*disabled="disabled"/i.test(String(html))

export const buildNextPagePayload = (state = {}) => ({
  ...state,
  __EVENTTARGET: '',
  __EVENTARGUMENT: '',
  [NEXT_BUTTON_NAME]: 'Next',
})

export const extractListings = (html) => {
  const tbody = extractFirst(/<tbody>([\s\S]*?)<\/tbody>/i, html)
  if (!tbody) return []

  return [...String(tbody).matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const rowHtml = match[1]
      const sourceUrl = toAbsoluteUrl(
        decodeHtmlEntities(extractFirst(/<a id="MainContent_rgJobs_hylUser_\d+" href="([^"]+)"/i, rowHtml) || ''),
      )
      const title = normalizeTitle(
        extractFirst(/<a id="MainContent_rgJobs_hylUser_\d+" href="[^"]+">([\s\S]*?)<\/a>/i, rowHtml),
      )
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((cell) => stripTags(cell[1]))
        .filter(Boolean)

      const department = cells[2] || null
      const location = cells[3] || null
      const postingDate = cells[4] || null
      const jobId = extractJobId(title)

      if (!title || !sourceUrl || !jobId) return null

      return {
        title,
        jobId,
        requisitionId: jobId,
        department,
        location,
        city: location,
        postingDate,
        sourceUrl,
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = listing.title || normalizeTitle(extractFieldHtmlById(html, 'MainContent_lblJobTitle'))
  const location = normalizeWhitespace(extractFieldHtmlById(html, 'MainContent_lblLoc')) || listing.location || null
  const department = normalizeWhitespace(extractFieldHtmlById(html, 'MainContent_lblSec')) || listing.department || null
  const postingDate = normalizeWhitespace(extractFieldHtmlById(html, 'MainContent_lblPostedDate')) || listing.postingDate || null
  const jobId = extractJobId(title || '') || listing.jobId || null

  return {
    title,
    jobId,
    requisitionId: jobId,
    department,
    location,
    city: location,
    postingDate,
    employmentType: 'Full-time',
    experienceRequired: stripTags(extractFieldHtmlById(html, 'MainContent_lblExpReq')),
    jobDescription: stripTags(extractFieldHtmlById(html, 'MainContent_lblSummRole')),
    minimumQualification: stripTags(extractFieldHtmlById(html, 'MainContent_lblEduReq')),
    preferredQualification: null,
    requiredSkills: extractLineItems(extractFieldHtmlById(html, 'MainContent_lblSkill')),
    applyUrl: listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
  }
}

export const run = async () => {
  const fetchText = createSessionFetchText()
  const landingUrl = toAbsoluteUrl(ENTRY_PATH)
  const landingHtml = await fetchText(landingUrl)
  const maxFunctions = Number.isInteger(config.maxFunctions)
    ? config.maxFunctions
    : DEFAULT_FUNCTION_CODES.length
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 10
  const jobs = []
  const seenJobIds = new Set()
  const seenUrls = new Set()

  for (const functionCode of DEFAULT_FUNCTION_CODES.slice(0, maxFunctions)) {
    let pageHtml = await fetchText(landingUrl, {
      method: 'POST',
      body: new URLSearchParams(buildSearchPayload(extractAspNetState(landingHtml), { functionCode })).toString(),
      referer: landingUrl,
    })

    let searchResultsUrl = extractSearchResultsUrl(pageHtml) || toAbsoluteUrl('frmJobSearch.aspx')

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      if (hasNoResults(pageHtml)) break

      const listings = extractListings(pageHtml)
      if (listings.length === 0) break

      for (const listing of listings) {
        if (!listing.sourceUrl || seenUrls.has(listing.sourceUrl)) continue
        seenUrls.add(listing.sourceUrl)

        const detailHtml = await fetchText(listing.sourceUrl, { referer: searchResultsUrl })
        const detail = extractJobDetail(detailHtml, listing)
        const stableId = detail.jobId || listing.jobId || listing.sourceUrl
        if (stableId && seenJobIds.has(stableId)) continue
        if (stableId) seenJobIds.add(stableId)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: 'Reliance Industries Limited',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          link: detail.applyUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.sourceUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'reliance',
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          scrapedAt: new Date().toISOString(),
        })
      }

      if (!hasNextPage(pageHtml)) break

      pageHtml = await fetchText(searchResultsUrl, {
        method: 'POST',
        body: new URLSearchParams(buildNextPagePayload(extractAspNetState(pageHtml))).toString(),
        referer: searchResultsUrl,
      })
      searchResultsUrl = extractSearchResultsUrl(pageHtml) || searchResultsUrl
    }
  }

  return jobs
}
