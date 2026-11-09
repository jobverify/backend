import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SANKEY_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
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
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /Careers - Sankey solutions: IT Consulting & Services \| Digital Transformation/i.test(page)
    && normalized.includes('DEFINE YOUR FUTURE WITH LIMITLESS POSSIBILITIES')
    && normalized.includes('Solution Analyst')
    && normalized.includes('Apply Now')
}

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ?? null,
)

const extractDescription = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null,
)

const extractJobIdFromUrl = (url) => {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return normalizeWhitespace(pathname.split('/').filter(Boolean).pop())
  } catch {
    return null
  }
}

export const extractIndiaJobs = (html = '') => {
  const seenUrls = new Set()

  return [...String(html ?? '').matchAll(/<a\b[^>]*href=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, , href, innerHtml]) => {
      const sourceUrl = toAbsoluteUrl(href)
      if (!sourceUrl || seenUrls.has(sourceUrl)) return null
      if (!sourceUrl.startsWith('https://sankeysolutions.com/')) return null
      if (sourceUrl === CAREERS_URL) return null
      if (!/Apply Now/i.test(innerHtml)) return null

      const title = extractTitle(innerHtml)
      const jobDescription = extractDescription(innerHtml)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !jobId) return null
      seenUrls.add(sourceUrl)

      return {
        title,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: null,
      }
    })
    .filter(Boolean)
}

export const createSankeySolutionsScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Sankey Solutions careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobs(html)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSankeySolutionsScraper().run(options)

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
