import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GALAXEYE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GALAXEYE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const JOB_PORTAL_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_JOBS_SHELL_URL = PROVIDER_METADATA.publicJobsShellUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractAnchorUrls = (html = '', baseUrl) =>
  [...String(html ?? '').matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi)]
    .map((match) => toAbsoluteUrl(match[2], baseUrl))
    .filter(Boolean)

export const extractJobPortalUrl = (html = '') =>
  extractAnchorUrls(html, HOMEPAGE_URL).find((url) => url === JOB_PORTAL_URL) ?? null

export const extractCareersHandoffUrl = (html = '') =>
  extractAnchorUrls(html, JOB_PORTAL_URL).find((url) => url === PUBLIC_JOBS_SHELL_URL) ?? null

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Mission Drishti\s*\|\s*World['\u2019]s First OptoSAR EO Satellite\s*<\/title>/i.test(rawHtml)
    && normalized.includes("World's First OptoSAR Imaging Satellite")
    && normalized.includes('A New Era in Satellite Intelligence')
    && normalized.includes('Galaxeye Space Solutions Private Limited')
    && extractJobPortalUrl(rawHtml) === JOB_PORTAL_URL
}

export const hasOfficialJobPortalSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at GalaxEye\s*\|\s*Shape the Future of Earth Observation\s*<\/title>/i.test(rawHtml)
    && normalized.includes("Your Life's Work Could Be Defining the Future of Observation.")
    && normalized.includes('Find Your Mission')
    && normalized.includes('Explore our open roles')
    && normalized.includes('Galaxeye Space Solutions Private Limited')
    && extractCareersHandoffUrl(rawHtml) === PUBLIC_JOBS_SHELL_URL
}

export const publicJobsShellExposesTrustworthyListings = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hrefs = extractAnchorUrls(rawHtml, PUBLIC_JOBS_SHELL_URL)

  const hasJobDetailLink = hrefs.some((url) => (
    /^https:\/\/careers\.galaxeye\.space\/jobs\/Careers\/\d+\/[^?\s]+/i.test(url)
  ))

  return hasJobDetailLink
    || /<article\b/i.test(rawHtml)
    || /\bjob-card\b/i.test(rawHtml)
    || /\bapply now\b/i.test(normalized)
    || /\bview details\b/i.test(normalized)
}

export const hasPublicJobsShellSignal = (html = '') => (
  /<title>\s*Jobs\s*\|\s*GalaxEye\s*<\/title>/i.test(String(html ?? ''))
)

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

export const createGalaxEyeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.html)
      || extractJobPortalUrl(homepage.html) !== JOB_PORTAL_URL
    ) {
      throw new Error('GalaxEye verified official homepage no longer matches the known public surface')
    }

    const jobPortal = await fetchPage(JOB_PORTAL_URL)
    if (
      jobPortal.status !== 200
      || !hasOfficialJobPortalSignal(jobPortal.html)
      || extractCareersHandoffUrl(jobPortal.html) !== PUBLIC_JOBS_SHELL_URL
    ) {
      throw new Error('GalaxEye verified first-party job portal no longer matches the known public surface')
    }

    const publicJobsShell = await fetchPage(PUBLIC_JOBS_SHELL_URL)
    if (publicJobsShell.status !== 200 || !hasPublicJobsShellSignal(publicJobsShell.html)) {
      throw new Error('GalaxEye verified shell-only jobs board no longer matches the known public surface')
    }

    if (publicJobsShellExposesTrustworthyListings(publicJobsShell.html)) {
      throw new Error('GalaxEye shell-only jobs board now exposes a trustworthy public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGalaxEyeScraper().run(options)

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
