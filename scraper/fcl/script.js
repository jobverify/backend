import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FCL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FCL_CATALOG.source
export const COMPANY = FCL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = FCL_CATALOG.officialBrandName
export const VERIFIED_ON = FCL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FCL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = FCL_CATALOG
export const HOMEPAGE_URL = FCL_CATALOG.homepageUrl
export const CAREERS_ROUTE_URLS = [
  'https://fcl.in/careers',
  'https://fcl.in/career',
  'https://fcl.in/jobs',
  'https://fcl.in/join-us',
  'https://fcl.in/openings',
  'https://fcl.in/work-with-us',
  'https://fcl.in/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)\s+hiring\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
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
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;|\u2019/gi, '\'')
  .replace(/&quot;|&ldquo;|&rdquo;|\u201c|\u201d/gi, '"')
  .replace(/&#8211;|&ndash;|\u2013|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'fcl.in' || hostname === 'www.fcl.in'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?fcl\.in)?\/(?:careers|career|jobs|join-us|openings|work-with-us|current-openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:careers|career|jobs|join-us|openings|work-with-us|current-openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*(?:Express Laundry Service Coimbatore\s*\|\s*)?FIREFLY CAMPUS(?: LAUNDRY)?/i.test(rawHtml)
    && normalized.includes('firefly campus')
    && /firefly campus laundry logo/i.test(rawHtml)
    && /api\.whatsapp\.com\/send\/\?phone=919944008811/i.test(rawHtml)
    && /tel:04224173837/i.test(rawHtml)
    && normalized.includes('doorstep laundry service')
    && normalized.includes('hostels')
    && normalized.includes('star hotels')
    && normalized.includes('hospitals')
    && normalized.includes('steam pressing')
}

export const isVerifiedMissingFirstPartyRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && !hasPublicJobsSignal(page.text)
  && !hasFirstPartyCareerLikeLink(page.text)

export const createFclScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('FCL homepage no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(homepage.text)) {
      throw new Error('FCL homepage now appears to expose public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.text)) {
      throw new Error('FCL homepage now exposes a first-party careers or jobs link')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingFirstPartyRoute(careersRoute)) {
        throw new Error(`FCL careers route changed materially or now exposes public jobs: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFclScraper().run(options)

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
