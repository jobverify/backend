import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hanosoftwaresolutions'
export const COMPANY = 'Hano Software Solutions'
export const HOMEPAGE_URL = 'https://www.hanosoftwaresolutions.com/'
export const CAREERS_ROUTE_URLS = [
  'https://www.hanosoftwaresolutions.com/careers',
  'https://www.hanosoftwaresolutions.com/careers/',
  'https://www.hanosoftwaresolutions.com/career',
  'https://www.hanosoftwaresolutions.com/career/',
  'https://www.hanosoftwaresolutions.com/jobs',
  'https://www.hanosoftwaresolutions.com/jobs/',
  'https://www.hanosoftwaresolutions.com/join-us',
  'https://www.hanosoftwaresolutions.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DNS_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ERR_NAME_NOT_RESOLVED'])

const HOMEPAGE_SIGNALS = [
  '<title>hano software solution private limited</title>',
  '<div id="root"></div>',
  'fonts.googleapis.com/css2?family=lato',
  'fonts.googleapis.com/css2?family=lateef',
  'swiper-element-bundle.min.js',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
  /\/jobs?\/[a-z0-9-]+/i,
]

const BUNDLE_REQUIRED_SIGNALS = [
  '/products/:slug',
  '/projects',
  'TapIN Pay',
  'TVK Papanasam',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /["'`]\/careers(?:\/|["'`])/i,
  /["'`]\/career(?:\/|["'`])/i,
  /["'`]\/jobs(?:\/|["'`])/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const normalizeHtml = (value) => String(value ?? '').toLowerCase()

const isDnsResolutionError = (error) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    const code = typeof current.code === 'string' ? current.code : ''
    const message = String(current.message ?? '')

    if (
      DNS_ERROR_CODES.has(code)
      || /\b(?:ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|getaddrinfo ENOTFOUND)\b/i.test(message)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

const buildDiscoveryOnlyEvidence = (now) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: HOMEPAGE_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'Hano Software Solutions official hostname cannot be resolved; first-party careers inventory cannot be verified.',
  })

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeHtml(html)
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasVerifiedBundleSignal = (bundleText) => {
  const rawText = String(bundleText ?? '')
  return BUNDLE_REQUIRED_SIGNALS.every((signal) => rawText.includes(signal))
}

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedCareersShell = (page = {}) =>
  Number(page?.status) === 200
  && hasOfficialHomepageSignal(page?.html)
  && extractBundleAssetPath(page?.html) !== null
  && !hasPublicJobsSignal(page?.html)

export const createHanoSoftwareSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)

      if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
        throw new Error('Hano Software Solutions verified official homepage no longer matches the known public surface')
      }

      if (hasPublicJobsSignal(homepage.html)) {
        throw new Error('Hano Software Solutions homepage now appears to expose a public jobs surface')
      }

      const bundleAssetPath = extractBundleAssetPath(homepage.html)
      if (!bundleAssetPath) {
        throw new Error('Hano Software Solutions homepage no longer exposes the verified client bundle')
      }

      const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
      const bundleText = await fetchText(bundleUrl)

      if (!hasVerifiedBundleSignal(bundleText) || hasBundleJobsSignal(bundleText)) {
        throw new Error('Hano Software Solutions client bundle changed materially or now exposes a public jobs surface')
      }

      for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
        const careersRoute = await fetchPage(careersRouteUrl)

        if (!isVerifiedCareersShell(careersRoute)) {
          throw new Error('Hano Software Solutions careers routes changed materially or now expose public jobs')
        }
      }

      return []
    } catch (error) {
      if (isDnsResolutionError(error)) return buildDiscoveryOnlyEvidence(now)
      throw error
    }
  },
})

export const run = async (options = {}) => createHanoSoftwareSolutionsScraper(options).run(options)

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
