import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'storeysrealestate'
export const COMPANY = 'Storeys Real Estate'
export const HOMEPAGE_URL = 'https://www.storeys.ae/'
export const CAREERS_URL = 'https://www.storeys.ae/careers'
export const CURRENT_CAREERS_URL = 'https://storeys.ae/careers.html'
export const CAREERS_API_URL = 'https://api.storeys.ae/api/v1/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const CERTIFICATE_ERROR_PATTERNS = [
  /\bcertificate has expired\b/i,
  /\bcert_has_expired\b/i,
  /\berr_cert_date_invalid\b/i,
  /\bdepth_zero_self_signed_cert\b/i,
  /\bself[-\s]signed certificate\b/i,
  /\bunable to verify the first certificate\b/i,
]

const TIMEOUT_ERROR_PATTERNS = [
  /\btimeout\b/i,
  /\btimed out\b/i,
  /\boperation was aborted\b/i,
  /\baborted\b/i,
  /\bund_err_connect_timeout\b/i,
  /\bheaders timeout\b/i,
  /\bbody timeout\b/i,
  /\bconnect timeout\b/i,
]

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\\u003c/gi, '<')
  .replace(/\\u003e/gi, '>')
  .replace(/\\u0026/gi, '&')
  .replace(/\\\//g, '/')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractErrorMessage = (error) =>
  String(error?.cause?.message ?? error?.message ?? error ?? '')

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'storeys.ae'
      || hostname === 'www.storeys.ae'
      || hostname === 'api.storeys.ae'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
      },
      signal: createTimeoutSignal(REQUEST_TIMEOUT_MS),
    })

    return {
      status: response.status,
      url: response.url,
      contentType: String(response.headers?.get?.('content-type') || ''),
      html: await response.text(),
      errorMessage: '',
    }
  } catch (error) {
    const errorMessage = extractErrorMessage(error)

    return {
      status: hasTimeoutError(errorMessage) ? 'TIMEOUT' : 'NETWORK_ERROR',
      url,
      contentType: '',
      html: '',
      errorMessage,
    }
  }
}

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasRecoverableCertificateError = (value) =>
  CERTIFICATE_ERROR_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasTimeoutError = (value) =>
  TIMEOUT_ERROR_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasBrokenWordPressJsonSignal = (page = {}) => {
  const raw = String(page.html ?? '')
  const normalized = normalizeWhitespace(raw)

  return Number(page.status) === 500
    && isOfficialDomainUrl(page.url || '')
    && /application\/json/i.test(String(page.contentType || ''))
    && /"code"\s*:\s*"internal_server_error"/i.test(raw)
    && /"status"\s*:\s*500/i.test(raw)
    && normalized.includes('There has been a critical error on this website.')
    && normalized.includes('Learn more about troubleshooting WordPress.')
    && !hasPublicJobsSignal(raw)
}

export const hasUnavailableCareersApiSignal = (page = {}) => {
  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  if (!isOfficialDomainUrl(page.url || CAREERS_API_URL)) {
    return false
  }

  if (String(page.status) === 'TIMEOUT') {
    return hasTimeoutError(page.errorMessage)
  }

  return hasBrokenWordPressJsonSignal(page)
}


const isVerifiedPageUrl = (value, expectedPath) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && ['storeys.ae', 'www.storeys.ae'].includes(url.hostname.toLowerCase())
      && url.pathname === expectedPath
      && !url.search
      && !url.username
      && !url.password
  } catch {
    return false
  }
}

export const hasCurrentStoreysHomepage = (page = {}) => {
  const raw = String(page.html ?? '')
  const text = normalizeWhitespace(raw)
  return Number(page.status) === 200
    && isVerifiedPageUrl(page.url, '/')
    && /<title>\s*Off-Plan &amp; Ready Property in Dubai \| Storeys Real Estate\s*<\/title>/i.test(raw)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/storeys\.ae\/["']/i.test(raw)
    && /href=["']careers\.html["']/i.test(raw)
    && /mailto:enquiries@storeys\.ae/i.test(raw)
    && text.includes('Off-plan and ready homes in Dubai, Sharjah and Abu Dhabi.')
}

const hasCurrentStoreysLegalIdentity = (raw) => {
  for (const match of raw.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const schema = JSON.parse(match[1])
      const entities = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema]
      if (entities.some(entity => entity['@type'] === 'RealEstateAgent'
        && entity.name === 'Storeys Real Estate LLC'
        && entity.url === 'https://storeys.ae/'
        && entity.email === 'hiring@storeys.ae'
        && entity.address?.addressCountry === 'AE'
        && entity.address?.addressLocality === 'Dubai')) return true
    } catch {
      return false
    }
  }
  return false
}

export const hasCurrentStoreysResumeIntake = (page = {}) => {
  const raw = String(page.html ?? '')
  const text = normalizeWhitespace(raw)
  const scriptSources = [...raw.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1])
  return Number(page.status) === 200
    && isVerifiedPageUrl(page.url, '/careers.html')
    && /<title>\s*Careers at Storeys Real Estate — Dubai, Abu Dhabi &amp; Sharjah\s*<\/title>/i.test(raw)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/storeys\.ae\/careers\.html["']/i.test(raw)
    && hasCurrentStoreysLegalIdentity(raw)
    && /href=["']mailto:hiring@storeys\.ae["']/i.test(raw)
    && text.includes('Real estate careers in Dubai, Abu Dhabi and Sharjah.')
    && text.includes('Your CV is emailed to our hiring team and is not stored on this website.')
    && /<form\b[^>]*id=["']jobForm["']/i.test(raw)
    && /<input\b[^>]*name=["']cv["'][^>]*accept=["']application\/pdf,\.pdf["']/i.test(raw)
    && /fetch\(\s*["']\/api\/bewerbung["']\s*,\s*\{\s*method\s*:\s*["']POST["']\s*,\s*body\s*:\s*daten\s*\}/.test(raw)
    && scriptSources.every(src => src === '/_vercel/insights/script.js')
    && !/\bname=["'](?:job|jobId|role|roleId|position|department|city)["']/i.test(raw)
    && !hasPublicJobsSignal(raw.replace(/\bapply now\b/gi, ''))
}

const inventoryUnavailable = (message, surface, pagesFetched, firstParty) =>
  Object.assign(new Error(message), {
    code: 'STOREYS_INVENTORY_UNAVAILABLE',
    softFailure: true,
    failureKind: 'upstream_inventory_unavailable',
    abortRetries: true,
    inventoryEvidence: {
      status: 'discovery-only',
      surface,
      firstParty,
      listingComplete: false,
      pagesFetched,
      reportedTotal: null,
      indiaFacetCount: null,
      verifiedAt: new Date().toISOString(),
      reason: message,
    },
  })

export const createStoreysRealEstateScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (hasCurrentStoreysHomepage(homepage)) {
      const careersPage = await fetchPage(CURRENT_CAREERS_URL)
      if (!hasCurrentStoreysResumeIntake(careersPage)) {
        throw new Error('Storeys careers page no longer matches the verified first-party UAE resume intake')
      }
      throw inventoryUnavailable(
        'Storeys public careers inventory is unavailable: the first-party careers page provides a generic UAE resume intake; role-level public job inventory remains unverified',
        CURRENT_CAREERS_URL,
        2,
        true,
      )
    }

    if (!hasBrokenWordPressJsonSignal(homepage)) {
      const networkDetail = homepage.errorMessage ? ': ' + homepage.errorMessage : ''
      throw new Error('Storeys official homepage no longer matches a verified first-party surface' + networkDetail)
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasBrokenWordPressJsonSignal(careersPage)) {
      throw new Error('Storeys careers page no longer matches the verified broken first-party surface')
    }

    const careersApi = await fetchPage(CAREERS_API_URL)
    if (!hasUnavailableCareersApiSignal(careersApi)) {
      throw new Error('Storeys careers api no longer matches the verified unavailable first-party surface')
    }

    throw inventoryUnavailable(
      'Storeys public careers inventory is unavailable: the official site and careers API are unavailable; role-level public job inventory remains unverified',
      CAREERS_URL,
      3,
      false,
    )
  },
})

export const run = async (options = {}) => createStoreysRealEstateScraper().run(options)

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
