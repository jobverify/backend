import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { NOISE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NOISE_CATALOG
export const SOURCE = NOISE_CATALOG.source
export const COMPANY = NOISE_CATALOG.companyName
export const CAREERS_URL = NOISE_CATALOG.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const JOB_PATH_PATTERN = /\/jobs\/([A-Za-z0-9]+)\/([A-Za-z0-9-]+)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractFirst = (html, pattern) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1]) || null

export const hasFreshteamListingSignal = (html = '') => {
  const page = String(html)
  return /<title[^>]*>\s*Noise\s*<\/title>/i.test(page)
    && /Open Positions/i.test(page)
    && /(?:https?:\/\/gonoise\.freshteam\.com)?\/jobs\/[A-Za-z0-9]+\/[A-Za-z0-9-]+/i.test(page)
}

const toAbsoluteUrl = (href) => new URL(href, CAREERS_URL).href

const mapListingBlock = (href, block) => {
  const jobPath = href.match(JOB_PATH_PATTERN)
  const slugTitle = jobPath?.[2]?.replace(/-/g, ' ')
  const title = extractFirst(block, /<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/i)
    || normalizeWhitespace(slugTitle).replace(/\b\w/g, (letter) => letter.toUpperCase())
  const location = extractFirst(block, /(Gurgaon|Gurugram|Bengaluru|Bangalore|Mumbai|Delhi|Remote)(?:\s*,\s*India)?/i)
  const employmentType = extractFirst(block, /(Full Time|Part Time|Contract|Internship|Temporary)/i)
  const jobDescription = extractFirst(block, /<p[^>]*>([\s\S]*?)<\/p>/i)

  if (!jobPath || !title || !location) return null

  const sourceUrl = toAbsoluteUrl(href)
  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: location,
    country: 'India',
    source: SOURCE,
    sourceUrl,
    applyUrl: sourceUrl,
    jobId: jobPath[1],
    requisitionId: jobPath[1],
    employmentType,
    experienceRequired: null,
    jobDescription: jobDescription || '',
    remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
    atsPlatform: NOISE_CATALOG.atsPlatform,
  }
}

export const extractJobsFromListingHtml = (html = '') => {
  const jobs = []
  const seen = new Set()
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/jobs\/[A-Za-z0-9]+\/[A-Za-z0-9-]+)["'][^>]*>([\s\S]*?)(?:<\/a>|(?=<a\b))/gi
  let match

  while ((match = anchorPattern.exec(String(html))) !== null) {
    const job = mapListingBlock(match[1], match[2])
    if (job && !seen.has(job.sourceUrl)) {
      seen.add(job.sourceUrl)
      jobs.push(job)
    }
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': USER_AGENT,
  },
  label: 'noise-freshteam-listing',
})

export const createNoiseScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasFreshteamListingSignal(html)) {
      throw new Error('Noise verified Freshteam listing no longer matches the known public surface')
    }
    return extractJobsFromListingHtml(html)
  },
})

export const run = async (options = {}) => createNoiseScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
