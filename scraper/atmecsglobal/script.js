import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ATMECS_GLOBAL_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 20000,
})

export const isTrustedUnavailableFailure = (error) => {
  const message = String(error?.message ?? error ?? '').toLowerCase()

  return message.includes('enotfound')
    || message.includes('getaddrinfo')
    || message.includes('could not be resolved')
    || (message.includes('net::err_failed') && message.includes('atmecs.com'))
}

export const hasOfficialJobsShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Jobs\s*-\s*ATMECS\s*<\/title>/i.test(page)
    && text.includes('Jobs')
    && text.includes('[jobs]')
    && text.includes('ATMECS Global')
}

export const hasPublicJobsSignal = (html = '') =>
  /<article\b/i.test(String(html ?? ''))
  || /class=["'][^"']*job[-\s]?card/i.test(String(html ?? ''))
  || /Apply now/i.test(String(html ?? ''))
  || /href=["'][^"']*(?:\/jobs?\/[^"']+|\/careers?\/[^"']+)["']/i.test(String(html ?? ''))

export const createAtmecsGlobalScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let jobsHtml
    try {
      jobsHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (isTrustedUnavailableFailure(error)) {
        return []
      }

      throw error
    }

    if (hasPublicJobsSignal(jobsHtml)) {
      throw new Error('ATMECS Global surface now appears to expose public jobs')
    }

    if (!hasOfficialJobsShellSignal(jobsHtml)) {
      throw new Error('ATMECS Global verified first-party jobs page no longer matches the trusted surface')
    }

    return []
  },
})

export const run = async (options = {}) => createAtmecsGlobalScraper().run(options)

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
