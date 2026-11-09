import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TECHSPIAN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const TRUSTED_PUBLIC_JOB_PATTERNS = [
  /https?:\/\/[^\s"'<>]+boards\.greenhouse\.io[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+job-boards\.greenhouse\.io[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+jobs\.lever\.co[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+(?:myworkdayjobs|workdayjobs)[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+smartrecruiters[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+ashbyhq\.com[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+workable\.com[^\s"'<>]*/gi,
]

export const PROVIDER_METADATA = TECHSPIAN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECTED_CAREERS_URL = PROVIDER_METADATA.redirectedCareersPageUrl
export const CONTACT_URL = PROVIDER_METADATA.officialContactUrl
export const CONTACT_EMAIL = PROVIDER_METADATA.officialContactEmail

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
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
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
      && actualUrl.hash === expectedUrl.hash
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

export const pageExposesPublicJobListings = (html = '') =>
  /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? ''))
  || extractTrustedPublicJobLinks(html).length > 0

export const hasRedirectedAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*About\s*\|\s*Techspian\s*<\/title>/i.test(page)
    && normalized.includes('We were AI-native before it was a slide.')
    && normalized.includes('The people behind the work.')
    && normalized.includes('travel and hospitality technology firm')
    && normalized.includes(CONTACT_EMAIL)
}

export const hasContactPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Contact\s*\|\s*Techspian\s*<\/title>/i.test(page)
    && normalized.includes('Strategy and advisory')
    && normalized.includes('Book a strategy call')
    && normalized.includes(CONTACT_EMAIL)
}

export const createTechspianScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (
      Number(careersPage.status) !== 200
      || !matchesExpectedUrl(careersPage.url, REDIRECTED_CAREERS_URL)
    ) {
      throw new Error('Techspian verified careers redirect changed materially')
    }

    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('Techspian careers surface now appears to expose a public jobs surface')
    }

    if (!hasRedirectedAboutPageSignal(careersPage.html)) {
      throw new Error('Techspian verified careers redirect changed materially')
    }

    const contactPage = await fetchPage(CONTACT_URL)

    if (
      Number(contactPage.status) !== 200
      || !matchesExpectedUrl(contactPage.url, CONTACT_URL)
    ) {
      throw new Error('Techspian verified contact page changed materially')
    }

    if (pageExposesPublicJobListings(contactPage.html)) {
      throw new Error('Techspian contact surface now appears to expose a public jobs surface')
    }

    if (!hasContactPageSignal(contactPage.html)) {
      throw new Error('Techspian verified contact page changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createTechspianScraper().run(options)

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
