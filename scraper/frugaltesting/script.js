import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runFrugalNative,frugalRole} from './native.js'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import FRUGAL_TESTING_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FRUGAL_TESTING_CATALOG
export const SOURCE = FRUGAL_TESTING_CATALOG.source
export const COMPANY = FRUGAL_TESTING_CATALOG.companyName
export const CAREERS_URL = FRUGAL_TESTING_CATALOG.companyCareerPage
export const APPLICATION_FORM_URL = FRUGAL_TESTING_CATALOG.applicationFormUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/[’]/g, "'")
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return (
    normalized.includes('Careers at Frugal')
    || normalized.includes('Accelerate Your Career with Frugal Testing')
    || normalized === 'Careers'
  )
    && /We.?re looking for talented people to join us/i.test(normalized || '')
    && /\/job-openings\//i.test(String(html ?? ''))
}

export const extractJobDetailUrls = (html = '') => [...new Set(
  [...String(html ?? '').matchAll(/href=["']([^"']*\/job-openings\/[a-z0-9-]+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean),
)]

export const parseJobDetailPage = (url, html) => frugalRole(url, html)

export const createFrugalTestingScraper = (configuration = {}) => ({
  run: (options = {}) => runFrugalNative({...configuration, ...options}),
})

export const run = async (options = {}) => createFrugalTestingScraper(options).run(options)

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
