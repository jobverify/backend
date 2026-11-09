import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { VOLKSOFT_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = VOLKSOFT_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Innovate. Impact. Grow.')
    && normalized.includes('Where Ideas Meet Impact')
    && normalized.includes('Position Applying For')
    && normalized.includes('Resume/CV')
  }

export const hasVerifiedPlaceholderListings = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Lorem ipsum dolor sit amet')
    && normalized.includes('Experience: 1-2 years')
    && normalized.includes('Qualification: B.Tech')
    && normalized.includes('Apply Now')
  }

export const pageExposesTrustworthyPublicJobListings = (html = '') => {
  const normalized = normalizeWhitespace(html)

  if (!normalized.includes('Apply Now')) return false
  if (normalized.includes('Lorem ipsum dolor sit amet')) return false

  return /Senior|Engineer|Developer|Manager|Analyst|Consultant/i.test(normalized)
}

export const createVolksoftTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The official Volksoft Technologies careers page no longer matches the verified placeholder-only surface')
    }

    if (!hasVerifiedPlaceholderListings(html)) {
      throw new Error('The official Volksoft Technologies careers page no longer matches the verified placeholder-only openings state')
    }

    if (pageExposesTrustworthyPublicJobListings(html)) {
      throw new Error('The official Volksoft Technologies careers page now exposes trustworthy public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createVolksoftTechnologiesScraper().run(options)

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
