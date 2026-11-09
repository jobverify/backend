import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { K7_COMPUTING_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = K7_COMPUTING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html)

  return /<title[^>]*>\s*Careers(?:\s*(?:&#8211;|&ndash;|–|-)\s*K7 Security)?\s*<\/title>/i.test(page)
    && /Careers at K7 Computing/i.test(page)
    && /Current Openings/i.test(page)
}

export const hasVerifiedEmptyCareersSignal = (html = '') => {
  const text = normalizeText(html)
  return text.includes('We currently have no job openings')
}

const extractLocation = (text) => {
  if (/abu dhabi/i.test(text)) return 'Abu Dhabi'
  return null
}

export const extractK7ComputingJobs = (html = '') => {
  const page = String(html)
  const jobs = []
  const seen = new Set()

  const listingMatches = [...page.matchAll(
    /<div class="awsm-job-listing-item[\s\S]*?<h2 class="awsm-job-post-title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?<div class="awsm-job-specification-item awsm-job-specification-job-location">\s*<span class="awsm-job-specification-term">([\s\S]*?)<\/span>[\s\S]*?<a class="awsm-job-more" href="([^"]+)">/gi,
  )]

  for (const match of listingMatches) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = normalizeText(match[2])
    const location = normalizeText(match[3]) || extractLocation(match[0])
    const applyUrl = toAbsoluteUrl(match[4]) || sourceUrl
    if (!sourceUrl || !title || seen.has(sourceUrl)) continue

    const cardText = normalizeText(match[0])
    const normalizedLocation = location || extractLocation(cardText)
    jobs.push({
      title,
      location: normalizedLocation,
      country: normalizedLocation === 'Abu Dhabi' ? 'United Arab Emirates' : null,
      sourceUrl,
      applyUrl,
      jobType: null,
    })
    seen.add(sourceUrl)
  }

  if (jobs.length > 0) {
    return jobs
  }

  for (const match of page.matchAll(/<article\b[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const cardHtml = match[1]
    const sourceUrl = toAbsoluteUrl(cardHtml.match(/<a\b[^>]*href=["']([^"']*\/index\.php\/jobs\/[^"']+)["'][^>]*>[\s\S]*?<\/a>/i)?.[1])
    const title = normalizeText(cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    if (!sourceUrl || !title || seen.has(sourceUrl)) continue

    const cardText = normalizeText(cardHtml)
    const location = extractLocation(cardText)
    jobs.push({
      title,
      location,
      country: location === 'Abu Dhabi' ? 'United Arab Emirates' : null,
      sourceUrl,
      applyUrl: sourceUrl,
      jobType: null,
    })
    seen.add(sourceUrl)
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createK7ComputingScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified K7 Computing careers surface no longer matches the trusted first-party jobs page')
    }

    if (hasVerifiedEmptyCareersSignal(careersHtml)) {
      return []
    }

    return extractK7ComputingJobs(careersHtml)
  },
})

export const run = async (options = {}) => createK7ComputingScraper().run(options)

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
