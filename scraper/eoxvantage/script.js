import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'eoxvantage'
export const COMPANY = 'EOX Vantage'
export const HOMEPAGE_URL = 'https://eoxvantage.com/'
export const CAREERS_URL = 'https://eoxvantage.com/careers/'
export const VERIFIED_AT = '2026-08-14'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'EOX Vantage',
  adapter: 'script',
  modulePath: '../../scraper/eoxvantage/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-site-blocked-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-and-careers-routes-blocked',
  extractionStrategy: 'verified-cloudflare-403-homepage+careers-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'eoxvantage.com',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that both https://eoxvantage.com/ and https://eoxvantage.com/careers/ returned the same Cloudflare HTTP 403 "Just a moment..." challenge with no scraper-visible public careers content. There is no trustworthy public EOX Vantage jobs surface in this environment on the verified date.',
  dryRunFile: 'eoxvantage/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildMaterialSurfaceChangeError = () => {
  const error = new Error('The verified EOX Vantage first-party careers surfaces changed materially')
  error.abortRetries = true
  return error
}

export const hasVerifiedCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && normalized.includes('Enable JavaScript and cookies to continue')
    && /challenges\.cloudflare\.com/i.test(page)
    && /_cf_chl_opt/i.test(page)
    && /eoxvantage\.com/i.test(page)
}

export const exposesStructuredPublicJobs = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /\bSales and Client Growth Executive\b/i.test(normalized)
    || /\bApply Now\b/i.test(normalized)
    || /\bApply to a Current Opening\b/i.test(normalized)
    || /\bSend Us Your Resume\b/i.test(normalized)
    || /current-openings/i.test(page)
    || /job-inquiry/i.test(page)
}

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url,
      finalUrl: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    return {
      status: null,
      url,
      finalUrl: url,
      html: null,
      errorKind: error?.name === 'AbortError' ? 'timeout' : 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const run = async ({
  fetchPage = defaultFetchPage,
} = {}) => {
  for (const url of [HOMEPAGE_URL, CAREERS_URL]) {
    const page = await fetchPage(url)

    if (page.errorKind) {
      throw new Error(`Failed to fetch verified EOX Vantage route: ${url} (${page.errorKind})`)
    }

    if (exposesStructuredPublicJobs(page.html)) {
      throw new Error('EOX Vantage careers page now exposes scraper-visible public jobs')
    }

    if (Number(page.status) !== 403 || !hasVerifiedCloudflareChallengeSignal(page.html)) {
      throw buildMaterialSurfaceChangeError()
    }
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
