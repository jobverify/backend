import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EICHER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EICHER_CATALOG.source
export const COMPANY = EICHER_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EICHER_CATALOG.officialBrandName
export const VERIFIED_ON = EICHER_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EICHER_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EICHER_CATALOG
export const HOMEPAGE_URL = EICHER_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = EICHER_CATALOG.careersPageUrl
export const DIRECT_JOB_ROUTE_URLS = [
  'https://www.eicher.in/career',
  'https://www.eicher.in/jobs',
  'https://www.eicher.in/current-openings',
]
export const LINKED_CAREER_URLS = [
  'http://royalenfield.com/aboutus/careers/',
  'http://careers.vecv.in/',
]
export const VECV_CAREERS_URL = 'https://careers.vecv.in/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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
  /darwinbox/i,
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

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'eicher.in' || hostname === 'www.eicher.in'
  } catch {
    return false
  }
}

const isVecvCareersUrl = (value) => {
  try {
    return new URL(value).hostname.toLowerCase() === 'careers.vecv.in'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Eicher :: Eicher Motors Limited :: Home\s*<\/title>/i.test(rawHtml)
    && /href=["']\/careers["']/i.test(rawHtml)
    && normalized.includes(
      'Incorporated in 1982, Eicher Motors Limited is the flagship company of the Eicher Group in India and a leading player of the Indian automobile industry.',
    )
}

export const hasSubsidiaryCareerHandoffSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /href=["']http:\/\/royalenfield\.com\/aboutus\/careers\/["']/i.test(rawHtml)
    && /href=["']http:\/\/careers\.vecv\.in\/["']/i.test(rawHtml)
    && /Visit Careers at/i.test(rawHtml)
  }

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Career- Eicher\s*<\/title>/i.test(rawHtml)
    && normalized.includes('At Eicher, challenges appear every day and our people rise to the occasion.')
    && hasSubsidiaryCareerHandoffSignal(rawHtml)
}

export const isMissingDirectJobRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && !hasPublicJobsSignal(page.html)

export const isBlockedVecvCareersRoute = (page = {}) =>
  Number(page.status) === 403
  && isVecvCareersUrl(page.url || '')
  && !hasPublicJobsSignal(page.html)

export const createEicherScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Eicher verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Eicher homepage now appears to expose public jobs')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Eicher verified careers page no longer matches the known subsidiary-handoff surface')
    }

    for (const routeUrl of DIRECT_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingDirectJobRoute(routePage)) {
        throw new Error(`Eicher verified no-public-jobs route changed: ${routePage.url || routeUrl}`)
      }
    }

    const vecvCareersPage = await fetchPage(VECV_CAREERS_URL)
    if (!isBlockedVecvCareersRoute(vecvCareersPage)) {
      throw new Error('Eicher verified VECV careers handoff no longer matches the blocked subsidiary surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEicherScraper().run(options)

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
