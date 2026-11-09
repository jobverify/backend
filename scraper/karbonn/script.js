import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KARBONN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = KARBONN_CATALOG.source
export const COMPANY = KARBONN_CATALOG.companyName
export const VERIFIED_ON = KARBONN_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = KARBONN_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = KARBONN_CATALOG
export const HOMEPAGE_URL = KARBONN_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = KARBONN_CATALOG.companyCareerPage
export const STALE_CAREERS_ROUTE_URL = KARBONN_CATALOG.staleCareerRouteUrl

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*karbonn\s*<\/title>/i.test(page)
    && /href=["']https:\/\/karbonn\.in\/\?page_id=944["'][^>]*>\s*CAREERS\s*<\/a>/i.test(page)
    && /href=["']https:\/\/karbonn\.in\/\?page_id=328["'][^>]*>\s*CONTACT US\s*<\/a>/i.test(page)
    && normalized.includes('CAREERS')
  }

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*CAREERS\s*(?:-|&#8211;|&ndash;)\s*karbonn\s*<\/title>/i.test(page)
    && /class=["'][^"']*elementor-form[^"']*["']/i.test(page)
    && /name=["']subscribe["']/i.test(page)
    && /name=["']form_fields\[email\]["']/i.test(page)
    && /placeholder=["']ENTER YOUR EMAIL["']/i.test(page)
    && normalized.includes('CAREER GROWTH')
  }

export const hasRenderablePublicJobsSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /\b(Current Openings|Open Positions|Job Openings|Vacancies|Apply Now|Apply Here)\b/i.test(normalized)
    || /\b(Location|Department|Experience|Full Time|Part Time)\s*:/i.test(normalized)
    || /JobPosting/i.test(String(html ?? ''))
  }

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html) || ''

  return Number(page.status) === 404
    && !hasRenderablePublicJobsSignal(html)
    && (
      html.trim() === ''
      || (
        /<title>\s*Not Found\s*<\/title>/i.test(html)
        && normalized.includes('Not Found')
      )
    )
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

export const createKarbonnScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Karbonn official homepage no longer matches the verified careers-link surface')
    }

    if (hasRenderablePublicJobsSignal(homepage.html)) {
      throw new Error('Karbonn official homepage now exposes a live public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (hasRenderablePublicJobsSignal(careersPage.html)) {
      throw new Error('Karbonn careers page now exposes a live public jobs surface')
    }

    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Karbonn careers page no longer matches the verified subscribe-only shell')
    }

    const staleCareerRoute = await fetchPage(STALE_CAREERS_ROUTE_URL)
    if (!isVerifiedMissingCareerRoute(staleCareerRoute)) {
      throw new Error('Karbonn stale first-party careers route changed materially or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createKarbonnScraper().run(options)

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
