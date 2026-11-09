import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'whitematrix'
export const COMPANY = 'WhiteMatrix'
export const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/whitematrix/'
export const LINKEDIN_COMPANY_JOBS_URL = 'https://www.linkedin.com/jobs/search?f_C=78379149'
export const LINKEDIN_COMPANY_JOBS_API_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=78379149'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const pageIndicatesWhiteMatrixCompany = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('whitematrix | linkedin')
    && normalized.includes('technology, information and internet')
    && normalized.includes('chainide.com')
}

export const jobsPageShowsZeroResults = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return (
    normalized.includes('jobs jobs at whitematrix in united states')
    || /\b0 jobs jobs in united states\b/i.test(normalized)
  )
    && !guestJobsApiShowsListings(html)
}

export const guestJobsApiShowsZeroResults = (html) =>
  !guestJobsApiShowsListings(html)
    && /^<!doctype html>\s*<!---->$/i.test(String(html ?? '').replace(/\s+/g, ' ').trim())

export const guestJobsApiShowsListings = (html) =>
  /base-card|job-search-card|data-entity-urn="urn:li:jobPosting:/i.test(String(html ?? ''))

export const createWhiteMatrixScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL)

    if (!pageIndicatesWhiteMatrixCompany(companyHtml)) {
      throw new Error('WhiteMatrix LinkedIn company page no longer matches the expected public organization page')
    }

    const jobsPageHtml = await fetchText(LINKEDIN_COMPANY_JOBS_URL)
    if (!jobsPageShowsZeroResults(jobsPageHtml)) {
      throw new Error('WhiteMatrix LinkedIn jobs page no longer matches the verified zero-jobs public surface')
    }

    const guestJobsApiHtml = await fetchText(LINKEDIN_COMPANY_JOBS_API_URL)
    if (guestJobsApiShowsListings(guestJobsApiHtml) || !guestJobsApiShowsZeroResults(guestJobsApiHtml)) {
      throw new Error('WhiteMatrix LinkedIn guest jobs surface no longer matches the verified zero-jobs state')
    }

    return []
  },
})

export const run = async (options = {}) => createWhiteMatrixScraper().run(options)

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
