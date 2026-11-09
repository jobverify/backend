import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TOPPR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const TRUSTED_PUBLIC_JOB_PATTERNS = [
  /https?:\/\/[^\s"'<>]+toppr\.jobsoid\.com[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|myworkdayjobs|workdayjobs|smartrecruiters|ashbyhq\.com|workable\.com|jobsoid\.com)[^\s"'<>]*/gi,
]

const PUBLIC_JOB_COPY_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bwe hire with jobsoid\b/i,
]

export const PROVIDER_METADATA = TOPPR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const STANDALONE_JOBS_BOARD_URL = PROVIDER_METADATA.standaloneJobsBoardUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

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

export const extractTrustedPublicJobLinks = (html = '') => {
  const page = String(html ?? '')
  const links = new Set()

  for (const pattern of TRUSTED_PUBLIC_JOB_PATTERNS) {
    for (const match of page.matchAll(pattern)) {
      links.add(match[0])
    }
  }

  return [...links]
}

export const pageExposesPublicJobListings = (html = '') => {
  const page = String(html ?? '')

  return PUBLIC_JOB_COPY_PATTERNS.some((pattern) => pattern.test(page))
    || extractTrustedPublicJobLinks(page).length > 0
}

export const isExpectedVerificationFailure = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /DEPTH_ZERO_SELF_SIGNED_CERT/i.test(combined)
    || /self-signed certificate/i.test(combined)
    || /Could not establish trust relationship for the SSL\/TLS secure channel/i.test(combined)
    || /UND_ERR_CONNECT_TIMEOUT/i.test(combined)
    || /Connect Timeout Error/i.test(combined)
    || /\bfetch failed\b/i.test(message)
}

const fetchVerifiedPage = async (url, fetchPage) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (isExpectedVerificationFailure(error)) {
      return null
    }

    throw error
  }
}

export const createTopprScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchVerifiedPage(CAREERS_URL, fetchPage)
    if (careersPage == null) return []

    if (Number(careersPage.status) !== 200 || !matchesExpectedUrl(careersPage.url, CAREERS_URL)) {
      throw new Error('Toppr exact-name careers route changed materially')
    }

    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('Toppr careers route now appears to expose a public jobs surface')
    }

    throw new Error('Toppr exact-name careers route became reachable and requires re-verification')
  },
})

export const run = async (options = {}) => createTopprScraper().run(options)

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
