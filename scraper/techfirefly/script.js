import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TECH_FIREFLY_CATALOG as PROVIDER_METADATA } from './catalog.js'

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

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'UND_ERR_CONNECT_TIMEOUT'
    || /\bconnect timeout\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

export const hasOfficialCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Careers At Techfirefly/i.test(text)
    && text.includes('[my_elementor_caree]')
    && /Apply now for success/i.test(text)
    && /Tech Firefly/i.test(text)
}

export const hasPublicJobsSignal = (html = '') =>
  /<article\b/i.test(String(html ?? ''))
  || /class=["'][^"']*job[-\s]?card/i.test(String(html ?? ''))
  || /<a[^>]+>\s*Apply now\s*<\/a>/i.test(String(html ?? ''))
  || /href=["'][^"']*(?:\/jobs?\/[^"']+|\/careers?\/[^"']+)["']/i.test(String(html ?? ''))

export const createTechFireflyScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    try {
      const careersHtml = await fetchText(CAREERS_URL)

      if (hasPublicJobsSignal(careersHtml)) {
        throw new Error('Tech Firefly careers surface now appears to expose public jobs')
      }

      if (!hasOfficialCareersShellSignal(careersHtml)) {
        throw new Error('Tech Firefly verified careers page no longer matches the trusted placeholder surface')
      }

      return []
    } catch (error) {
      if (hasConnectTimeoutFailure(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createTechFireflyScraper().run(options)

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
