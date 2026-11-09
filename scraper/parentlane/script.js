import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PARENTLANE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /successfactors/i,
  /taleo/i,
]

export const PROVIDER_METADATA = PARENTLANE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_URL = PROVIDER_METADATA.verifiedMissingCareersRouteUrl
export const SUPPORT_EMAIL = PROVIDER_METADATA.officialSupportEmail

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractSupportEmail = (html = '') => {
  const page = String(html ?? '')
  const mailtoMatch = page.match(/mailto:\s*(info@parentlane\.com)/i)
  if (mailtoMatch?.[1]) return mailtoMatch[1].toLowerCase()

  return normalizeWhitespace(page).match(/\binfo@parentlane\.com\b/i)?.[0]?.toLowerCase() ?? null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Pregnancy Delivery Packages\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.parentlane\.com\/["']/i.test(page)
    && normalized.includes('Parentlane is an AI powered digital health platform')
    && normalized.includes('Download the Parentlane App for Pregnancy Care')
    && extractSupportEmail(page) === SUPPORT_EMAIL
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*About Parentlane - Pregnancy, Parenting, Baby Care & Child Development\s*<\/title>/i.test(page)
    && normalized.includes('Data Science and')
    && normalized.includes('data science and technology firm based in Bangalore, India')
}

export const hasMissingCareersRouteSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*404 Not Found\s*<\/title>/i.test(page)
    && normalized.includes('The requested URL /careers was not found on this server.')
}

export const isExpectedTlsFailure = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /DEPTH_ZERO_SELF_SIGNED_CERT/i.test(combined)
    || /self-signed certificate/i.test(combined)
}

const fetchVerifiedPage = async (url, fetchPage) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (isExpectedTlsFailure(error)) {
      return null
    }

    throw error
  }
}

export const createParentlaneScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchVerifiedPage(HOMEPAGE_URL, fetchPage)
    if (homepage == null) return []

    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Parentlane verified official homepage changed materially')
    }

    if (pageExposesPublicJobListings(homepage.html)) {
      throw new Error('Parentlane homepage now appears to expose public jobs')
    }

    const aboutPage = await fetchVerifiedPage(ABOUT_URL, fetchPage)
    if (aboutPage == null) return []

    if (
      Number(aboutPage.status) !== 200
      || !matchesExpectedUrl(aboutPage.url, ABOUT_URL)
      || !hasOfficialAboutPageSignal(aboutPage.html)
    ) {
      throw new Error('Parentlane verified official about page changed materially')
    }

    if (pageExposesPublicJobListings(aboutPage.html)) {
      throw new Error('Parentlane about page now appears to expose public jobs')
    }

    const careersPage = await fetchVerifiedPage(CAREERS_URL, fetchPage)
    if (careersPage == null) return []

    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('Parentlane careers route now appears to expose public jobs')
    }

    if (
      Number(careersPage.status) === 404
      && matchesExpectedUrl(careersPage.url, CAREERS_URL)
      && hasMissingCareersRouteSignal(careersPage.html)
    ) {
      return []
    }

    throw new Error('Parentlane verified no-careers surface changed materially')
  },
})

export const run = async (options = {}) => createParentlaneScraper().run(options)

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
