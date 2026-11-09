import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE = 'epassiindia'
export const COMPANY = 'Epassi India'
export const OFFICIAL_BRAND = 'Epassi'
export const VERIFIED_ON = '2026-10-09'
export const CAREERS_URL = 'https://www.epassi.com/careers'
export const JOBYLON_COMPANY_ID = 2253
export const JOBYLON_VERSION = 'v1'
export const JOBYLON_PAGE_SIZE = 10
export const JOBYLON_WIDGET_TARGET = 'jobylon-jobs-widget'
export const JOBYLON_EMBED_URL =
  `https://cdn.jobylon.com/jobs/companies/${JOBYLON_COMPANY_ID}/embed/${JOBYLON_VERSION}/`
  + `?target=${JOBYLON_WIDGET_TARGET}&page_size=${JOBYLON_PAGE_SIZE}`
export const JOBYLON_DETAIL_HOST = 'emp.jobylon.com'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-public-jobylon-embed-and-detail-pages'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on 2026-10-09 that https://www.epassi.com/careers remains the first-party careers page, with Jobylon company id 2253 exposing 17 distinct Epassi vacancies across two complete embedded pages. All 17 public Jobylon details were fetched and their requisition URLs, titles, employer identities and country coverage verified; no public roles exposed India as a location. Sixteen roles publish European addresses. Requisition 389049 has an unpublished summary location and blank structured address, while its full role description explicitly states a full-time, Europe-based role. Ambiguous country coverage, identity drift, missing embedded pages and required-detail failures remain errors; collection limits remain incomplete."

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

// Country declarations accepted by the verified India/European Jobylon contract.
const VERIFIED_COUNTRIES = new Set([
  'in', 'ind', 'india', 'fi', 'fin', 'finland', 'de', 'deu', 'germany',
  'se', 'swe', 'sweden', 'pl', 'pol', 'poland', 'nl', 'nld', 'netherlands', 'niederlande',
  'gb', 'gbr', 'uk', 'united kingdom', 'es', 'esp', 'spain', 'it', 'ita', 'italy',
])

const EXTERNAL_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /workdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /freshteam\.com/i,
  /teamtailor\.com/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const normalizeComparableUrl = (value = '') => {
  try {
    const url = new URL(String(value))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value || '').replace(/\/$/, '')
  }
}

const normalizeJobylonReadMoreUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    if (url.protocol !== 'https:') return null
    if (url.hostname !== JOBYLON_DETAIL_HOST) return null
    if (!/^\/jobs\/\d+-[^/]+\/?$/i.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const normalizeJobylonApplyUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    if (url.protocol !== 'https:') return null
    if (url.hostname !== JOBYLON_DETAIL_HOST) return null
    if (!/^\/applications\/jobs\/\d+\/create\/?$/i.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''
    try {
      urls.push(new URL(decodeEntities(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  for (const match of String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (/\bJobPosting\b/i.test(match[1])) return true
  }

  return false
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full-time' || normalized === 'full time') {
    return 'Full-time'
  }
  if (normalized === 'part_time' || normalized === 'part-time' || normalized === 'part time') {
    return 'Part-time'
  }
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^not applicable$/i.test(normalized)) return null
  return normalized
}

const toPostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? normalized : date.toISOString()
}

const extractCountryValue = (value) => {
  if (typeof value === 'string') return normalizeWhitespace(value)
  if (value && typeof value === 'object') {
    return normalizeWhitespace(value.name || value.code || value.identifier)
  }
  return null
}

const formatLocation = ({ streetAddress, city, region, country }) => {
  const parts = [city, region, country].filter(Boolean)
  if (parts.length > 0) return parts.join(', ')
  return streetAddress || null
}

const normalizeAddress = (value = {}) => {
  const address = value?.address && typeof value.address === 'object' ? value.address : value
  const streetAddress = normalizeWhitespace(address?.streetAddress)
  const city = normalizeWhitespace(address?.addressLocality)
  const region = normalizeWhitespace(address?.addressRegion)
  const rawCountry = extractCountryValue(address?.addressCountry)
  const country =
    rawCountry && /^(?:in|ind|india)$/i.test(rawCountry)
      ? 'India'
      : rawCountry

  return {
    streetAddress,
    city,
    region,
    country,
    location: formatLocation({ streetAddress, city, region, country }),
  }
}

const isIndiaAddress = (value = {}) => {
  const address = normalizeAddress(value)
  if (address.country === 'India') return true

  return /\bindia\b/i.test(
    [address.streetAddress, address.city, address.region, address.country].filter(Boolean).join(' '),
  )
}

const findJobPostingObject = (value) => {
  const queue = [value]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue

    const type = current['@type']
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) {
      return current
    }

    for (const nestedValue of Object.values(current)) {
      if (nestedValue && typeof nestedValue === 'object') queue.push(nestedValue)
    }
  }

  return null
}

const parseJobPostingJsonLd = (html = '') => {
  for (const match of String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1])
      const jobPosting = findJobPostingObject(parsed)
      if (jobPosting) return jobPosting
    } catch {
      // Ignore malformed JSON-LD blocks until the trusted JobPosting payload is found.
    }
  }

  return null
}

export const extractJobylonConfig = (html = '') => {
  const page = String(html)
  const companyIdMatch = page.match(/\bjbl_company_id\s*=\s*(\d+)\s*;/i)
  const versionMatch = page.match(/\bjbl_version\s*=\s*['"]([^'"]+)['"]\s*;/i)
  const pageSizeMatch = page.match(/\bjbl_page_size\s*=\s*(\d+)\s*;/i)

  return {
    companyId: companyIdMatch ? Number(companyIdMatch[1]) : null,
    version: versionMatch ? normalizeWhitespace(versionMatch[1]) : null,
    pageSize: pageSizeMatch ? Number(pageSizeMatch[1]) : null,
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html)
  const text = normalizeText(page)
  const config = extractJobylonConfig(page)

  return /<title[^>]*>\s*Epassi\s*\|\s*Careers\s*\|\s*Epassi\s*<\/title>/i.test(page)
    && /Come grow with us\./i.test(text)
    && /Your journey towards a fulfilling career in wellbeing starts here\./i.test(text)
    && /id=["']vacancies["']/i.test(page)
    && /\bOur vacancies\./i.test(text)
    && /jobylon-jobs-widget/i.test(page)
    && /(?:https:)?\/\/embed-css\.jobylon\.com\/v1\/epassi-custom\.css/i.test(page)
    && /https:\/\/cdn\.jobylon\.com\/embedder\.js/i.test(page)
    && config.companyId === JOBYLON_COMPANY_ID
    && config.version === JOBYLON_VERSION
    && config.pageSize === JOBYLON_PAGE_SIZE
}

const assertNoUnexpectedAlternativePublicJobsSurface = (html = '', pageUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error('Epassi India verified careers page now exposes JobPosting markup')
  }

  const unexpectedAtsUrl = extractLinkedUrls(html, pageUrl).find((url) =>
    EXTERNAL_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )

  if (unexpectedAtsUrl) {
    throw new Error(
      `Epassi India verified careers page now exposes an unexpected external ATS handoff via ${unexpectedAtsUrl.toString()}`,
    )
  }
}

export const hasVerifiedJobylonEmbedSignal = (embedJs = '') => {
  const script = String(embedJs)

  return script.includes(`var widget_selector = '#${JOBYLON_WIDGET_TARGET}'`)
    && script.includes('jobylon-job-list')
    && script.includes('jobylon-pagination')
    && script.includes('Powered by <a href="//www.jobylon.com"')
    && (
      script.includes('jobylon-job ')
      || script.includes('jobylon-no-jobs')
    )
}

const decodeUnicodeEscapes = (value = '') =>
  String(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const cleanEmbedText = (value = '') =>
  normalizeWhitespace(
    decodeUnicodeEscapes(value)
      .replace(/<[^>]+>/g, ' '),
  )

export const extractJobylonListings = (embedJs = '') => {
  const script = String(embedJs)

  if (!hasVerifiedJobylonEmbedSignal(script)) {
    throw new Error('Epassi India verified public Jobylon embed changed materially')
  }

  const blocks = script.split('<div id="jobylon-job-').slice(1)
  if (blocks.length === 0) {
    if (!/<div class="jobylon-no-jobs"/i.test(script)) throw new Error('Epassi India public Jobylon embed lacks explicit inventory evidence')
    return []
  }

  const embeddedPages = [...script.matchAll(/class="jobylon-job-list-page[^"\r\n]*\bjs-jobylon-page-(\d+)\b[^"\r\n]*"/g)].map(match => Number(match[1]))
  const paginationPages = [...script.matchAll(/<a\b[^>]*class="js-jobylon-show-page"[^>]*data-page="(\d+)"/g)].map(match => Number(match[1]))
  if (embeddedPages.length === 0 || embeddedPages.some((page, index) => page !== index + 1)
    || paginationPages.length !== embeddedPages.length
    || paginationPages.some((page, index) => page !== embeddedPages[index])) {
    throw new Error('Epassi India public Jobylon embed pagination no longer accounts for every embedded page')
  }
  const seenIds = new Set()

  return blocks.map((block) => {
    const jobId = normalizeWhitespace(block.split('"', 1)[0])
    const title = cleanEmbedText(
      (block.match(/<div class="jobylon-job-title[^"]*">([\s\S]*?)<\/div>/i) || [])[1],
    )
    const location = cleanEmbedText(
      (block.match(/<li class="jobylon-location">[\s\S]*?<strong>Location:<\/strong>\s*([\s\S]*?)<\/li>/i) || [])[1],
    )
    const department = cleanEmbedText(
      (block.match(/<li class="jobylon-function">[\s\S]*?<strong>Function:<\/strong>\s*([\s\S]*?)<\/li>/i) || [])[1],
    )
    const experience = cleanEmbedText(
      (block.match(/<li class="jobylon-experience">[\s\S]*?<strong>Experience:<\/strong>\s*([\s\S]*?)<\/li>/i) || [])[1],
    )
    const sourceUrl = normalizeJobylonReadMoreUrl(
      (block.match(/<a class="jobylon-apply-btn" href="([^"]+)"/i) || [])[1],
    )
    const applyUrl = normalizeJobylonApplyUrl(
      (block.match(/<a class="jobylon-apply-btn jobylon-actual-apply-btn" href="([^"]+)"/i) || [])[1],
    )

    if (!jobId || !/^\d+$/.test(jobId) || !title || !sourceUrl || !applyUrl
      || sourceUrl.match(/\/jobs\/(\d+)-/)?.[1] !== jobId
      || applyUrl.match(/\/applications\/jobs\/(\d+)\/create/)?.[1] !== jobId
      || seenIds.has(jobId)) {
      throw new Error('Epassi India public Jobylon embed no longer exposes the verified listing fields')
    }

    seenIds.add(jobId)
    return {
      jobId,
      requisitionId: jobId,
      title,
      location,
      department,
      experience,
      sourceUrl,
      applyUrl,
    }
  })
}

export const extractIndiaJobFromDetail = (listing = {}, detailHtml = '') => {
  const jobPosting = parseJobPostingJsonLd(detailHtml)
  if (!jobPosting) {
    throw new Error('Epassi India public Jobylon detail page no longer exposes a JobPosting payload')
  }

  const detailUrl = String(detailHtml).match(/<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1]
  if (!detailUrl || normalizeComparableUrl(decodeEntities(detailUrl)) !== normalizeComparableUrl(listing.sourceUrl)) {
    throw new Error('Epassi India public Jobylon detail identity no longer matches the expected requisition')
  }

  const detailTitle = normalizeWhitespace(jobPosting.title)
  if (!detailTitle || detailTitle !== normalizeWhitespace(listing.title)) {
    throw new Error('Epassi India public Jobylon detail page no longer matches the expected title')
  }

  const organizationName = normalizeWhitespace(jobPosting?.hiringOrganization?.name)
  if (organizationName !== OFFICIAL_BRAND) {
    throw new Error('Epassi India public Jobylon detail page no longer matches the expected company identity')
  }

  const rawLocations = Array.isArray(jobPosting?.jobLocation)
    ? jobPosting.jobLocation
    : (jobPosting?.jobLocation ? [jobPosting.jobLocation] : [])
  for (const location of rawLocations) {
    const rawAddress = location?.address && typeof location.address === 'object' ? location.address : location
    const declaration = rawAddress?.addressCountry
    const address = normalizeAddress(location)
    if ((declaration != null && declaration !== '' && !extractCountryValue(declaration))
      || (address.country && !VERIFIED_COUNTRIES.has(address.country.toLowerCase()))) {
      throw new Error('Epassi India public Jobylon detail has unrecognized declared country coverage')
    }
    if (address.country && address.country !== 'India' && isIndiaAddress(location)) {
      throw new Error('Epassi India public Jobylon detail country declaration contradicts its India address')
    }
  }
  const indiaLocations = rawLocations
    .filter((location) => isIndiaAddress(location))
    .map((location) => normalizeAddress(location))
    .filter((location) => location.location)

  if (indiaLocations.length === 0) {
    const addresses = rawLocations.map(location => normalizeAddress(location))
    const blankAddresses = addresses.length === 0 || addresses.every(address => !address.location)
    const explicitEuropePlacement = /\bThis is a full-time, Europe-based role\./i.test(stripHtml(jobPosting.description) || '')
    const nonIndiaAddress = address => Boolean(address.country && address.country !== 'India'
      && VERIFIED_COUNTRIES.has(address.country.toLowerCase()))
      || /\b(?:Finland|Germany|Sweden|Poland|Netherlands|Niederlande|United Kingdom|UK|Spain|Italy)\b/i.test(
        [address.streetAddress, address.city, address.region].filter(Boolean).join(' '),
      )
    if ((blankAddresses && explicitEuropePlacement)
      || (!blankAddresses && addresses.every(nonIndiaAddress))) return null
    throw new Error('Epassi India public Jobylon detail lacks trustworthy country location coverage')
  }

  return {
    title: detailTitle || normalizeWhitespace(listing.title),
    company: COMPANY,
    department: normalizeWhitespace(listing.department),
    location: indiaLocations.map((location) => location.location).join(' / '),
    city: indiaLocations[0].city || null,
    country: 'India',
    jobId: normalizeWhitespace(listing.jobId),
    requisitionId: normalizeWhitespace(listing.requisitionId) || normalizeWhitespace(listing.jobId),
    sourceUrl: normalizeComparableUrl(listing.sourceUrl),
    applyUrl: normalizeComparableUrl(listing.applyUrl),
    employmentType: normalizeEmploymentType(jobPosting.employmentType),
    experienceRequired: normalizeExperience(listing.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: toPostingDate(jobPosting.datePosted),
    closingDate: null,
    jobDescription: stripHtml(jobPosting.description),
    remoteStatus: null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 20000,
})

export const createEpassiIndiaScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Epassi India verified official careers page changed materially')
    }

    assertNoUnexpectedAlternativePublicJobsSurface(careersHtml, CAREERS_URL)

    const embedJs = await fetchText(JOBYLON_EMBED_URL)
    const listings = extractJobylonListings(embedJs)
    const selectedListings = Number.isInteger(maxJobs)
      ? listings.slice(0, maxJobs)
      : listings

    const jobs = []
    const scrapedAt = now()

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const job = extractIndiaJobFromDetail(listing, detailHtml)

      if (!job) continue

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      })
    }

    const limited = selectedListings.length < listings.length
    const result = limited ? jobs.map(job => ({ ...job, sourceListingComplete: false })) : jobs
    const pagesFetched = Math.max(1, [...embedJs.matchAll(/class="jobylon-job-list-page[^"\r\n]*\bjs-jobylon-page-(\d+)\b[^"\r\n]*"/g)].length)
    return attachInventoryEvidence(result, {
      status: limited ? 'coverage-gap' : 'complete-inventory',
      surface: CAREERS_URL, firstParty: true, listingComplete: !limited,
      pagesFetched, reportedTotal: listings.length, indiaFacetCount: jobs.length,
      verifiedAt: scrapedAt,
      reason: limited ? 'configured-jobylon-listing-limit'
        : 'all-embedded-pages-and-detail-identities-employers-countries-verified',
    })
  },
})

export const run = async (options = {}) => createEpassiIndiaScraper(options).run(options)
