import { runCurrentAurobindo } from './currentPublic.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AUROBINDO_PHARMA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AUROBINDO_PHARMA_CATALOG.source
export const COMPANY = AUROBINDO_PHARMA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AUROBINDO_PHARMA_CATALOG.officialBrandName
export const VERIFIED_ON = AUROBINDO_PHARMA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AUROBINDO_PHARMA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AUROBINDO_PHARMA_CATALOG
export const HOMEPAGE_URL = AUROBINDO_PHARMA_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = AUROBINDO_PHARMA_CATALOG.careersPageUrl
export const CAREERS_HANDOFF_URL = AUROBINDO_PHARMA_CATALOG.careersHandoffUrl
export const CAREERS_HOST_URL = AUROBINDO_PHARMA_CATALOG.careersHostUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bbrowse all jobs\b/i,
  /\bjobs found\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Aurobindo Pharma - Leading Global Pharmaceutical Company\s*<\/title>/i.test(page)
    && normalized.includes('Aurobindo Pharma')
    && /href=["']\/careers["']/i.test(page)
    && /href=["']https:\/\/aurobindo\.talentrecruit\.com\/Search\/["']/i.test(page)
    && /Work with us \/ Opportunities/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Aurobindo Pharma Careers - Join Our Growing Team\s*<\/title>/i.test(page)
    && /https:\/\/aurobindo\.talentrecruit\.com\/Search\//i.test(page)
    && normalized.includes('Recruitment scam alert')
    && normalized.includes('Work with us / Opportunities')
    && normalized.includes('Aurobindo Pharma Limited NEVER charges any fees')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasBrokenTalentRecruitSearchSignal = ({ status, html } = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return Number(status) === 404
    && /<title>\s*404 - File or directory not found\.\s*<\/title>/i.test(page)
    && normalized.includes('Server Error')
    && normalized.includes('404 - File or directory not found.')
    && normalized.includes('temporarily unavailable')
    && !hasPublicJobsSignal(page)
}

export const hasBrokenTalentRecruitHostSignal = ({ status, html } = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return Number(status) === 200
    && /<title>\s*IIS Windows Server\s*<\/title>/i.test(page)
    && normalized.includes('IIS Windows Server')
    && !hasPublicJobsSignal(page)
}

export const createAurobindoPharmaScraper = (defaults = {}) => ({ run: (options = {}) => runCurrentAurobindo({ ...defaults, ...options }) })

export const run = async (options = {}) => createAurobindoPharmaScraper().run(options)

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
