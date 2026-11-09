import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

import { MAKEMYTRIP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = MAKEMYTRIP_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_LANDING_URL = PROVIDER_METADATA.careersLandingUrl
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_ORIGIN = PROVIDER_METADATA.careersOrigin
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const JOB_DETAILS_API_BASE_URL = PROVIDER_METADATA.jobDetailsApiBaseUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToText = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (!match) return normalized

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const normalizeLocationEntry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized.replace(/\s*\([^()]+\)\s*$/u, '').trim() || null
}

const unique = (values) => {
  const seen = new Set()

  return values.filter((value) => {
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const formatLocations = (values) => unique(
  (Array.isArray(values) ? values : [values])
    .map((value) => normalizeLocationEntry(value))
    .filter(Boolean),
).join('; ') || null

const extractPrimaryCity = (record = {}) => {
  const firstCity = Array.isArray(record?.location_city) ? record.location_city[0] : record?.location_city
  const normalizedCity = normalizeWhitespace(firstCity)
  if (normalizedCity) return normalizedCity

  const firstLocation = Array.isArray(record?.location) ? record.location[0] : record?.location
  return normalizeLocationEntry(firstLocation)?.split(',')[0]?.trim() || null
}

const normalizeRemoteStatus = (value) => {
  const numericValue = Number(value)
  if (numericValue === 1) return 'Remote'
  if (numericValue === 0) return 'On-site'
  return null
}

const buildExperienceRequired = (fromValue, toValue) => {
  const from = normalizeWhitespace(fromValue)
  const to = normalizeWhitespace(toValue)

  if (from && to) return from === to ? `${from} years` : `${from}-${to} years`
  if (from) return `${from}+ years`
  if (to) return `Up to ${to} years`
  return null
}

export const slugifyTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const buildOpportunityUrl = ({ jobId, title } = {}) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  const slug = slugifyTitle(title)

  if (!normalizedJobId || !slug) return null
  return `${CAREERS_ORIGIN}/prod/opportunity/${encodeURIComponent(normalizedJobId)}/${slug}`
}

export const buildJobDetailsApiUrl = (jobId) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  if (!normalizedJobId) return null
  return `${JOB_DETAILS_API_BASE_URL}${encodeURIComponent(normalizedJobId)}`
}

export const hasOfficialJobsPageShellSignal = (html = '') => {
  try {
    const page = String(html ?? '')
    const native = readNativeDocument(page), root = native.nodes(node => node.tag === 'root')[0]
    const declaredNodes = node => [node, ...(node.children || []).filter(child => typeof child !== 'string').flatMap(declaredNodes)]
    const declared = declaredNodes(root)
    // Executable declarations remain relevant inside hidden markup. An inert
    // copy cannot replace any required live shell element.
    const declaredScripts = declared.filter(node => node.tag === 'script')
    if (declaredScripts.length !== 4 || declared.some(node => ['iframe', 'object', 'embed'].includes(node.tag))) return false
    const document = readVisibleNativeDocument(page, { strict: true })
    const titles = document.nodes(node => node.tag === 'title')
    const roots = document.nodes(node => node.tag === 'div' && node.attrs.id === 'root')
    if (titles.length !== 1 || String(titles[0].raw).trim() !== 'MakeMyTrip' || roots.length !== 1
      || declared.filter(node => node.attrs?.id === 'root').length !== 1) return false
    const absolute = value => {
      const url = new URL(value, CAREERS_URL)
      return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url.href : null
    }
    const styles = document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('stylesheet')
      && absolute(node.attrs.href) === CAREERS_ORIGIN + '/styles.css')
    const expected = [CAREERS_ORIGIN + '/cdn/jquery.min.js', CAREERS_ORIGIN + '/cdn/slick.min.js',
      'https://imgak.mmtcdn.com/mmt-careers-ui/assets/static/scripts/adobeAnalytics.js', CAREERS_ORIGIN + '/bundle.js']
    const scripts = document.nodes(node => node.tag === 'script')
    return styles.length === 1 && scripts.length === expected.length
      && scripts.every((node, index) => !Object.hasOwn(node.attrs, 'nomodule')
        && /^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test((node.attrs.type || '').trim())
        && node.attrs.src && absolute(node.attrs.src) === expected[index])
  } catch { return false }
}

const isIndiaListing = (record = {}) =>
  normalizeWhitespace(record?.location_country)?.toLowerCase() === COUNTRY_FILTER.toLowerCase()

const isPublicListing = (record = {}) => Number(record?.post_on_careers_page) === 1

const mapListingRecord = (record = {}) => {
  const title = normalizeWhitespace(record?.job_title)
  const jobId = normalizeWhitespace(record?.job_id)
  const requisitionId = normalizeWhitespace(record?.job_code)
  const sourceUrl = buildOpportunityUrl({ jobId, title })

  if (!title || !jobId || !requisitionId || !sourceUrl) return null

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(record?.business_unit) || null,
    team: normalizeWhitespace(record?.parent_department || record?.department) || null,
    location: formatLocations(record?.location),
    city: extractPrimaryCity(record),
    country: normalizeWhitespace(record?.location_country) || COUNTRY_FILTER,
    jobId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(record?.employee_type) || null,
    experienceRequired: buildExperienceRequired(record?.experience_from, record?.experience_to),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record?.job_created_timestamp),
    closingDate: null,
    jobDescription: null,
    groupCompany: normalizeWhitespace(record?.group_company) || null,
    division: normalizeWhitespace(record?.division) || null,
    remoteStatus: normalizeRemoteStatus(record?.is_remote),
    _listingRecord: record,
  }
}

export const extractSearchResults = (payload = {}) => {
  const allJobs = Array.isArray(payload?.allJobs) ? payload.allJobs : null
  if (!allJobs) {
    throw new Error('MakeMyTrip jobs API no longer returns the verified allJobs array')
  }

  return allJobs
    .filter((record) => isPublicListing(record) && isIndiaListing(record))
    .map((record) => mapListingRecord(record))
    .filter(Boolean)
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = payload?.data ?? {}
  const listingRecord = listing?._listingRecord ?? {}
  const sourceUrl = listing?.sourceUrl || buildOpportunityUrl({
    jobId: listing?.jobId || detail?.job_id,
    title: listing?.title || detail?.job_title,
  })

  return {
    ...listing,
    title: normalizeWhitespace(detail?.job_title) || listing?.title || null,
    company: COMPANY_NAME,
    department: normalizeWhitespace(detail?.business_unit) || listing?.department || null,
    team: normalizeWhitespace(detail?.parent_department || detail?.department) || listing?.team || null,
    location: formatLocations(detail?.location) || listing?.location || null,
    city: extractPrimaryCity(detail) || listing?.city || null,
    country: normalizeWhitespace(detail?.location_country) || listing?.country || COUNTRY_FILTER,
    jobId: normalizeWhitespace(detail?.job_id) || listing?.jobId || null,
    requisitionId: normalizeWhitespace(detail?.job_code) || listing?.requisitionId || null,
    sourceUrl,
    applyUrl: normalizeWhitespace(detail?.applyUrl) || listing?.applyUrl || sourceUrl || null,
    employmentType: normalizeWhitespace(detail?.employee_type) || listing?.employmentType || null,
    experienceRequired:
      buildExperienceRequired(detail?.experience_from, detail?.experience_to)
      || listing?.experienceRequired
      || null,
    minimumQualification: listing?.minimumQualification || null,
    preferredQualification: listing?.preferredQualification || null,
    requiredSkills: Array.isArray(listing?.requiredSkills) ? listing.requiredSkills : [],
    postingDate: normalizeDate(detail?.job_created_timestamp) || listing?.postingDate || null,
    closingDate: listing?.closingDate || null,
    jobDescription: htmlToText(detail?.job_decription || detail?.job_description) || listing?.jobDescription || null,
    groupCompany: normalizeWhitespace(detail?.group_company)
      || listing?.groupCompany
      || normalizeWhitespace(listingRecord?.group_company)
      || null,
    division: normalizeWhitespace(detail?.division)
      || listing?.division
      || normalizeWhitespace(listingRecord?.division)
      || null,
    remoteStatus: normalizeRemoteStatus(detail?.is_remote)
      || listing?.remoteStatus
      || normalizeRemoteStatus(listingRecord?.is_remote),
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const finalizeJob = (job, scrapedAt) => {
  const {
    _listingRecord,
    ...finalJob
  } = job

  return {
    ...finalJob,
    source: SOURCE,
    link: finalJob.sourceUrl || finalJob.applyUrl || null,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    scrapedAt,
  }
}

export const createMakeMyTripScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    fetchJson: overrideFetchJson,
    now: overrideNow,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const fetchJsonImpl = overrideFetchJson || fetchJson
    const careersHtml = await fetchTextImpl(CAREERS_URL)

    if (!hasOfficialJobsPageShellSignal(careersHtml)) {
      throw new Error('MakeMyTrip verified first-party careers shell no longer matches the known public surface')
    }

    const jobsPayload = await fetchJsonImpl(JOBS_API_URL)
    const listings = extractSearchResults(jobsPayload)
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings

    const enrichedJobs = await Promise.all(selectedListings.map(async (listing) => {
      try {
        const detailPayload = await fetchJsonImpl(buildJobDetailsApiUrl(listing.jobId))
        return extractJobDetail(detailPayload, listing)
      } catch {
        return listing
      }
    }))

    const scrapedAt = (overrideNow || now)()

    return enrichedJobs.map((job) => finalizeJob(job, scrapedAt))
  },
})

export const run = async (options = {}) => createMakeMyTripScraper().run(options)

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
