import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ONE_ASSIST_CATALOG } from './catalog.js'

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
  /\bjob description\b/i,
  /\bview all open positions\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /icims/i,
  /taleo/i,
]

export const SOURCE = ONE_ASSIST_CATALOG.source
export const COMPANY = ONE_ASSIST_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ONE_ASSIST_CATALOG.officialBrandName
export const VERIFIED_ON = ONE_ASSIST_CATALOG.verifiedOn
export const PROVIDER_METADATA = ONE_ASSIST_CATALOG
export const HOMEPAGE_URL = ONE_ASSIST_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = ONE_ASSIST_CATALOG.officialCareersPageUrl

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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Mobile,\s*Laptop,\s*Wallet\s*&(?:amp;)?\s*Credit Card Protection,\s*Repair Services\s*\|\s*OneAssist\s*<\/title>/i.test(page)
    && normalized.includes('OUR COMPANY')
    && normalized.includes('Careers')
    && normalized.includes('OneAssist')
    && normalized.includes('Great Place to Work')
}

export const extractVerifiedCareersPageUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/careers\.oneassist\.in\/\?utm_source=website&utm_medium=website_footer&utm_campaign=footer)["'][^>]*>\s*Careers\s*</i,
  )

  return match?.[1] || null
}

export const hasBrokenCareersSurfaceSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Error:\s*Active domain connection for this domain not found\s*<\/title>/i.test(page)
    && normalized.includes('active domain connection')
    && normalized.includes('WordPress.com')
}

export const isExpectedTlsFailure = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /ERR_TLS_CERT_ALTNAME_INVALID/i.test(combined)
    || /hostname\/ip does not match certificate/i.test(combined)
    || /wordpress\.com/i.test(combined) && /altname/i.test(combined)
}

export const createOneAssistScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('OneAssist verified official homepage changed materially')
    }

    if (pageExposesPublicJobListings(homepage.html)) {
      throw new Error('OneAssist homepage now appears to expose public jobs')
    }

    const verifiedCareersPageUrl = extractVerifiedCareersPageUrl(homepage.html)
    if (!matchesExpectedUrl(verifiedCareersPageUrl, CAREERS_PAGE_URL)) {
      throw new Error('OneAssist verified homepage careers handoff changed materially')
    }

    let careersPage
    try {
      careersPage = await fetchPage(CAREERS_PAGE_URL)
    } catch (error) {
      if (isExpectedTlsFailure(error)) {
        return []
      }

      throw error
    }

    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('OneAssist careers surface now appears to expose public jobs')
    }

    if (
      matchesExpectedUrl(careersPage.url, CAREERS_PAGE_URL)
      && hasBrokenCareersSurfaceSignal(careersPage.html)
    ) {
      return []
    }

    throw new Error('OneAssist verified broken careers surface changed materially')
  },
})

export const run = async (options = {}) => createOneAssistScraper().run(options)

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
