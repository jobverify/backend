import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GENIUS_ADVISOR_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(careers?|jobs?|current openings|open positions|apply now|search jobs|join our team)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const FIRST_PARTY_PAGE_URLS = [
  PROVIDER_METADATA.homepageUrl,
  PROVIDER_METADATA.aboutUsUrl,
  PROVIDER_METADATA.contactUsUrl,
]
export const FIRST_PARTY_CAREER_ROUTES = [...PROVIDER_METADATA.firstPartyCareerRoutes]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

const isDnsError = (error) => {
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(causeCode)
    || /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(causeMessage)
    || /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)
}

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'The Genius Advisors | Homepage'
    && text.includes('Who We Are?')
    && text.includes('Mumbai, India')
    && text.includes('+91 96862 04879')
    && text.includes('Start a Conversation')
}

export const hasOfficialAboutSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'The Genius Advisors | About Us'
    && text.includes('Who We Are?')
    && text.includes('Jai M Bihani Founder & Principal Advisor')
    && text.includes('Mumbai, India')
    && text.includes('+91 96862 04879')
}

export const hasOfficialContactSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'The Genius Advisors | Contact Us'
    && text.includes('Get in Touch')
    && text.includes('Jai M Bihani')
    && text.includes('Mumbai, India')
    && text.includes('+91 96862 04879')
}

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isUnexpectedReachableSurface = (surface = {}) =>
  isReachableSurface(surface) && PUBLIC_JOBS_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))

export const isVerifiedBrochureFallbackSurface = (surface = {}) => {
  if (!isReachableSurface(surface) || typeof surface?.html !== 'string') {
    return false
  }

  return hasOfficialHomepageSignal(surface.html)
    || hasOfficialAboutSignal(surface.html)
    || hasOfficialContactSignal(surface.html)
}

const defaultFetchText = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

const defaultProbeUrl = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    }

    if (isDnsError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

const assertExpectedCareerRouteSurface = (surface) => {
  if (isExpectedTimedOutSurface(surface) || isVerifiedBrochureFallbackSurface(surface)) {
    return
  }

  if (isUnexpectedReachableSurface(surface)) {
    throw new Error(`${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url}`)
  }

  if (isReachableSurface(surface)) {
    throw new Error(`${COMPANY} verified adjacent careers route changed materially: ${surface.finalUrl || surface.url}`)
  }

  throw new Error(`${COMPANY} verified adjacent careers route changed materially: ${surface.url}`)
}

export const createGeniusAdvisorScraper = () => ({
  async run({ fetchText = defaultFetchText, probeUrl = defaultProbeUrl } = {}) {
    const homepageHtml = await fetchText(FIRST_PARTY_PAGE_URLS[0])
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Genius Advisor verified homepage changed materially')
    }

    const aboutHtml = await fetchText(FIRST_PARTY_PAGE_URLS[1])
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Genius Advisor verified about page changed materially')
    }

    const contactHtml = await fetchText(FIRST_PARTY_PAGE_URLS[2])
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Genius Advisor verified contact page changed materially')
    }

    for (const url of FIRST_PARTY_CAREER_ROUTES) {
      const surface = await probeUrl(url)
      assertExpectedCareerRouteSurface(surface)
    }

    return []
  },
})

export const run = async (options = {}) => createGeniusAdvisorScraper().run(options)

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
