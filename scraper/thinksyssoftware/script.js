import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import THINKSYS_SOFTWARE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = THINKSYS_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|noida|gurugram|hyderabad|bengaluru|pune|remote)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'thinksys.com') return null
    return url.toString()
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

const cleanTitle = (value) => normalizeWhitespace(value)
  .replace(/\s*\|\s*ThinkSys\s*$/i, '')
  .replace(/\s*Jobs at ThinkSys\s*$/i, '')
  .trim()

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Current Openings')
    && normalized.includes('Apply Now')
    && normalized.includes('ThinkSys')
  }

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<article[^>]*class=["'][^"']*career-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
)]
  .map((match) => {
    const block = match[1]
    const title = cleanTitle(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const location = normalizeWhitespace(block.match(/class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const experienceRequired = normalizeWhitespace(block.match(/class=["'][^"']*experience[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]) || null
    const sourceUrl = toAbsoluteUrl(block.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])

    if (!title || !location || !sourceUrl || !INDIA_LOCATION_PATTERN.test(location)) return null

    return {
      title,
      location,
      experienceRequired,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html = '', sourceUrl) => {
  const applyUrl = toAbsoluteUrl(String(html ?? '').match(/<a[^>]*href=["']([^"']*#apply[^"']*)["']/i)?.[1]) || `${sourceUrl}#apply`
  const requiredSkills = extractListItems(String(html ?? '').match(/<h2[^>]*>\s*Key Responsibilities\s*<\/h2>([\s\S]*?)<\/ul>/i)?.[1])
  const jobDescription = normalizeWhitespace(
    String(html ?? '').match(/<h2[^>]*>\s*Requirements\s*<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1],
  ) || null

  return {
    applyUrl,
    requiredSkills,
    jobDescription,
  }
}

export const createThinksysSoftwareScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Thinksys Software careers surface changed materially')
    }

    const jobs = []

    for (const card of extractJobCards(careersHtml)) {
      const detailHtml = await fetchText(card.sourceUrl)
      const detail = extractJobDetail(detailHtml, card.sourceUrl)

      jobs.push({
        title: card.title,
        company: COMPANY,
        department: null,
        location: card.location,
        city: normalizeWhitespace(card.location.split(',')[0] || card.location),
        country: 'India',
        jobId: slugify(card.title),
        requisitionId: slugify(card.title),
        sourceUrl: card.sourceUrl,
        applyUrl: detail.applyUrl,
        employmentType: null,
        experienceRequired: card.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: detail.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: /\bremote\b/i.test(card.location) ? 'Remote' : 'On-site',
        source: SOURCE,
        link: detail.applyUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createThinksysSoftwareScraper().run(options)

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
