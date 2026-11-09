import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'codevicesolutionpvtltd'
export const COMPANY = 'Codevice Solution Pvt Ltd'
export const HOMEPAGE_URL = 'https://codevicesolution.in/'
export const REQUEST_TIMEOUT_MS = 15000
export const CAREERS_ROUTE_URLS = [
  'https://codevicesolution.in/careers',
  'https://codevicesolution.in/careers/',
  'https://codevicesolution.in/career',
  'https://codevicesolution.in/career/',
  'https://codevicesolution.in/jobs',
  'https://codevicesolution.in/jobs/',
  'https://codevicesolution.in/join-us',
  'https://codevicesolution.in/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  '<title>codevice solution</title>',
  '<div id="root"></div>',
  'href="/cspl.ico"',
  'fonts.googleapis.com/css2?family=alegreya+sans',
  'family=jetbrains+mono',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bvacan(?:y|cies)\b/i,
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

const BUNDLE_REQUIRED_SIGNALS = [
  'Codevice Solution Pvt Ltd',
  'mailto:info@codevicesolution.in',
  'mailto:codevicesolutionpvtltd@gmail.com',
  'https://maps.app.goo.gl/MvosXM1o7tmyr5v17',
  'No. 30, 3rd Cross, Sai Baba Nagar, Behind Sai Baba Temple, Andrahalli, Bangalore North, Karnataka 560-091',
  '© 2023 Codevice Solution Private Limited. All Rights Reserved | Design by Codevice Solution Private Limited',
  '"/service"',
  '"/product"',
  '"/3d-eye"',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /["'`]\/careers?(?:\/|["'`])/i,
  /["'`]\/jobs?(?:\/|["'`])/i,
  /["'`]\/join-us(?:\/|["'`])/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bvacan(?:y|cies)\b/i,
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

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  signal?.throwIfAborted()
  const html = await response.text()
  signal?.throwIfAborted()
  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html,
  }
}

const defaultFetchText = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  signal?.throwIfAborted()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const text = await response.text()
  signal?.throwIfAborted()
  return text
}

const normalizeHtml = (value) => String(value ?? '').toLowerCase()

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeHtml(html)
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && extractBundleAssetPath(html) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

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

export const createCodeviceSolutionPvtLtdScraper = () => ({
  async run({
    signal,
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
  } = {}) {
    if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new Error('Invalid Codevice Solution Pvt Ltd request deadline')
    }
    signal?.throwIfAborted()
    const request = async (fetchSurface, url) => {
      signal?.throwIfAborted()
      const deadline = AbortSignal.timeout(requestTimeoutMs)
      const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
      try {
        const result = await fetchSurface(url, { signal: requestSignal })
        signal?.throwIfAborted()
        requestSignal.throwIfAborted()
        return result
      } catch (error) {
        signal?.throwIfAborted()
        requestSignal.throwIfAborted()
        throw error
      }
    }

    const homepage = await request(fetchPage, HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Codevice Solution Pvt Ltd verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Codevice Solution Pvt Ltd homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('Codevice Solution Pvt Ltd homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await request(fetchText, bundleUrl)

    if (!hasVerifiedBundleSignal(bundleText) || hasBundleJobsSignal(bundleText)) {
      throw new Error('Codevice Solution Pvt Ltd client bundle changed materially or now exposes a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await request(fetchPage, careersRouteUrl)

      if (!isVerifiedCareersShell(careersRoute)) {
        throw new Error('Codevice Solution Pvt Ltd careers routes changed materially or now expose public jobs')
      }

      if (extractBundleAssetPath(careersRoute.html) !== bundleAssetPath) {
        throw new Error('Codevice Solution Pvt Ltd careers route shell no longer matches the verified client bundle')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCodeviceSolutionPvtLtdScraper().run(options)

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
