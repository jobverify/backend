import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'collectiveartistsnetwork'
export const COMPANY = 'Collective Artists Network'
export const OFFICIAL_ROOT_URL = 'https://collectiveartists.co.in/'
export const CANONICAL_BASE_URL = 'https://www.collectiveartists.com'
export const JOBS_SURFACE_URL = `${CANONICAL_BASE_URL}/contact/`
export const CAREERS_CONTACT_EMAIL = 'careers@collectiveartists.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#0*38;|&amp;/gi, '&')
  .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const JOB_CARD_REGEX = /post-(\d+)\s+job type-job[\s\S]*?<h3[^>]*class="elementor-heading-title[^"]*"[^>]*>(.*?)<\/h3>[\s\S]*?<h3[^>]*class="elementor-heading-title[^"]*"[^>]*>\s*\|\s*<\/h3>[\s\S]*?<h3[^>]*class="elementor-heading-title[^"]*"[^>]*>(.*?)<\/h3>[\s\S]*?<h3[^>]*class="elementor-heading-title[^"]*"[^>]*>\s*\|?\s*<\/h3>[\s\S]*?<h3[^>]*class="elementor-heading-title[^"]*"[^>]*>(.*?)<\/h3>[\s\S]*?href=["']mailto:careers@collectiveartists\.com["']/gi

const hasSharedJobsPageMarkers = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('SHAPE YOUR FUTURE WITH US')
    && new RegExp(`mailto:${escapeRegex(CAREERS_CONTACT_EMAIL)}`, 'i').test(page)
    && normalized.includes('COLLECTIVE ARTISTS NETWORK INDIA PRIVATE LIMITED')
}

export const hasOfficialJobsSurfaceSignal = (html) => {
  const page = String(html ?? '')

  return hasSharedJobsPageMarkers(page)
    && /<title>\s*Contact Us\s*<\/title>/i.test(page)
    && /rel=["']canonical["'][^>]+href=["']https:\/\/www\.collectiveartists\.com\/contact\/["']/i.test(page)
}

export const extractTotalPages = (html) => {
  const match = String(html ?? '').match(/data-max-page=["'](\d+)["']/i)
  const value = Number.parseInt(match?.[1] ?? '1', 10)
  return Number.isInteger(value) && value > 0 ? value : null
}

export const buildJobsSurfacePageUrls = (totalPages) => {
  const pages = Number.parseInt(totalPages, 10)
  if (!Number.isInteger(pages) || pages < 1) return []

  return Array.from({ length: pages }, (_, index) => {
    const pageNumber = index + 1
    return pageNumber === 1 ? JOBS_SURFACE_URL : `${JOBS_SURFACE_URL}${pageNumber}/`
  })
}

export const extractJobsFromHtml = (
  html,
  {
    pageUrl = JOBS_SURFACE_URL,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(JOB_CARD_REGEX)) {
    const jobId = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const department = normalizeWhitespace(match[3])
    const experienceRequired = normalizeWhitespace(match[4])

    if (!jobId || !title || !department || !experienceRequired) {
      throw new Error('Collective Artists Network jobs surface no longer exposes the verified public job card fields')
    }

    const sourceUrl = `${pageUrl}#job-${jobId}`

    jobs.push({
      title,
      company: COMPANY,
      location: 'India',
      country: 'India',
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId,
      requisitionId: jobId,
      department,
      experienceRequired,
      remoteStatus: 'On-site',
      jobDescription: `Apply via ${CAREERS_CONTACT_EMAIL} from the official first-party jobs surface.`,
      companyCareerPage: JOBS_SURFACE_URL,
      companyDomain: 'collectiveartists.com',
      atsPlatform: 'official-company-site',
      scrapedAt,
    })
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

export const createCollectiveArtistsNetworkScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const firstPageHtml = await fetchText(JOBS_SURFACE_URL)

    if (!hasOfficialJobsSurfaceSignal(firstPageHtml)) {
      throw new Error('Collective Artists Network official jobs surface no longer matches the verified first-party page')
    }

    const totalPages = extractTotalPages(firstPageHtml)
    if (!totalPages) {
      throw new Error('Collective Artists Network official jobs surface no longer exposes verified pagination metadata')
    }

    const scrapedAt = now()
    const jobs = []

    for (const pageUrl of buildJobsSurfacePageUrls(totalPages)) {
      const pageHtml = pageUrl === JOBS_SURFACE_URL ? firstPageHtml : await fetchText(pageUrl)

      if (!hasSharedJobsPageMarkers(pageHtml)) {
        throw new Error(`Collective Artists Network official jobs surface changed materially on ${pageUrl}`)
      }

      const pageJobs = extractJobsFromHtml(pageHtml, { pageUrl, scrapedAt })
      if (!pageJobs.length) {
        throw new Error(`Collective Artists Network official jobs surface exposed no public job cards on ${pageUrl}`)
      }

      jobs.push(...pageJobs)
    }

    return [...new Map(jobs.map((job) => [job.jobId, job])).values()]
  },
})

export const run = async (options = {}) => createCollectiveArtistsNetworkScraper().run(options)

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
