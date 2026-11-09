import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mavericsystems'
export const COMPANY_NAME = 'Maveric Systems'
export const HOMEPAGE_URL = 'https://maveric-systems.com/'
export const CAREER_PAGE_URL = 'https://maveric-systems.com/careers/'
export const SUMMARY_URL = 'https://career44.sapsf.com/career?company=mavericsys&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&'
export const DETAIL_BASE_URL = 'https://career44.sapsf.com/career?career_ns=job_listing&company=mavericsys&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&selected_lang=en_US&browserTimeZone=Asia/Calcutta'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

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

const normalizeHostname = (value) => String(value ?? '').replace(/^www\./i, '').toLowerCase()
const isFirstPartyUrl = (value) => normalizeHostname(new URL(value).hostname) === 'maveric-systems.com'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => new URL(value, SUMMARY_URL).toString()

export const buildDetailUrl = (requisitionId) =>
  `${DETAIL_BASE_URL}&career_job_req_id=${encodeURIComponent(String(requisitionId))}`

export const buildSearchUrl = () => SUMMARY_URL

export const isVerifiedFirstPartyRedirectUrl = (value) => {
  try {
    const url = new URL(value, HOMEPAGE_URL)
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/'

    return normalizeHostname(url.hostname) === 'maveric-systems.com'
      && (normalizedPath === '/' || normalizedPath === '/careers' || normalizedPath.startsWith('/careers/'))
  } catch {
    return false
  }
}

export const hasSucuriJavascriptChallengeSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(page)
    && /Javascript is required\.\s*Please enable javascript before you are allowed to see this page\./i.test(page)
    && /sucuri_cloudproxy_js/i.test(page)
}

const parseRow = (rowHtml) => {
  const titleMatch = rowHtml.match(/<a class="jobTitle"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
  const title = normalizeWhitespace(titleMatch?.[2])
  const href = titleMatch?.[1] ? buildAbsoluteUrl(titleMatch[1]) : null
  const text = stripTags(rowHtml) || ''
  const requisitionId = normalizeWhitespace(rowHtml.match(/Requisition ID:\s*<span[^>]*>([^<]+)<\/span>/i)?.[1])
  const rowMatch = text.match(/Posted on\s+([0-9/.-]+)\s*-\s*([^-\n]+?)\s*-\s*([^-]+?)(?:\s+No Travel|$)/i)
  const postingDate = normalizeWhitespace(rowMatch?.[1])
  const location = normalizeWhitespace(rowMatch?.[2]) || null
  const department = normalizeWhitespace(rowMatch?.[3]?.replace(/\s+No Travel$/i, '') || null)
  const travel = /No Travel/i.test(text) ? 'No Travel' : null

  if (!title || !requisitionId || !href) return null

  const detailUrl = buildDetailUrl(requisitionId)

  return {
    title,
    company: COMPANY_NAME,
    department,
    location: location ? `${location}, India` : 'India',
    city: location ? location.replace(/,?\s*India$/i, '') : null,
    country: 'India',
    jobId: requisitionId,
    requisitionId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    link: detailUrl,
    postingDate: postingDate || null,
    remoteStatus: travel ? 'On-site' : null,
    jobDescription: null,
  }
}

export const extractSearchResults = (html) => {
  const results = []

  for (const match of String(html ?? '').matchAll(/<tr class="jobResultItem">([\s\S]*?)<\/tr>/gi)) {
    const row = parseRow(match[1])
    if (row) results.push(row)
  }

  return results
}

const extractMeta = (html) => normalizeWhitespace(
  html.match(/<div class="job-meta">([\s\S]*?)<\/div>/i)?.[1]
  || '',
)

const extractDetailDescription = (html) => {
  const descriptionHtml = html.match(/<div class="job-description">([\s\S]*?)<\/div>/i)?.[1]
  return normalizeWhitespace(stripTags(descriptionHtml || html))
}

const extractApplyUrl = (html) => {
  const href = decodeHtmlEntities(html.match(/<a[^>]*href="([^"]+)"[^>]*>\s*Apply\s*<\/a>/i)?.[1])
  return href ? new URL(href, DETAIL_BASE_URL).toString() : null
}

export const extractJobDetail = (html, listing = {}) => {
  const rawTitle = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || listing.title || '') || ''
  const title = normalizeWhitespace(
    rawTitle
      .replace(/^Career Opportunities:\s*/i, '')
      .replace(/\s*\(\d+\)\s*$/i, ''),
  )
  const meta = extractMeta(html)
  const applyUrl = extractApplyUrl(html) || buildDetailUrl(listing.requisitionId || listing.jobId)
  const jobDescription = extractDetailDescription(html)

  return {
    title,
    requisitionId: listing.requisitionId || listing.jobId || null,
    applyUrl,
    jobDescription,
    meta,
  }
}

const verifyFirstPartySurface = async (fetchText) => {
  const homepageHtml = await fetchText(HOMEPAGE_URL)
  const careersHtml = await fetchText(CAREER_PAGE_URL)

  if (!/maveric systems/i.test(homepageHtml) && !hasSucuriJavascriptChallengeSignal(homepageHtml)) {
    throw new Error('Maveric Systems homepage verification failed')
  }

  if (!/career44\.sapsf\.com|successfactors/i.test(careersHtml) && !hasSucuriJavascriptChallengeSignal(careersHtml)) {
    throw new Error('Maveric Systems careers verification failed')
  }
}

export const fetchFirstPartyHtml = async (url, {
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxRedirects = MAX_REDIRECTS,
} = {}) => {
  let currentUrl = url

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetchImpl(currentUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: createTimeoutSignal(timeoutMs),
    })
    const html = await response.text()

    if (response.ok) {
      return html
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      if (hasSucuriJavascriptChallengeSignal(html)) {
        return html
      }

      const location = response.headers?.get?.('location')
      const nextUrl = location ? new URL(location, currentUrl).toString() : null

      if (!nextUrl || !isVerifiedFirstPartyRedirectUrl(nextUrl)) {
        throw new Error('Maveric Systems first-party redirect no longer points to the verified public surface')
      }

      currentUrl = nextUrl
      continue
    }

    throw new Error(`HTTP ${response.status} for ${currentUrl}`)
  }

  throw new Error(`Maveric Systems first-party redirect exceeded ${maxRedirects} hops`)
}

const fetchTextWithHeaders = async (url, {
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) => {
  if (isFirstPartyUrl(url)) {
    return fetchFirstPartyHtml(url, {
      fetchImpl,
      timeoutMs,
    })
  }

  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const hasNextPage = (html) => /<a[^>]+title=["']Next Page["'][^>]*>/i.test(String(html ?? ''))

export const getLiveSearchPages = async ({
  fetchText = fetchTextWithHeaders,
  searchUrl = SUMMARY_URL,
} = {}) => {
  const html = await fetchText(searchUrl)

  if (hasNextPage(html)) {
    throw new Error(
      'Maveric Systems API-only migration required: the verified SuccessFactors board requires pagination, but no HTTP pagination request contract is available; browser automation is disabled.',
    )
  }

  return [html]
}

const collectSummaryPages = (pages) => {
  const listings = []
  const seenIds = new Set()

  for (const html of pages) {
    for (const listing of extractSearchResults(html)) {
      if (seenIds.has(listing.requisitionId)) continue
      seenIds.add(listing.requisitionId)
      listings.push(listing)
    }
  }

  return listings
}

export const createMavericSystemsScraper = ({
  fetchText = fetchTextWithHeaders,
  getSearchPages = (options = {}) => getLiveSearchPages({ ...options, fetchText }),
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    await verifyFirstPartySurface(fetchText)

    const searchPages = await getSearchPages({ searchUrl: buildSearchUrl(), fetchText })
    const listings = collectSummaryPages(searchPages)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...listing,
        ...detail,
        source: SOURCE,
        company: COMPANY_NAME,
        country: 'India',
        companyCareerPage: CAREER_PAGE_URL,
        companyDomain: 'maveric-systems.com',
        atsPlatform: 'successfactors',
        link: detail.applyUrl || listing.applyUrl || listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createMavericSystemsScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Maveric Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
