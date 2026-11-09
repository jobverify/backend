import path from 'node:path'
import { fileURLToPath } from 'node:url'

import PAISABAZAAR_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = PAISABAZAAR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
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

export const hasPublicRolePagesSignal = (html = '') => [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bapply now\b/i,
  /\/careers\/[^"'\s<]+/i,
  /\.myworkdayjobs\.com/i,
  /boards-api\.greenhouse\.io/i,
].some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return page?.status === 200
    && page?.url === CAREERS_URL
    && normalized.includes('We make personal finance easy, convenient & transparent')
    && normalized.includes('We are committed to empower our Consumers')
    && normalized.includes('Technology Team')
    && normalized.includes('careers+tech@paisabazaar.com')
    && normalized.includes('careers+product@paisabazaar.com')
    && normalized.includes('careers+operations@paisabazaar.com')
    && normalized.includes('U74900HR2011PTC044581')
}

export const createPaisabazaarScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (hasPublicRolePagesSignal(careersPage?.html)) {
      throw new Error('The verified resume-intake-only state no longer matches the current Paisabazaar careers surface')
    }

    if (!hasOfficialCareersSignal(careersPage)) {
      throw new Error('The verified Paisabazaar careers page no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createPaisabazaarScraper().run(options)

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
