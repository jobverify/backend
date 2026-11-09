import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FANCLASH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FANCLASH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const PARKED_DOMAIN_REDIRECT_URL = PROVIDER_METADATA.parkedDomainRedirectUrl
export const PARKED_HOMEPAGE_URLS = [...PROVIDER_METADATA.parkedHomepageUrls]
export const NOT_FOUND_ROUTE_URLS = [...PROVIDER_METADATA.checked404RouteUrls]
export const UNRESOLVED_DOMAIN_URLS = [...PROVIDER_METADATA.unresolvedFirstPartyUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
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
]

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
  /\bnxdomain\b/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const getFinalUrl = (page, fallbackUrl = '') => page?.finalUrl || page?.url || fallbackUrl

const fetchPageOnce = async (url, fetchImpl) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url,
    finalUrl: response.url,
    html: await response.text(),
    errorMessage: '',
  }
}

export const hasSelfSignedCertificateFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error)
  return code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || /self-signed certificate/i.test(message)
}

const canUseHttpTransportFallback = (url, error) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
      && parsed.hostname === 'www.fanclash.com'
      && hasSelfSignedCertificateFailure(error)
  } catch {
    return false
  }
}

export const createFetchPage = ({ fetchImpl = fetch } = {}) => async (url) => {
  try {
    return await fetchPageOnce(url, fetchImpl)
  } catch (error) {
    if (canUseHttpTransportFallback(url, error)) {
      const fallbackUrl = new URL(url)
      fallbackUrl.protocol = 'http:'
      return fetchPageOnce(fallbackUrl.toString(), fetchImpl)
    }

    const errorMessage = String(error?.cause?.message ?? error?.message ?? error)
    return {
      status: hasDnsResolutionFailure(errorMessage) ? 'DNS_ERROR' : 'FETCH_ERROR',
      url,
      finalUrl: '',
      html: '',
      errorMessage,
    }
  }
}

const defaultFetchPage = createFetchPage()

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasDnsResolutionFailure = (value) =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasVerifiedAtomParkedRedirect = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const finalUrl = getFinalUrl(page)
  const normalized = normalizeWhitespace(rawHtml)

  return (Number(page.status) === 200 || Number(page.status) === 403)
    && finalUrl === PARKED_DOMAIN_REDIRECT_URL
    && (
      normalized.length === 0
      || (
        /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(rawHtml)
        && /(?:challenges\.cloudflare\.com|noindex,\s*nofollow)/i.test(rawHtml)
      )
      || (
        normalized.includes('atom.com')
        && normalized.includes('fanclash.com is for sale')
        && normalized.includes('premium domain for sale')
        && normalized.includes('buy now')
      )
    )
}

export const hasVerified404Route = (page = {}, requestedUrl = '') => {
  const finalUrl = getFinalUrl(page, requestedUrl)
  const normalized = normalizeWhitespace(page.html)
  const httpFallbackUrl = requestedUrl.replace(/^https:/i, 'http:')

  return Number(page.status) === 404
    && (finalUrl === requestedUrl || finalUrl === httpFallbackUrl)
    && !hasPublicJobsSignal(page.html)
    && (
      normalized.length === 0
      || (normalized.includes('404') && normalized.includes('page not found'))
      || (normalized.includes('page not found.') && normalized.includes('home'))
    )
}

export const createFanclashScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of PARKED_HOMEPAGE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Fanclash parked-domain route now appears to expose public jobs: ${url}`)
      }

      if (!hasVerifiedAtomParkedRedirect(page)) {
        throw new Error(`Fanclash parked-domain redirect changed materially: ${url}`)
      }
    }

    for (const url of NOT_FOUND_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (!hasVerified404Route(page, url)) {
        throw new Error(`Fanclash verified 404 route changed: ${url}`)
      }
    }

    for (const url of UNRESOLVED_DOMAIN_URLS) {
      const page = await fetchPage(url)

      if (String(page.status) !== 'DNS_ERROR' || !hasDnsResolutionFailure(page.errorMessage)) {
        throw new Error(`Fanclash verified unresolved first-party surface changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFanclashScraper().run(options)

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
