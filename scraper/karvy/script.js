import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KARVY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KARVY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const PARKED_HOMEPAGE_URLS = PROVIDER_METADATA.parkedHomepageUrls
export const LEGACY_HOMEPAGE_URL = PROVIDER_METADATA.legacyHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LANDER_URL = 'https://www.karvyonline.com/lander'
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /href=["'][^"']*\/jobs\/[^"']*["']/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]
const COMPROMISED_LEGACY_HOMEPAGE_PATTERN =
  /\bkembangtoto\b|\bbandar\s+toto\b|\bsitus\s+toto\b|\btoto\s+4d\b|\btogel\b/i

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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasParkedHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return (
    normalized.includes('porkbun marketplace')
    && normalized.includes('this domain is for sale')
    && normalized.includes('karvy.com is for sale')
    && normalized.includes('buy now price')
  ) || (
    normalized.includes('403 forbidden')
    && !hasPublicJobsSignal(html)
  )
}

export const hasCloudflareTimeoutSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('522: connection timed out')
    && normalized.includes('connection timed out')
    && normalized.includes('cloudflare')
    && !hasPublicJobsSignal(html)
}

export const hasCompromisedLegacyHomepageSignal = (html = '') =>
  COMPROMISED_LEGACY_HOMEPAGE_PATTERN.test(normalizeWhitespace(html))
  && !hasPublicJobsSignal(html)

export const hasRedirectToLanderSignal = (html = '') =>
  /window\.location\.href\s*=\s*["']\/lander["']/i.test(String(html ?? ''))

export const hasParkedLanderSignal = (html = '') => {
  const page = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && /_trfd\.push\(\{ap:\s*["']parking["']\}\)/i.test(page)
    && /img1\.wsimg\.com\/parking-lander/i.test(page)
}

export const hasOfficialLegacyRootSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return normalized.includes('leading stock broking company in india')
    && normalized.includes('mutual funds')
    && normalized.includes('open demat account online in 15 mins')
    && /href=["'][^"']*\/join-us\/career(?:\/|\.html)?["']/i.test(String(html ?? ''))
    && !hasPublicJobsSignal(html)
}

export const hasStaleCareerPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const hasResumeContact = normalized.includes('careers@karvy.com')
    || /email resume to[\s\S]*__cf_email__/i.test(page)
    || (/email resume to/i.test(page) && /\[email(?:&#160;|&nbsp;|\s)*protected\]/i.test(page))

  return /<title>\s*Career\s*<\/title>/i.test(page)
    && normalized.includes('interested to join us?')
    && normalized.includes('apply')
    && hasResumeContact
    && normalized.includes('sebi')
    && !hasPublicJobsSignal(page)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  })

  return {
    ok: response.ok,
    status: response.status,
    url: url,
    finalUrl: response.url,
    html: await response.text(),
  }
}

const buildUpstreamUnavailableError = (surfaceName, page = {}) => Object.assign(
  new Error(`Karvy ${surfaceName} appears compromised; current job inventory is unavailable: ${page.finalUrl || page.url || LEGACY_HOMEPAGE_URL}`),
  {
    softFailure: true,
    upstreamOutage: true,
    abortRetries: true,
    failureType: 'upstream_unavailable',
    failureKind: 'upstream_unavailable',
  },
)

export const createKarvyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of PARKED_HOMEPAGE_URLS) {
      const page = await fetchPage(url)
      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Karvy parked exact-name domain now exposes public jobs: ${url}`)
      }
      if (![200, 403].includes(Number(page.status)) || !hasParkedHomepageSignal(page.html)) {
        throw new Error(`Karvy parked exact-name domain contract changed: ${url}`)
      }
    }

    const legacyHomepage = await fetchPage(LEGACY_HOMEPAGE_URL)
    if (hasPublicJobsSignal(legacyHomepage.html)) {
      throw new Error('Karvy legacy homepage now exposes public jobs')
    }

    if (hasCompromisedLegacyHomepageSignal(legacyHomepage.html)) {
      throw buildUpstreamUnavailableError('legacy homepage', legacyHomepage)
    }

    if (Number(legacyHomepage.status) === 522 && hasCloudflareTimeoutSignal(legacyHomepage.html)) {
      return []
    }

    if (Number(legacyHomepage.status) === 200 && hasRedirectToLanderSignal(legacyHomepage.html)) {
      const careersPage = await fetchPage(CAREERS_URL)
      if (hasPublicJobsSignal(careersPage.html)) {
        throw new Error('Karvy stale career page now exposes public job listings')
      }
      if (Number(careersPage.status) !== 200 || !hasRedirectToLanderSignal(careersPage.html)) {
        throw new Error('Karvy legacy career handoff no longer matches the verified parked redirect surface')
      }

      const landerPage = await fetchPage(LANDER_URL)
      if (hasPublicJobsSignal(landerPage.html)) {
        throw new Error('Karvy parked legacy lander now exposes public job listings')
      }
      if (Number(landerPage.status) !== 200 || !hasParkedLanderSignal(landerPage.html)) {
        throw new Error('Karvy parked legacy lander no longer matches the verified parked-domain surface')
      }

      return []
    }

    if (Number(legacyHomepage.status) !== 200 || !hasOfficialLegacyRootSignal(legacyHomepage.html)) {
      throw new Error('Karvy legacy homepage no longer matches the verified first-party careers handoff surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Karvy stale career page now exposes public job listings')
    }
    if (Number(careersPage.status) !== 200 || !hasStaleCareerPageSignal(careersPage.html)) {
      throw new Error('Karvy stale career page no longer matches the verified resume-only contract')
    }

    return []
  },
})

export const run = async (options = {}) => createKarvyScraper().run(options)

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
