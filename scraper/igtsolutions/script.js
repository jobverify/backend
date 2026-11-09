import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

import { IGT_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = IGT_SOLUTIONS_CATALOG.source
export const COMPANY = IGT_SOLUTIONS_CATALOG.companyName
export const VERIFIED_ON = IGT_SOLUTIONS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = IGT_SOLUTIONS_CATALOG.verifiedSurfaceSummary
export const CAREERS_URL = IGT_SOLUTIONS_CATALOG.companyCareerPage
export const JOIN_SQUAD_URL = 'https://atain.com/join-the-squad/'
export const LEGACY_BOARD_URLS = [
  'https://careers.igtsolutions.com/',
  'https://careers.igtsolutions.com/go/India/8956655/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /class=["'][^"']*jobTitle-link[^"']*["']/i,
  /\bjobRecordsFound\b/i,
  /\bcurrent openings\b/i,
  /\bsearch jobs\b/i,
  /\/job\/[A-Za-z0-9_-]+\b/i,
  /\/jobs\/details\//i,
  /jobId=/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /careers\.smartrecruiters\.com/i,
  /jobs\.smartrecruiters\.com/i,
  /jobs\.jobvite\.com/i,
  /oraclecloud\.com\/[^"'<>]*\/job\//i,
  /darwinbox\.(?:com|in)\/career/i,
  /icims\.com\/jobs\//i,
  /taleo\.net\/careersection/i,
]

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const normalizeWhitespace = (value) => stripScriptAndStyle(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const page = await fetchPageWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 1,
    label: SOURCE,
    timeoutMs: 15000,
  })

  return page
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at Atain\s*\|\s*Grow, Innovate and Create Real Impact\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/atain\.com\/careers\/["']/i.test(rawHtml)
    && /href=["']https:\/\/atain\.com\/join-the-squad\/["']/i.test(rawHtml)
    && normalized.includes('IGT Solutions Rebrands as Atain')
}

export const hasJoinSquadSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Join the Squad/i.test(normalized)
    && /Upload Resume/i.test(normalized)
    && (
      /Accommodations@atain\.com/i.test(rawHtml)
      || /\breasonable accommodations\b/i.test(normalized)
    )
    && !hasPublicJobsSignal(rawHtml)
}

export const hasSapRecruitingLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /AI Recruiting Software &amp; ATS/i.test(rawHtml)
    && /SmartRecruiters for SAP SuccessFactors/i.test(rawHtml)
    && normalized.includes('SmartRecruiters for SAP SuccessFactors')
}

export const isLegacyBoardUnavailable = (page = {}, requestedUrl = '') => {
  const status = Number(page.status)
  const rawUrl = String(page.url || '')
  const requested = String(requestedUrl || '')
  const legacyHostSeen = /careers\.igtsolutions\.com/i.test(`${requested} ${rawUrl}`)
  const redirectedToSapLanding = /https:\/\/www\.sap\.com\/products\/hcm\/recruiting-software\.html/i.test(rawUrl)

  return legacyHostSeen
    && (
      ([401, 403, 404].includes(status) && !hasPublicJobsSignal(page.html))
      || (
        status === 200
        && redirectedToSapLanding
        && hasSapRecruitingLandingSignal(page.html)
        && !hasPublicJobsSignal(page.html)
      )
    )
}

export const createIgtSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({
          userAgent: USER_AGENT,
          settleTimeMs: 4000,
        })
      }

      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchPage(url)
    })

    const fetchPageWithBrowserFallback = async (url) => {
      try {
        return await fetchPage(url)
      } catch (error) {
        if (!shouldUseBrowserFallback(error)) {
          throw error
        }

        return browserPageFetcher(url)
      }
    }

    try {
      const careersPage = await fetchPageWithBrowserFallback(CAREERS_URL)
      if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
        throw new Error('IGT Solutions verified official careers page no longer matches the known first-party surface')
      }

      if (hasPublicJobsSignal(careersPage.html)) {
        throw new Error('IGT Solutions careers page now appears to expose a public jobs board')
      }

      const joinSquadPage = await fetchPageWithBrowserFallback(JOIN_SQUAD_URL)
      if (joinSquadPage.status !== 200 || !hasJoinSquadSignal(joinSquadPage.html)) {
        throw new Error('IGT Solutions verified join-the-squad page no longer matches the known first-party form surface')
      }

      for (const legacyUrl of LEGACY_BOARD_URLS) {
        const legacyPage = await fetchPageWithBrowserFallback(legacyUrl)
        if (!isLegacyBoardUnavailable(legacyPage, legacyUrl)) {
          throw new Error(`IGT Solutions legacy careers board changed: ${legacyPage.url || legacyUrl}`)
        }
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close().catch(() => {})
      }
    }
  },
})

export const run = async (options = {}) => createIgtSolutionsScraper().run(options)

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
