import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { collectCurrentCheckPoint, inspectCurrentCheckPointSearch } from './currentNext.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'checkpointindia'
export const COMPANY = 'Check Point India'
export const OFFICIAL_CAREERS_URL = 'https://www.checkpoint.com/careers/'
export const OFFICIAL_JOBS_SURFACE_URL =
  'https://careers.checkpoint.com/index.php?m=cpcareers&a=search'
export const OFFICIAL_INDIA_SEARCH_URL =
  'https://careers.checkpoint.com/index.php?m=cpcareers&a=search&fa[]=country_s:India'
export const SMARTRECRUITERS_COMPANY_IDENTIFIER = 'CheckPointSoftwareTechnologies2'
export const SMARTRECRUITERS_LISTING_API_URL =
  `https://api.smartrecruiters.com/v1/companies/${SMARTRECRUITERS_COMPANY_IDENTIFIER}/postings`
export const SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE =
  `${SMARTRECRUITERS_LISTING_API_URL}/{{jobId}}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#0*38;|&#x26;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#xa0;/gi, ' ')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|ul|ol|h\d)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value)).toString()
  } catch {
    return null
  }
}

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'in' || normalized === 'india') return 'India'
  return normalized === 'us' || normalized === 'usa'
    ? 'United States'
    : normalizeWhitespace(value)
}

const normalizeRemoteStatus = (location = {}) => {
  if (location?.remote) return 'Remote'
  if (location?.hybrid) return 'Hybrid'
  return 'On-site'
}

const formatLocation = (location = {}) => {
  const city = normalizeWhitespace(location?.city)
  const region = normalizeWhitespace(location?.region)
  const country = normalizeCountry(location?.country)
  const parts = [city, region, country].filter(Boolean)

  if (parts.length > 0) return parts.join(', ')

  const fullLocation = normalizeWhitespace(location?.fullLocation)
  if (!fullLocation) return null

  return fullLocation
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join(', ')
}

const extractSectionText = (detail = {}, sectionKey) =>
  stripHtml(detail?.jobAd?.sections?.[sectionKey]?.text)

const extractCustomFieldValueLabel = (detail = {}, fieldLabel) => {
  const fields = Array.isArray(detail?.customField) ? detail.customField : []

  const match = fields.find((field) => normalizeWhitespace(field?.fieldLabel) === fieldLabel)
  return normalizeWhitespace(match?.valueLabel)
}

export const hasOfficialLandingSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Check Point Software\s*<\/title>/i.test(page)
    && /Join Check Point Software/i.test(page)
    && extractOfficialJobsSurfaceUrl(page) === OFFICIAL_JOBS_SURFACE_URL
}

export const extractOfficialJobsSurfaceUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']*careers\.checkpoint\.com\/index\.php\?[^"']+)["']/gi)) {
    const normalized = normalizeUrl(match[1])
    if (!normalized) continue

    const url = new URL(normalized)
    if (
      url.hostname === 'careers.checkpoint.com'
      && url.pathname === '/index.php'
      && url.searchParams.get('m') === 'cpcareers'
      && url.searchParams.get('a') === 'search'
    ) {
      return OFFICIAL_JOBS_SURFACE_URL
    }
  }

  return null
}

export const hasOfficialIndiaSearchSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career Opportunities at Check Point Software\s*<\/title>/i.test(page)
    && /<form[^>]+id="solrSearch"/i.test(page)
    && /Explore by Location, Role, or Department/i.test(page)
    && /value="country_s:India"/i.test(page)
    && /id="positionResults"/i.test(page)
}

export const extractOfficialDetailUrls = (html) => {
  const detailUrls = new Set()

  for (const match of String(html ?? '').matchAll(
    /href="(https:\/\/careers\.checkpoint\.com\/index\.php\?m=cpcareers(?:&amp;|&)a=show(?:&amp;|&)joborderid=\d+)"/gi,
  )) {
    const normalized = normalizeUrl(match[1])
    if (normalized) detailUrls.add(normalized)
  }

  return [...detailUrls]
}

export const extractVerifiedApplyUrl = (html) => {
  const match = String(html ?? '').match(
    /<a[^>]+id="submitBtn"[^>]+href="(https:\/\/jobs\.smartrecruiters\.com\/[^"]+\?[^"]*)"[^>]*>\s*APPLY NOW\s*<\/a>/i,
  )

  return normalizeUrl(match?.[1])
}

export const extractSmartRecruitersCompanyIdentifier = (value) => {
  try {
    const url = new URL(value)
    const [companyIdentifier] = url.pathname.split('/').filter(Boolean)
    return companyIdentifier || null
  } catch {
    return null
  }
}

export const hasOfficialDetailSignal = (html) => {
  const page = String(html ?? '')
  const applyUrl = extractVerifiedApplyUrl(page)

  return /class="place">\s*India:/i.test(page)
    && /APPLY NOW/i.test(page)
    && extractSmartRecruitersCompanyIdentifier(applyUrl) === SMARTRECRUITERS_COMPANY_IDENTIFIER
}

const buildListingApiUrl = (offset) => {
  const url = new URL(SMARTRECRUITERS_LISTING_API_URL)
  url.searchParams.set('limit', '100')
  url.searchParams.set('country', 'in')
  url.searchParams.set('offset', String(offset))
  return url.toString()
}

const buildDetailApiUrl = (jobId) =>
  SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE.replace('{{jobId}}', encodeURIComponent(jobId))

const mapJob = (listing, detail) => {
  const location = formatLocation(detail?.location || listing?.location)
  const country = normalizeCountry(detail?.location?.country || listing?.location?.country)
  const postingUrl = normalizeUrl(detail?.postingUrl)
  const applyUrl = normalizeUrl(detail?.applyUrl)
  const jobDescription = extractSectionText(detail, 'jobDescription')
  const minimumQualification = extractSectionText(detail, 'qualifications')
  const preferredQualification = extractSectionText(detail, 'additionalInformation')

  if (!location || country !== 'India' || !postingUrl || !applyUrl) {
    return null
  }

  return {
    title: normalizeWhitespace(detail?.name || listing?.name),
    company: COMPANY,
    location,
    city: normalizeWhitespace(detail?.location?.city || listing?.location?.city),
    state: normalizeWhitespace(detail?.location?.region || listing?.location?.region),
    country: 'India',
    link: postingUrl,
    applyUrl,
    sourceUrl: postingUrl,
    source: SOURCE,
    jobId: normalizeWhitespace(detail?.id || listing?.id),
    requisitionId: normalizeWhitespace(detail?.refNumber || listing?.refNumber),
    department:
      extractCustomFieldValueLabel(detail, 'Career site Category')
      || extractCustomFieldValueLabel(detail, 'CP Department'),
    employmentType: normalizeWhitespace(detail?.typeOfEmployment?.label || listing?.typeOfEmployment?.label),
    experienceRequired: null,
    experienceLevel: normalizeWhitespace(detail?.experienceLevel?.label || listing?.experienceLevel?.label),
    postingDate: normalizeWhitespace(detail?.releasedDate || listing?.releasedDate),
    jobDescription,
    minimumQualification,
    preferredQualification,
    requiredSkills: [],
    remoteStatus: normalizeRemoteStatus(detail?.location || listing?.location),
    scrapedAt: new Date().toISOString(),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = (url, { signal } = {}) => fetchTextWithRetry(url, {
  includeResponseMetadata: true,
  signal,
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  signal: options.signal,
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: OFFICIAL_INDIA_SEARCH_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

const fetchAllIndiaListings = async (fetchJson) => {
  const listings = []
  let offset = 0
  let totalFound = null

  while (totalFound == null || offset < totalFound) {
    const payload = await fetchJson(buildListingApiUrl(offset), { method: 'GET' })
    const pageListings = Array.isArray(payload?.content) ? payload.content : []

    listings.push(...pageListings)
    totalFound = Number(payload?.totalFound) || 0

    if (pageListings.length === 0 || pageListings.length < 100) break
    offset += 100
  }

  return listings
}

export const createCheckPointIndiaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const { fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = options
    const readPage = options.fetchPage || (options.fetchText
      ? async url => ({ status: 200, url, html: await fetchText(url) })
      : url => defaultFetchPage(url, { signal }))
    signal?.throwIfAborted()
    const landingPage = await readPage(OFFICIAL_CAREERS_URL)
    const landingHtml = landingPage.html

    if (!hasOfficialLandingSignal(landingHtml)) {
      throw new Error('Check Point India official careers landing page changed and no longer matches the verified first-party surface')
    }

    if (extractOfficialJobsSurfaceUrl(landingHtml) !== OFFICIAL_JOBS_SURFACE_URL) {
      throw new Error('Check Point India verified first-party jobs surface changed on the official careers landing page')
    }

    const searchPage = await readPage(OFFICIAL_INDIA_SEARCH_URL)
    const searchHtml = searchPage.html

    if (inspectCurrentCheckPointSearch(searchPage)) {
      return collectCurrentCheckPoint({ landingPage, searchPage, fetchPage: readPage, fetchJson,
        buildListingApiUrl, buildDetailApiUrl, mapJob, maxJobs, signal })
    }

    if (!hasOfficialIndiaSearchSignal(searchHtml)) {
      throw new Error('Check Point India official India search surface changed and no longer matches the verified first-party jobs page')
    }

    const officialDetailUrls = extractOfficialDetailUrls(searchHtml)

    if (officialDetailUrls.length > 0) {
      const detailHtml = await fetchText(officialDetailUrls[0])

      if (!hasOfficialDetailSignal(detailHtml)) {
        throw new Error('Check Point India verified SmartRecruiters handoff changed on the official job detail page')
      }
    }

    const listings = await fetchAllIndiaListings(fetchJson)
    const jobs = []

    for (const listing of listings) {
      if (normalizeWhitespace(listing?.company?.identifier) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
        throw new Error('Check Point India SmartRecruiters company identifier changed on the public India listings API')
      }

      const detail = await fetchJson(buildDetailApiUrl(listing.id), { method: 'GET' })

      if (normalizeWhitespace(detail?.company?.identifier) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
        throw new Error('Check Point India SmartRecruiters detail API no longer matches the verified public ATS company')
      }

      const mappedJob = mapJob(listing, detail)
      if (mappedJob) jobs.push(mappedJob)
    }

    if (officialDetailUrls.length > 0 && jobs.length === 0) {
      throw new Error('Check Point India verified official search page still exposes India job detail routes but the public ATS returned no public India jobs')
    }

    if (officialDetailUrls.length === 0 && jobs.length > 0) {
      throw new Error('Check Point India official India search page no longer exposes detail routes for live public India jobs')
    }

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createCheckPointIndiaScraper(options).run(options)

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
