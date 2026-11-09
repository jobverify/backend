import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vdart'
export const COMPANY = 'VDart'
export const HOMEPAGE_URL = 'https://www.vdart.com/'
export const CAREERS_URL = 'https://vdart.jobs.net/'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'VDart',
  adapter: 'script',
  modulePath: '../../scraper/vdart/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers-blocked',
  countryFilter: 'India',
  paginationStrategy: 'jobsnet-cloudflare-blocked-root-and-jobs-route-validation',
  extractionStrategy: 'verified-jobsnet-cloudflare-block-page+verified-403-blocked-surface+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'vdart.jobs.net',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that both https://vdart.jobs.net/ and its /jobs route now resolve to the same Cloudflare block page with live HTTP 403 responses, so this provider remains fail-closed until a trustworthy fetchable public jobs listing is confirmed.',
  dryRunFile: 'vdart/jobs.json',
}

export const hasExpectedShellSignals = (html) => {
  const page = String(html ?? '')
  return /Attention Required!\s*\|\s*Cloudflare/i.test(page)
    && /Please enable cookies/i.test(page)
    && /Sorry,\s*you have been blocked/i.test(page)
    && /cf-wrapper|cf-error-details/i.test(page)
}

export const isBlockedJobsSurface = (response) => Number(response?.status) === 403

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const run = async ({ fetchPage = defaultFetchPage } = {}) => {
  const shellPage = await fetchPage(CAREERS_URL)
  if (!hasExpectedShellSignals(shellPage?.html)) {
    throw new Error('VDart verified public jobs shell changed materially')
  }

  const jobsPage = await fetchPage(`${CAREERS_URL}jobs`)
  if (!isBlockedJobsSurface(jobsPage)) {
    throw new Error('VDart blocked jobs surface changed materially')
  }

  return []
}

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

