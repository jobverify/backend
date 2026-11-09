import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LAVA_INTERNATIONAL_CATALOG } from './catalog.js'
import {runNativeLava} from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = LAVA_INTERNATIONAL_CATALOG.source
export const COMPANY = LAVA_INTERNATIONAL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = LAVA_INTERNATIONAL_CATALOG.officialBrandName
export const VERIFIED_ON = LAVA_INTERNATIONAL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = LAVA_INTERNATIONAL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = LAVA_INTERNATIONAL_CATALOG
export const HOMEPAGE_URL = LAVA_INTERNATIONAL_CATALOG.homepageUrl
export const ABOUT_PAGE_URL = LAVA_INTERNATIONAL_CATALOG.aboutPageUrl
export const CAREERS_URL = LAVA_INTERNATIONAL_CATALOG.companyCareerPage
export const APPLICATION_URL = LAVA_INTERNATIONAL_CATALOG.applicationUrl
export const APPLICATION_EMAIL = LAVA_INTERNATIONAL_CATALOG.applicationEmail ?? null
export const OPEN_POSITION_LIST_API_URL = 'https://www.lavamobiles.com/api/openpositionlist'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*About LAVA/i.test(page)
    && normalized.includes('Our Culture and Philosophy')
    && normalized.includes('A strong culture is what separates great companies from those that perish sooner or later.')
    && normalized.includes('Lava International Limited')
}

export const hasCareersLandingSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Career Lava Mobiles - Career Opportunities in Telecom\s*<\/title>/i.test(page)
    && normalized.includes('Join Us')
    && normalized.includes('It is not just a career.')
    && normalized.includes("it's an opportunity to shape the future")
    && /href=["'](?:https:\/\/www\.lavamobiles\.com)?\/career\/joblist["']/i.test(page)
}

export const hasJobListPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /"page"\s*:\s*"\/career\/joblist"/i.test(page)
    && normalized.includes('Clear Filter')
    && normalized.includes('Job Title :')
    && normalized.includes('Upload Resume')
    && normalized.includes('Lava International Limited')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasEmptyOpenPositionListPayload = (payload) =>
  Array.isArray(payload) && payload.length === 0

export const createLavaInternationalScraper = (defaults={}) => ({
  run: options => runNativeLava({...defaults,...options}),
})

export const run = async (options = {}) => createLavaInternationalScraper().run(options)

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
