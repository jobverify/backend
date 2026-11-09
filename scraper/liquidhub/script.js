import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIQUIDHUB_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const ROOT_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECTED_HOMEPAGE_URL = PROVIDER_METADATA.redirectedHomepageUrl

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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasRedirectedHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Capgemini\s*-\s*Make it real\.\s*<\/title>/i.test(rawHtml)
    && /Capgemini/i.test(normalized)
    && /Careers/i.test(normalized)
    && /About us/i.test(normalized)
}

export const createLiquidHubScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const rootPage = await fetchPage(ROOT_URL)
    if (
      rootPage.status !== 200
      || !matchesExpectedUrl(rootPage.url, REDIRECTED_HOMEPAGE_URL)
    ) {
      throw new Error('LiquidHub verified exact-name root redirect no longer matches the Capgemini homepage surface')
    }

    if (hasPublicJobsSignal(rootPage.html)) {
      throw new Error('LiquidHub exact-name domain now appears to expose public jobs')
    }

    if (!hasRedirectedHomepageSignal(rootPage.html)) {
      throw new Error('LiquidHub verified exact-name root redirect no longer matches the Capgemini homepage surface')
    }

    return []
  },
})

export const run = async (options = {}) => createLiquidHubScraper().run(options)

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
