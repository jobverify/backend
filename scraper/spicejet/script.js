import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SPICEJET_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SPICEJET_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const AME_REGISTRATION_URL = PROVIDER_METADATA.ameRegistrationUrl
export const SPICESTAR_REGISTRATION_URL = PROVIDER_METADATA.spiceStarRegistrationUrl
export const CAREERS_EMAIL = 'careers@spicejet.com'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

const ENUMERABLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bsearch jobs\b/i,
  /\bjob id\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /darwinbox/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasEnumerablePublicJobsSignal = (html = '') =>
  ENUMERABLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*SpiceJet Airlines\s*<\/title>/i.test(page)
    && /Cabin Crew Interview\s+[A-Za-z]+(?:\s+\d{4})?\s+Calendar/i.test(normalized)
    && normalized.includes('https://application.spicestaracademy.edu.in/')
    && normalized.includes('Public Notice')
    && normalized.includes(CAREERS_EMAIL)
    && normalized.includes('SpiceJet Limited')
  }

export const hasOfficialAmeRegistrationSignal = (html = '') => {
  const page = String(html ?? '')

  return /action="\.\/*AME\.aspx"/i.test(page)
    && /AME\/TECHNICIAN Registration/i.test(page)
    && /ctl00_mainContent_txtEmailId/i.test(page)
    && /B1\/Airframes and Engine/i.test(page)
    && /ctl00_mainContent_fulResume/i.test(page)
    && /CheckEmailAddressExists/i.test(page)
  }

export const createSpiceJetScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SpiceJet verified careers notice no longer matches the first-party recruitment surface')
    }
    if (hasEnumerablePublicJobsSignal(careersHtml)) {
      throw new Error('SpiceJet careers notice now exposes enumerable public jobs')
    }

    const ameRegistrationHtml = await fetchText(AME_REGISTRATION_URL)
    if (!hasOfficialAmeRegistrationSignal(ameRegistrationHtml)) {
      throw new Error('SpiceJet verified AME registration form no longer matches the first-party recruitment surface')
    }
    if (hasEnumerablePublicJobsSignal(ameRegistrationHtml)) {
      throw new Error('SpiceJet AME registration form now exposes enumerable public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createSpiceJetScraper(options).run(options)

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
