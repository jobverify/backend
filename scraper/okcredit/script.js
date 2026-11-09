import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { OK_CREDIT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = OK_CREDIT_CATALOG.source
export const COMPANY = OK_CREDIT_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OK_CREDIT_CATALOG.officialBrandName
export const VERIFIED_ON = OK_CREDIT_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = OK_CREDIT_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = OK_CREDIT_CATALOG.homepageUrl
export const CAREERS_URL = OK_CREDIT_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards(?:\.eu)?\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /job id\b/i,
  /requisition\b/i,
]

const defaultFetchPage = async (url) => {
  const html = await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  return {
    status: 200,
    url,
    html,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return (
    /<title>\s*Best Digital Bahi Khata & Ledger App \| OkCredit\s*<\/title>/i.test(page)
    || /<title>\s*Free Bahi Khata Aur Udhar Ledger App \| OkCredit\s*<\/title>/i.test(page)
  )
    && /Digital Udhar Bahi Khata/i.test(page)
    && /(Keep track of receivables and payables\. Make collections simpler and faster\.|Simple\s*[·|&bull;]\s*Paperless\s*[·|&bull;]\s*Secure)/i.test(page)
    && /OkCredit Psi Phi Global Solutions Pvt\. Ltd\./i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Check out top career opportunities with us \| OkCredit\s*<\/title>/i.test(page)
    && /Ready to create something big\?/i.test(page)
    && /We are not hiring at the moment/i.test(page)
    && /No Current Job Openings/i.test(page)
    && /peopleops@okcredit\.in/i.test(page)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createOkCreditScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('OkCredit verified homepage no longer matches the official first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200) {
      throw new Error('OkCredit verified careers page no longer matches the official first-party surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('OkCredit careers page now appears to expose public jobs')
    }

    if (hasOfficialHomepageSignal(careersPage.html)) {
      return []
    }

    if (!hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('OkCredit verified careers page no longer matches the official first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createOkCreditScraper().run(options)

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
