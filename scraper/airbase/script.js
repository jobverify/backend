import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AIRBASE_CATALOG } from './catalog.js'
import { createAirbaseNativeScraper } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AIRBASE_CATALOG.source
export const COMPANY = AIRBASE_CATALOG.companyName
export const HOMEPAGE_URL = 'https://www.airbase.com/'
export const CAREERS_ROUTE_URL = AIRBASE_CATALOG.companyCareerPage
export const PARENT_CAREERS_URL = AIRBASE_CATALOG.parentCareersPage
export const NO_PUBLIC_CAREER_ROUTE_URLS = [
  'https://www.airbase.com/career',
  'https://www.airbase.com/jobs',
  'https://www.airbase.com/join-us',
  'https://www.airbase.com/work-with-us',
  'https://www.airbase.com/openings',
  'https://www.airbase.com/current-openings',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Airbase, a Paylocity Company \| Airbase by Paylocity/i.test(rawHtml)
    && /Paylocity for Finance combines our advanced spend management capabilities with Paylocity(?:'|’)?s robust HCM platform/i.test(normalized)
    && /What does this mean for Airbase clients\?/i.test(normalized)
    && /Airbase Inc\./i.test(normalized)
    && /href="https:\/\/www\.paylocity\.com\/"/i.test(rawHtml)
}

export const hasGenericParentCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const isFullPaylocityCareersPage = /Careers \| Paylocity \| Paylocity/i.test(rawHtml)
    && /Sure, we build great products, but we also want Paylocity to be a great place to work\./i.test(normalized)
    && /Join us as we help clients solve problems and shape the future of work\./i.test(normalized)
    && /Protect yourself\./i.test(normalized)
  return isFullPaylocityCareersPage
    && !/\bAirbase\b/i.test(rawHtml)
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createAirbaseScraper = createAirbaseNativeScraper

export const run = async (options = {}) => createAirbaseScraper().run(options)

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
