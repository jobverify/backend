import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INSIDEVIEW_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = INSIDEVIEW_CATALOG.source
export const COMPANY = INSIDEVIEW_CATALOG.companyName
export const VERIFIED_ON = INSIDEVIEW_CATALOG.verifiedOn
export const ROOT_URL = INSIDEVIEW_CATALOG.companyCareerPage
export const REDIRECTED_HOMEPAGE_URL = INSIDEVIEW_CATALOG.redirectedHomepageUrl
export const LEGACY_LOGIN_URL = INSIDEVIEW_CATALOG.legacyLoginUrl
export const PROVIDER_METADATA = INSIDEVIEW_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

const matchesExpectedUrl = (value, expected) => {
  try {
    const url = new URL(value)
    const expectedUrl = new URL(expected)

    return url.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && url.pathname.replace(/\/+$/, '') === expectedUrl.pathname.replace(/\/+$/, '')
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasRedirectedDemandbaseHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*(?:ABM Platform for B2B Sales (?:&|&amp;) Marketing Success\s*\|\s*)?Demandbase\b/i.test(rawHtml)
    && (
      /Smarter GTM Starts Here/i.test(normalized)
      || /The pipeline engine for AI GTM that aligns teams to turn goals into revenue/i.test(normalized)
    )
    && /Pricing/i.test(normalized)
    && /Company/i.test(normalized)
    && /Careers/i.test(normalized)
  }

export const hasRetiredInsideViewRootSignal = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  return Number(page.status) === 403
    && matchesExpectedUrl(page.url, ROOT_URL)
    && /<title>\s*It works! Apache httpd\s*<\/title>/i.test(rawHtml)
    && /^It works! Apache httpd It works!$/i.test(normalized)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasLegacyInsideViewLoginSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*InsideView\s*(?:\||:)\s*(?:Forgot Password|Set Password)\s*<\/title>/i.test(rawHtml)
    && /Forgot your password\?/i.test(normalized)
    && (
      /Business Email/i.test(normalized)
      || /Submit your Email ID below to set a new password\./i.test(normalized)
    )
    && /\bSubmit\b/i.test(normalized)
    && /InsideView/i.test(normalized)
  }

export const createInsideViewScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const rootPage = await fetchPage(ROOT_URL)
    const matchesDemandbaseRedirect = (
      rootPage.status !== 200
        ? false
        : matchesExpectedUrl(rootPage.url, REDIRECTED_HOMEPAGE_URL)
          && hasRedirectedDemandbaseHomepageSignal(rootPage.html)
    )
    if (!matchesDemandbaseRedirect && !hasRetiredInsideViewRootSignal(rootPage)) {
      throw new Error('InsideView verified legacy root redirect no longer matches the Demandbase homepage surface')
    }

    if (hasPublicJobsSignal(rootPage.html)) {
      throw new Error('InsideView redirected homepage now appears to expose public jobs')
    }

    const legacyLoginPage = await fetchPage(LEGACY_LOGIN_URL)
    if (
      legacyLoginPage.status !== 200
      || !matchesExpectedUrl(legacyLoginPage.url, LEGACY_LOGIN_URL)
    ) {
      throw new Error('InsideView verified legacy login surface no longer matches the known exact-name page')
    }

    if (hasPublicJobsSignal(legacyLoginPage.html)) {
      throw new Error('InsideView legacy login surface now appears to expose public jobs')
    }

    if (!hasLegacyInsideViewLoginSignal(legacyLoginPage.html)) {
      throw new Error('InsideView verified legacy login surface no longer matches the known exact-name page')
    }

    return []
  },
})

export const run = async (options = {}) => createInsideViewScraper().run(options)

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
