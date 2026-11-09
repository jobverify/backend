import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { D2K_TECHNOLOGIES_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = D2K_TECHNOLOGIES_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.d2ktechnologies.com') return null
    return url.toString()
  } catch {
    return null
  }
}

const extractBullets = (html = '') => [...String(html ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractLastMatch = (input, pattern) => {
  let value = null
  for (const match of String(input ?? '').matchAll(pattern)) {
    value = normalizeWhitespace(match[1])
  }
  return value
}

const extractLastBulletsBlock = (input) => {
  let block = null
  for (const match of String(input ?? '').matchAll(/<ul[^>]*class="font_8 wixui-rich-text__text"[\s\S]*?<\/ul>/gi)) {
    block = match[0]
  }
  return block
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Careers\s*\|\s*D2K Technologies\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Current Openings')
    && normalized.includes('D2K Technologies India Pvt. Ltd.')
}

export const extractJobCards = (html = '') => {
  const jobs = []
  const applyPattern = /<a[^>]*href="([^"]+)"[^>]*aria-label="Apply Now"[^>]*>/gi

  let previousApplyEnd = 0
  for (const match of String(html ?? '').matchAll(applyPattern)) {
    const applyUrl = toAbsoluteUrl(match[1])
    if (!applyUrl) throw new Error('D2K incomplete application identity')

    const snippet = String(html ?? '').slice(previousApplyEnd, match.index)
    previousApplyEnd = match.index + match[0].length
    const title = extractLastMatch(snippet, /letter-spacing:0\.05em;" class="wixui-rich-text__text">([^<]+)<\/span>/gi)
    const experience = extractLastMatch(snippet, /Experience:\s*([^<]+)/gi)
    const bullets = extractBullets(extractLastBulletsBlock(snippet) || '')

    if (!title || !experience) throw new Error('D2K incomplete role card')
    if (/^others?$/i.test(title)) continue
    const location = extractLastMatch(snippet, /Job Location:\s*([^<]+)/gi)
    const india = /(?:^|,\s*)India$/i.test(location || '')

    jobs.push({
      title,
      location,
      city: india ? location.split(',')[0].trim() : null,
      country: india ? 'India' : null,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: 'Full Time',
      experienceRequired: experience,
      jobDescription: bullets.join(' '),
      requiredSkills: bullets,
    })
  }

  return jobs
}

export const createD2KScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    let careersHtml
    try { careersHtml = await fetchText(CAREERS_URL, { signal }) }
    finally { signal?.throwIfAborted() }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified D2K careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('The verified D2K careers page no longer exposes trusted first-party job cards')
    }

    const verifiedJobs = jobs.filter(job => job.country === 'India')
    if (!verifiedJobs.length) {
      return attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: CAREERS_URL,
        firstParty: true,
        listingComplete: false,
        pagesFetched: 1,
        reportedTotal: jobs.length,
        indiaFacetCount: null,
        verifiedAt: now(),
        reason: 'D2K role locations are unverified; the registered office does not establish job geography',
      })
    }
    return verifiedJobs.map((job) => ({
      ...(verifiedJobs.length < jobs.length ? { sourceListingComplete: false } : {}),
      ...job,
      company: COMPANY,
      source: SOURCE,
      department: null,
      jobId: slugify(titleCaseKey(job.title)),
      requisitionId: slugify(titleCaseKey(job.title)),
      minimumQualification: null,
      preferredQualification: null,
      postingDate: null,
      closingDate: null,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

const titleCaseKey = (value) => normalizeWhitespace(value)

export const run = async (options = {}) => createD2KScraper().run(options)

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
