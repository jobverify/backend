import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SAASLABS_CATALOG } from './catalog.js'
import {readCurrentSaaSLabs} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SAASLABS_CATALOG
export const SOURCE = SAASLABS_CATALOG.source
export const COMPANY = SAASLABS_CATALOG.companyName
export const CAREERS_URL = SAASLABS_CATALOG.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const JOB_PATH_PATTERN = /\/saas-labs\/(\d+)\/?/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractFirst = (html, pattern) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1]) || null

export const hasKulaListingSignal = (html = '') => {
  const page = String(html).replace(/\s+/g, ' ')
  return /<title[^>]*>\s*Work at SaaS Labs\s*\|\s*Careers for Innovators\s*<\/title>/i.test(page)
    && /SaaS Labs Careers/i.test(page)
    && /Open Positions/i.test(page)
    && /(?:https?:\/\/careers\.kula\.ai)?\/saas-labs\/\d+\/?/i.test(page)
}

const toAbsoluteUrl = (href) => new URL(href, CAREERS_URL).href

const mapListing = (href, block) => {
  const jobPath = href.match(JOB_PATH_PATTERN)
  const sourceUrl = jobPath ? toAbsoluteUrl(href) : null
  const title = extractFirst(block, /<p[^>]*>([\s\S]*?)<\/p>/i)
    || normalizeWhitespace(block.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0])
  const cleanTitle = normalizeWhitespace(title)
  const location = extractFirst(block, /((?:Bengaluru|Bangalore|Noida|Mumbai|Delhi|Gurugram|Gurgaon|Remote)[^<]*(?:India)?)/i)
  const employmentType = extractFirst(block, /(Full Time|Part Time|Contract|Internship|Temporary)/i)

  if (!jobPath || !cleanTitle || !location || !/India/i.test(location)) return null

  const city = location.split(',')[0].trim()
  return {
    title: cleanTitle,
    company: COMPANY,
    location,
    city,
    country: 'India',
    source: SOURCE,
    sourceUrl,
    applyUrl: sourceUrl,
    jobId: jobPath[1],
    requisitionId: jobPath[1],
    employmentType,
    remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
    atsPlatform: SAASLABS_CATALOG.atsPlatform,
  }
}

export const extractJobsFromListingHtml = (html = '') => {
  const jobs = []
  const seen = new Set()
  const anchorPattern = /(?:<p\b[^>]*>[\s\S]*?<\/p>\s*)?<a\b[^>]*href=["']([^"']*\/saas-labs\/\d+\/?)["'][^>]*>[\s\S]*?<\/a>[\s\S]*?(?=<a\b|<\/body\b|$)/gi
  let match

  while ((match = anchorPattern.exec(String(html))) !== null) {
    const job = mapListing(match[1], match[0])
    if (job && !seen.has(job.sourceUrl)) {
      seen.add(job.sourceUrl)
      jobs.push(job)
    }
  }

  return jobs
}

const defaultFetchText = (url, {signal} = {}) => fetchTextWithRetry(url, {
  headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const createSaaSLabsScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, onAudit } = {}) {
    return readCurrentSaaSLabs({fetchText,signal,onAudit})
  },
})

export const run = async (options = {}) => createSaaSLabsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
