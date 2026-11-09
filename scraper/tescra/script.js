import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { inferExperienceFromPublicPageHtml } from '../../scraper-support/utils/publicExperienceEnrichment.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tescra'
export const COMPANY = 'TESCRA'
export const HOMEPAGE_URL = 'https://www.tescra.com/'
export const CURRENT_OPENINGS_URL = 'https://www.tescra.com/current-openings/'
export const COMPANY_DOMAIN = 'tescra.com'
export const ATS_PLATFORM = 'official-company-careers-inline-openings'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const BROWSER_FETCH_TIMEOUT_MS = 60000

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&#8211;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalize = (value) => normalizeWhitespace(value) || null

const normalizeUrl = (value) => {
  const decoded = decodeHtml(String(value ?? '')).trim()
  if (!decoded) return null

  try {
    return new URL(decoded, CURRENT_OPENINGS_URL).toString()
  } catch {
    return null
  }
}

const getJobId = (value) => {
  try {
    const url = new URL(value)
    return url.searchParams.get('uid')
      || url.pathname.split('/').filter(Boolean).at(-1)
      || null
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const createPublicJobTextFetcher = async () => {
  const session = await createBrowserFetchSession({
    userAgent: USER_AGENT,
    timeoutMs: BROWSER_FETCH_TIMEOUT_MS,
    waitUntil: 'networkidle2',
    settleTimeMs: 3000,
  })

  return {
    fetchText: session.fetchText,
    close: session.close,
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Tescra\s*<\/title>/i.test(page)
    && /href=["'][^"']*current-openings\/?["']/i.test(page)
    && normalized.includes('Software Advisory Services')
    && normalized.includes('Trusted by Fortune companies Worldwide')
}

export const hasCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Current Openings[^<]*Tescra\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && /Easy Apply/i.test(page)
    && /achnet\.com/i.test(page)
    && /linkedin\.com\/company\/tescra/i.test(page)
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<h3\b[^>]*class=["'][^"']*elementor-icon-box-title[^"']*["'][^>]*>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>[\s\S]*?<p\b[^>]*class=["'][^"']*elementor-icon-box-description[^"']*["'][^>]*>([\s\S]*?)<\/p>[\s\S]*?<a\b[^>]*class=["'][^"']*elementor-button-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Easy Apply[\s\S]*?<\/a>/gi,
)]
  .map((match) => {
    const title = normalize(match[1])
    const description = normalize(match[2])
    const sourceUrl = normalizeUrl(match[3])

    if (!title || !description || !sourceUrl) return null

    try {
      if (new URL(sourceUrl).hostname.toLowerCase() !== 'www.achnet.com') {
        return null
      }
    } catch {
      return null
    }

    return {
      title,
      description,
      sourceUrl,
      applyUrl: sourceUrl,
    }
  })
  .filter(Boolean)

export const hasUnavailablePublicDetailSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return normalized.includes('something went wrong')
    && normalized.includes('unexpected error')
}

const checkPublicDetailExperience = async (job, fetchPublicJobText) => {
  if (typeof fetchPublicJobText !== 'function') {
    return job
  }

  let publicDetailHtml
  try {
    publicDetailHtml = await fetchPublicJobText(job.applyUrl)
  } catch {
    return job
  }

  const enriched = inferExperienceFromPublicPageHtml(job, publicDetailHtml)
  if (enriched.experienceRequired || enriched.publicExperienceChecked === true) {
    return {
      ...enriched,
      publicExperienceChecked: enriched.publicExperienceChecked === true || Boolean(enriched.experienceRequired),
    }
  }

  if (hasUnavailablePublicDetailSignal(publicDetailHtml)) {
    return {
      ...job,
      publicExperienceChecked: true,
    }
  }

  return job
}

export const createTescraScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchPublicJobText = null,
    createDetailTextFetcher = createPublicJobTextFetcher,
  } = {}) {
    let detailTextFetcher = null

    try {
      const homepageHtml = await fetchText(HOMEPAGE_URL)

      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('TESCRA verified official homepage no longer matches the expected company surface')
      }

      const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
      if (!hasCurrentOpeningsSignal(currentOpeningsHtml)) {
        throw new Error('TESCRA verified current openings page no longer matches the expected public openings surface')
      }

      const jobs = extractJobCards(currentOpeningsHtml)
      if (jobs.length === 0) {
        throw new Error('TESCRA current openings page no longer exposes parseable public job cards')
      }

      const shouldCheckPublicDetails =
        typeof fetchPublicJobText === 'function' || fetchText === defaultFetchText

      if (
        shouldCheckPublicDetails
        && !fetchPublicJobText
        && typeof createDetailTextFetcher === 'function'
      ) {
        detailTextFetcher = await createDetailTextFetcher()
        fetchPublicJobText = detailTextFetcher?.fetchText || null
      }

      const baseJobs = jobs.map((job) => ({
        title: job.title,
        company: COMPANY,
        location: 'India',
        city: null,
        country: 'India',
        employmentType: null,
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
        link: job.applyUrl,
        jobId: getJobId(job.sourceUrl),
        requisitionId: getJobId(job.sourceUrl),
        jobDescription: job.description,
        experienceRequired: null,
        remoteStatus: null,
        source: SOURCE,
        companyCareerPage: CURRENT_OPENINGS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        scrapedAt: now(),
        publicExperienceChecked: false,
      }))

      if (!shouldCheckPublicDetails) {
        return baseJobs
      }

      const enrichedJobs = []
      for (const job of baseJobs) {
        enrichedJobs.push(await checkPublicDetailExperience(job, fetchPublicJobText))
      }

      return enrichedJobs
    } finally {
      if (detailTextFetcher) {
        await detailTextFetcher.close()
      }
    }
  },
})

export const run = async (options = {}) => createTescraScraper(options).run(options)

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
