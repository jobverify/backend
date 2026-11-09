import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { ARKA_FINCAP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = ARKA_FINCAP_CATALOG.source
export const COMPANY = ARKA_FINCAP_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ARKA_FINCAP_CATALOG.officialBrandName
export const VERIFIED_ON = ARKA_FINCAP_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ARKA_FINCAP_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ARKA_FINCAP_CATALOG
export const HOMEPAGE_URL = ARKA_FINCAP_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = ARKA_FINCAP_CATALOG.careersPageUrl
export const CAREERS_PORTAL_URL = ARKA_FINCAP_CATALOG.careersPortalUrl
export const CAREERS_API_URL = ARKA_FINCAP_CATALOG.careersApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const createFetchTimeoutSignal = (timeoutMs = FETCH_TIMEOUT_MS) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)

  if (city && country) {
    return { location: `${city}, ${country}`, city, country }
  }

  if (state && country) {
    return { location: `${state}, ${country}`, city: null, country }
  }

  if (country) {
    return { location: country, city: null, country }
  }

  if (city) {
    return { location: city, city, country: null }
  }

  return { location: null, city: null, country: null }
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const hasArkaCareersHref = (html, hrefPath) =>
  new RegExp(`<a\\b[^>]*\\bhref=["'](?:https://www\\.arkafincap\\.com)?${hrefPath}["'][^>]*>`, 'i')
    .test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const title = page.match(/<title\b[^>]*>[^<]*<\/title>/i)?.[0] || ''

  return /<title>[\s\S]*Arka Fincap[\s\S]*(?:&#8211;|&ndash;|â€“|\u2013|-)[\s\S]*Expert Financial Solutions[\s\S]*Services[\s\S]*<\/title>/i.test(
    title,
  )
    && hasArkaCareersHref(page, '/life-at-arka')
    && /https:\/\/arkafincap\.zohorecruit\.in\/jobs\/Careers/i.test(page)
    && />\s*(?:Careers|Life at Arka|Job Openings)\s*</i.test(page)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const title = page.match(/<title\b[^>]*>[^<]*<\/title>/i)?.[0] || ''

  return /<title>[\s\S]*Life at Arka[\s\S]*(?:&#8211;|&ndash;|â€“|\u2013|-)[\s\S]*Work Culture,\s*Careers\s*&(?:amp;)?\s*Growth[\s\S]*<\/title>/i.test(
    title,
  )
    && hasArkaCareersHref(page, '/life-at-arka')
    && /https:\/\/arkafincap\.zohorecruit\.in\/jobs\/Careers/i.test(page)
    && /Our Culture/i.test(page)
    && /Why Join Us\?/i.test(page)
    && /Join Us/i.test(page)
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Arka\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/arkafincap\.zohorecruit\.in\/jobs\/Careers["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && /CareerSite/i.test(page)
    && /Arka/i.test(page)
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const { location, city, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location || !country) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: parsePostingDate(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createFetchTimeoutSignal(),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    signal: createFetchTimeoutSignal(),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const parseBrowserJson = (rawText, url) => {
  try {
    return JSON.parse(String(rawText ?? '').trim())
  } catch (error) {
    throw new Error(`Arka Fincap browser JSON fallback returned invalid JSON for ${url}: ${error.message}`)
  }
}

export const createArkaFincapScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    fetchJson = defaultFetchJson,
    fetchBrowserJson,
    now = () => new Date().toISOString(),
  } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const browserJsonFetcher = fetchBrowserJson || (async (url) => {
      const session = await getBrowserSession()
      const rawText = await session.fetchText(url)
      return parseBrowserJson(rawText, url)
    })

    const fetchPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    const fetchPageJson = async (url) => {
      try {
        return await fetchJson(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserJsonFetcher(url)
      }
    }

    try {
      const homepageHtml = await fetchPageText(HOMEPAGE_URL)
      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('Response is not the verified official Arka Fincap homepage')
      }

      const careersPageHtml = await fetchPageText(CAREERS_PAGE_URL)
      if (!hasOfficialCareersPageSignal(careersPageHtml)) {
        throw new Error('Response is not the verified official Arka Fincap careers page')
      }

      const portalHtml = await fetchPageText(CAREERS_PORTAL_URL)
      if (!hasOfficialPortalSignal(portalHtml)) {
        throw new Error('Response is not the verified official Arka Fincap careers portal')
      }

      const payload = await fetchPageJson(CAREERS_API_URL)
      if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
        throw new Error('Arka Fincap public jobs API no longer returns the verified success payload')
      }

      const jobs = extractIndiaJobs(payload)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createArkaFincapScraper().run(options)

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
