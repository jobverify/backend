import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { HOTFOOT_TECHNOLOGY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HOTFOOT_TECHNOLOGY_CATALOG.source
export const COMPANY = HOTFOOT_TECHNOLOGY_CATALOG.companyName
export const VERIFIED_ON = HOTFOOT_TECHNOLOGY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HOTFOOT_TECHNOLOGY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HOTFOOT_TECHNOLOGY_CATALOG
export const JOBS_PAGE_URL = HOTFOOT_TECHNOLOGY_CATALOG.jobsPageUrl
export const STALE_JOB_DETAIL_ROUTE_URLS = HOTFOOT_TECHNOLOGY_CATALOG.staleJobDetailRouteUrls
export const STALE_JOB_ARCHIVE_ROUTE_URLS = HOTFOOT_TECHNOLOGY_CATALOG.staleJobArchiveRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Job Openings\s*-\s*Hotfoot Technology Solutions\s*<\/title>/i.test(page)
    && /careers@hotfoot\.co\.in/i.test(page)
    && normalized.includes('Job Openings')
  }

export const hasRenderablePublicJobsSignal = (html) => {
  const page = String(html ?? '')

  return /awsm-job-listing-item|awsm-load-more/i.test(page)
    || /href=["'][^"']*\/blog\/job-openings\/[^"']+["']/i.test(page)
    || /\b(Job Category|Job Type|Job Location)\b/i.test(page)
    || /Apply for this position/i.test(page)
    || /JobPosting/i.test(page)
  }

export const isVerifiedMissingJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html) || ''

  return Number(page.status) === 404
    && /<title>\s*Page not found\s*-\s*Hotfoot Technology Solutions\s*<\/title>/i.test(html)
    && normalized.includes('Page not found')
    && !hasRenderablePublicJobsSignal(html)
  }

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createHotfootTechnologyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (jobsPage.status !== 200 || !hasOfficialJobsPageSignal(jobsPage.html)) {
      throw new Error('Hotfoot Technology job openings page no longer matches the verified first-party placeholder surface')
    }

    if (hasRenderablePublicJobsSignal(jobsPage.html)) {
      throw new Error('Hotfoot Technology job openings page now exposes a live public jobs surface')
    }

    for (const routeUrl of [...STALE_JOB_DETAIL_ROUTE_URLS, ...STALE_JOB_ARCHIVE_ROUTE_URLS]) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingJobRoute(routePage)) {
        throw new Error(`Hotfoot Technology stale first-party job route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createHotfootTechnologyScraper().run(options)

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
