import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|bengaluru|bangalore|hyderabad|pune|chennai|remote)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value, baseUrl = JOBS_PAGE_URL) => {
  try {
    const url = new URL(value, baseUrl)
    if (url.hostname !== 'www.nineleaps.com') return null
    return url.toString()
  } catch {
    return null
  }
}

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractFirstParagraphAfterHeading = (html = '', headingText) => {
  const pattern = new RegExp(
    `<h[1-6][^>]*>${headingText}<\\/h[1-6]>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i',
  )

  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1])
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
  return normalized.includes('Build with Purpose.')
    && normalized.includes('Grow with Intent.')
    && normalized.includes('Find Your Role')
}

export const hasOfficialJobsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Open Jobs')
    && /\/job\//i.test(String(html ?? ''))
  }

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<article[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
)]
  .map((match) => {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
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
  const title = normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const paragraphs = [...String(html ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
  const applyUrl = toAbsoluteUrl(String(html ?? '').match(/<a[^>]*href=["']([^"']*#apply[^"']*)["']/i)?.[1], sourceUrl)
  const jobDescription = extractFirstParagraphAfterHeading(html, 'Role Overview') || paragraphs[2] || null
  const requiredSkills = extractListItems(
    String(html ?? '').match(/<h2[^>]*>\s*What We'?re Looking For\s*<\/h2>([\s\S]*?)<\/ul>/i)?.[1],
  )

  return {
    title,
    applyUrl: applyUrl || `${sourceUrl.replace(/\/+$/, '')}/#apply`.replace(/\/#apply$/, '/#apply'),
    jobDescription,
    requiredSkills,
  }
}

export const createNineleapsTechnologySolutionsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Nineleaps Technology Solutions careers surface changed materially')
    }

    const jobsHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasOfficialJobsSignal(jobsHtml)) {
      throw new Error('The verified Nineleaps Technology Solutions jobs surface changed materially')
    }

    const jobs = []

    for (const card of extractJobCards(jobsHtml)) {
      const detailHtml = await fetchText(card.sourceUrl)
      const detail = extractJobDetail(detailHtml, card.sourceUrl)

      jobs.push({
        title: detail.title || card.title,
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

export const run = async (options = {}) => createNineleapsTechnologySolutionsScraper().run(options)

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
