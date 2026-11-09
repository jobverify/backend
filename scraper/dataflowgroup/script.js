import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DATAFLOW_GROUP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DATAFLOW_GROUP_CATALOG.source
export const COMPANY = DATAFLOW_GROUP_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = DATAFLOW_GROUP_CATALOG.officialBrandName
export const VERIFIED_ON = DATAFLOW_GROUP_CATALOG.verifiedOn
export const CAREERS_URL = DATAFLOW_GROUP_CATALOG.companyCareerPage
export const ALL_VACANCIES_URL = DATAFLOW_GROUP_CATALOG.allVacanciesUrl
export const DARWINBOX_IFRAME_URL = DATAFLOW_GROUP_CATALOG.darwinboxIframeUrl
export const PROVIDER_METADATA = DATAFLOW_GROUP_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /href=["']https?:\/\/dataflowgroup\.com\/career\//i,
  /href=["']\/career\//i,
]

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*-\s*DATAFLOW\s*<\/title>/i.test(page)
    && /Join Our Team/i.test(page)
    && /EXPLORE ALL VACANCIES/i.test(page)
    && new RegExp(DARWINBOX_IFRAME_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
}

export const hasOfficialAllVacanciesSignal = (html) =>
  new RegExp(`<iframe[^>]+src=["']${DARWINBOX_IFRAME_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i')
    .test(String(html ?? ''))

const hasDirectPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDataflowGroupScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (hasDirectPublicJobsSignal(careersHtml)) {
      throw new Error('Dataflow Group first-party careers page now exposes a direct public jobs surface')
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Dataflow Group verified Dataflow handoff no longer matches the first-party careers contract')
    }

    const allVacanciesHtml = await fetchText(ALL_VACANCIES_URL)
    if (hasDirectPublicJobsSignal(allVacanciesHtml)) {
      throw new Error('Dataflow Group all-vacancies page now exposes a direct public jobs surface')
    }
    if (!hasOfficialAllVacanciesSignal(allVacanciesHtml)) {
      throw new Error('Dataflow Group verified Dataflow handoff no longer matches the all-vacancies iframe contract')
    }

    return []
  },
})

export const run = async (options = {}) => createDataflowGroupScraper().run(options)

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
