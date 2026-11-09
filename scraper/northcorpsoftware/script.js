import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NORTHCORP_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /<title>\s*Northcorp Software\s*<\/title>/i.test(String(html ?? ''))
    && text.includes('below are some open positions with us.')
    && text.includes('Apply online for the position')
}

export const extractJobSummaries = (html = '') => [...String(html ?? '').matchAll(
  /<tr\b[^>]*>[\s\S]*?<td\b[^>]*field-kenexa-jobs-designation[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/td>[\s\S]*?<td\b[^>]*field-kenxa-jobs-updated-date[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td\b[^>]*field-kenexa-jobs-location[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td\b[^>]*field-kenexa-experience-range[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi,
)]
  .map((match) => ({
    title: stripTags(match[1]),
    postedOn: stripTags(match[2]),
    location: stripTags(match[3]),
    experience: stripTags(match[4]),
  }))
  .filter((job) => job.title && job.location)

export const extractJobDetails = (html = '') => {
  const page = String(html ?? '')
  const details = new Map()
  const buttonMatches = [...page.matchAll(/<button\b[^>]*btn btn-link[^>]*>([\s\S]*?)<\/button>/gi)]

  for (let index = 0; index < buttonMatches.length; index += 1) {
    const match = buttonMatches[index]
    const title = stripTags(match[1])
    const nextIndex = buttonMatches[index + 1]?.index ?? page.length
    const section = page.slice(match.index, nextIndex)
    const description = stripTags(section)

    if (title && description) {
      details.set(title, description)
    }
  }

  return details
}

export const createNorthcorpSoftwareScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Northcorp Software verified careers page changed materially')
    }

    const summaries = extractJobSummaries(careersHtml)
    if (summaries.length === 0) {
      throw new Error('Northcorp Software careers page no longer exposes trusted inline job rows')
    }

    const details = extractJobDetails(careersHtml)

    return summaries.map((summary) => ({
      title: summary.title,
      company: COMPANY,
      location: `${summary.location}, India`,
      city: summary.location,
      country: 'India',
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      link: CAREERS_URL,
      jobId: slugify(summary.title),
      requisitionId: summary.title,
      experienceRequired: summary.experience,
      jobDescription: details.get(summary.title) || summary.title,
      source: SOURCE,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createNorthcorpSoftwareScraper(options).run(options)

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
