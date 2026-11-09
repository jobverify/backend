import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FLEETX_CATALOG } from './catalog.js'
import { createNativeFleetxScraper } from './native.js'
export { hasOfficialCareersSignal, extractFleetxJobs } from './nativePage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FLEETX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const WWW_HOMEPAGE_URL = PROVIDER_METADATA.wwwHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WWW_CAREERS_URL = PROVIDER_METADATA.wwwCareerPageUrl
export const ROBOTS_URL = PROVIDER_METADATA.robotsUrl
export const WWW_ROBOTS_URL = PROVIDER_METADATA.wwwRobotsUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const WWW_SITEMAP_URL = PROVIDER_METADATA.wwwSitemapUrl
export const TIMEOUT_PROBE_URLS = PROVIDER_METADATA.timeoutProbeUrls
export const CURRENT_CAREERS_URL = 'https://www.fleetx.ai/careers'

export const HOMEPAGE_ROUTE_URLS = [
  HOMEPAGE_URL,
  WWW_HOMEPAGE_URL,
]

export const CAREERS_ROUTE_URLS = [
  CAREERS_URL,
  WWW_CAREERS_URL,
  'https://fleetx.io/career',
  'https://www.fleetx.io/career',
  'https://fleetx.io/jobs',
  'https://www.fleetx.io/jobs',
  'https://fleetx.io/join-us',
  'https://www.fleetx.io/join-us',
  'https://fleetx.io/work-with-us',
  'https://www.fleetx.io/work-with-us',
]

export const DISCOVERY_ROUTE_URLS = [
  ROBOTS_URL,
  WWW_ROBOTS_URL,
  SITEMAP_URL,
  WWW_SITEMAP_URL,
]

// Historical route and timeout helpers are diagnostic only. The native
// reader never turns a timeout into an empty inventory or probes fallback URLs.
const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  } catch {
    return String(value ?? '').trim()
  }
}

export const isVerifiedTimeoutResult = (result = {}, requestedUrl = '') => {
  if (result?.ok !== false) {
    return false
  }

  if (normalizeUrl(result?.url ?? requestedUrl) !== normalizeUrl(requestedUrl)) {
    return false
  }

  const errorName = String(result?.errorName ?? '')
  const errorMessage = String(result?.errorMessage ?? '')
  const causeName = String(result?.causeName ?? '')
  const causeMessage = String(result?.causeMessage ?? '')
  const combined = `${errorName} ${errorMessage} ${causeName} ${causeMessage}`.toLowerCase()

  return combined.includes('timeout')
}

export const createFleetxScraper = (defaults = {}) => createNativeFleetxScraper(defaults)
export const run = (options = {}) => createFleetxScraper().run(options)

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
