import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'carousellindia'
export const COMPANY = 'Carousell India'
export const OFFICIAL_BRAND = 'Carousell Group'
export const VERIFIED_ON = '2026-08-01'
export const CAREERS_URL = 'https://careers.smartrecruiters.com/CarousellGroup'
export const HOME_PAGE_URL = 'https://careers.carousell.com/who-we-are/'
export const HOME_PAGE_HOSTNAME = 'careers.carousell.com'
export const SMARTRECRUITERS_COMPANY_IDENTIFIER = 'CarousellGroup'
export const DISPOSITION = 'verified-public-smartrecruiters-board-plus-public-jobs-api'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://careers.smartrecruiters.com/CarousellGroup remained the accessible public Carousell Group careers board for this workbook source, that its Home Page link now resolves to https://careers.carousell.com/who-we-are/, and that the public SmartRecruiters postings API at https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100 exposed current public Carousell Group openings but no India postings in the live payload. Direct fetches to https://careers.carousell.com/ still returned a Cloudflare challenge in this environment, so this scraper validates the public SmartRecruiters board and returns India jobs only from the public SmartRecruiters API.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const SMARTRECRUITERS_JOB_HOST = 'jobs.smartrecruiters.com'
const BOARD_REQUIRED_PATTERNS = [
  /<title[^>]*>\s*Careers at Carousell Group\s*<\/title>/i,
  /\bHome Page\b/i,
  /\bCareers at Carousell\b/i,
  /\bJobs at Carousell\b/i,
  /\bBrowse by:/i,
  /\bLocation\b/i,
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

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'intern' || normalized === 'internship') return 'Internship'
  if (normalized === 'full-time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part-time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'in' || normalized === 'india') return 'India'
  return normalizeWhitespace(value)
}

const isIndiaLocation = (location = {}) => {
  const normalized = [
    location.city,
    location.region,
    location.country,
    location.fullLocation,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return /\bindia\b|\bbengaluru\b|\bbangalore\b/.test(normalized)
}

const isTrustedPostingUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'https:'
      && url.hostname === SMARTRECRUITERS_JOB_HOST
      && url.pathname.startsWith(`/${SMARTRECRUITERS_COMPANY_IDENTIFIER}/`)
  } catch {
    return false
  }
}

const isTrustedDetailRef = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'https:'
      && url.hostname === 'api.smartrecruiters.com'
      && url.pathname.startsWith(`/v1/companies/${SMARTRECRUITERS_COMPANY_IDENTIFIER}/postings/`)
  } catch {
    return false
  }
}

const extractSectionText = (sections = {}, key) => stripHtml(sections?.[key]?.text || '') || null

const extractExperienceRequired = (...values) => {
  const text = normalizeWhitespace(values.filter(Boolean).join(' ')) || ''

  let match = text.match(/\b(\d+)\s*-\s*(\d+)\s*years?\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = text.match(/\b(\d+)\+\s*years?\b/i)
  if (match) return `${match[1]}+ years`

  match = text.match(/\b(\d+)\s*years?\b/i)
  if (match) return `${match[1]} years`

  return null
}

const buildRemoteStatus = (location = {}) => {
  if (location?.remote) return 'Remote'
  if (location?.hybrid) return 'Hybrid'
  return 'On-site'
}

export const buildListingsApiUrl = ({ limit = 100, offset = 0 } = {}) =>
  `https://api.smartrecruiters.com/v1/companies/${SMARTRECRUITERS_COMPANY_IDENTIFIER}/postings?limit=${limit}&offset=${offset}`

export const extractHomePageUrl = (html = '', pageUrl = CAREERS_URL) => {
  const match = String(html).match(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Home Page\s*<\/a>/i,
  )
  if (!match) return null

  try {
    return new URL(decodeEntities(match[1]), pageUrl).toString()
  } catch {
    return null
  }
}

export const isTrustedHomePageUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'https:' && url.hostname === HOME_PAGE_HOSTNAME
  } catch {
    return false
  }
}

export const hasVerifiedBoardSignal = (html = '') => {
  const page = String(html)
  const text = normalizeText(page)
  return BOARD_REQUIRED_PATTERNS.every((pattern) => pattern.test(page) || pattern.test(text))
}

const assertVerifiedBoardSignal = (html = '') => {
  if (hasVerifiedBoardSignal(html)) return
  throw new Error('Carousell India verified public SmartRecruiters board changed materially')
}

const assertVerifiedHomePageLink = (html = '') => {
  if (isTrustedHomePageUrl(extractHomePageUrl(html))) return
  throw new Error('Carousell India verified Home Page link changed materially')
}

const assertVerifiedListingIdentity = (listing = {}) => {
  if (listing?.company?.identifier !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
    throw new Error('Carousell India SmartRecruiters company identifier changed materially')
  }

  if (normalizeWhitespace(listing?.company?.name) !== OFFICIAL_BRAND) {
    throw new Error('Carousell India SmartRecruiters company name changed materially')
  }

  if (!isTrustedDetailRef(listing?.ref)) {
    throw new Error('Carousell India SmartRecruiters detail endpoint changed materially')
  }
}

const assertVerifiedDetailIdentity = (detail = {}, listing = {}) => {
  if (String(detail?.id || '') !== String(listing?.id || '')) {
    throw new Error('Carousell India SmartRecruiters job detail changed materially')
  }

  if (detail?.company?.identifier !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
    throw new Error('Carousell India SmartRecruiters company identifier changed materially')
  }

  if (normalizeWhitespace(detail?.company?.name) !== OFFICIAL_BRAND) {
    throw new Error('Carousell India SmartRecruiters company name changed materially')
  }

  if (!isTrustedPostingUrl(detail?.postingUrl) || !isTrustedPostingUrl(detail?.applyUrl)) {
    throw new Error('Carousell India public SmartRecruiters apply surface changed materially')
  }

  if (!isIndiaLocation(detail?.location || listing?.location)) {
    throw new Error('Carousell India SmartRecruiters detail no longer matches the India filter')
  }
}

export const extractIndiaListings = (payload = {}) => {
  if (!Array.isArray(payload?.content)) {
    throw new Error('Carousell India SmartRecruiters listings payload changed materially')
  }

  return payload.content
    .filter((listing) => {
      assertVerifiedListingIdentity(listing)
      return isIndiaLocation(listing.location)
    })
    .map((listing) => ({
      id: listing.id,
      name: normalizeWhitespace(listing.name),
      refNumber: normalizeWhitespace(listing.refNumber),
      releasedDate: normalizeWhitespace(listing.releasedDate),
      location: listing.location || {},
      department: listing.department || {},
      typeOfEmployment: listing.typeOfEmployment || {},
      ref: listing.ref,
    }))
}

export const mapListingDetailToJob = (listing = {}, detail = {}, scrapedAt = new Date().toISOString()) => {
  assertVerifiedDetailIdentity(detail, listing)

  const sections = detail?.jobAd?.sections || {}
  const jobDescription = extractSectionText(sections, 'jobDescription')
  const minimumQualification = extractSectionText(sections, 'qualifications')
  const preferredQualification = extractSectionText(sections, 'additionalInformation')
  const fullLocation =
    normalizeWhitespace(detail?.location?.fullLocation)
    || normalizeWhitespace(listing?.location?.fullLocation)
    || null

  return {
    title: normalizeWhitespace(detail?.name) || normalizeWhitespace(listing?.name),
    company: COMPANY,
    department: normalizeWhitespace(detail?.department?.label || listing?.department?.label),
    location: fullLocation,
    city:
      normalizeWhitespace(detail?.location?.city)
      || normalizeWhitespace(listing?.location?.city),
    country:
      normalizeCountry(detail?.location?.country)
      || normalizeCountry(listing?.location?.country),
    link: detail?.postingUrl || detail?.applyUrl,
    applyUrl: detail?.applyUrl || detail?.postingUrl,
    sourceUrl: detail?.postingUrl || detail?.applyUrl,
    source: SOURCE,
    jobId: String(detail?.id || listing?.id || ''),
    requisitionId:
      normalizeWhitespace(detail?.refNumber)
      || normalizeWhitespace(listing?.refNumber)
      || String(detail?.id || listing?.id || ''),
    employmentType:
      normalizeEmploymentType(detail?.typeOfEmployment?.label)
      || normalizeEmploymentType(listing?.typeOfEmployment?.label),
    experienceRequired: extractExperienceRequired(
      jobDescription,
      minimumQualification,
      preferredQualification,
    ),
    experienceLevel: normalizeWhitespace(detail?.experienceLevel?.label) || null,
    postingDate:
      normalizeWhitespace(detail?.releasedDate)
      || normalizeWhitespace(listing?.releasedDate)
      || null,
    closingDate: null,
    jobDescription,
    minimumQualification,
    preferredQualification,
    requiredSkills: [],
    remoteStatus: buildRemoteStatus(detail?.location || listing?.location || {}),
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

const loadAllListings = async (fetchJson) => {
  const listings = []
  const limit = 100
  let offset = 0
  let totalFound = null

  while (totalFound == null || offset < totalFound) {
    const payload = await fetchJson(buildListingsApiUrl({ limit, offset }), { method: 'GET' })
    const pageIndiaListings = extractIndiaListings(payload)
    listings.push(...pageIndiaListings)

    const pageSize = Array.isArray(payload?.content) ? payload.content.length : 0
    totalFound = Number.isInteger(payload?.totalFound) ? payload.totalFound : pageSize

    if (pageSize === 0 || offset + pageSize >= totalFound) break
    offset += pageSize
  }

  return listings
}

export const createCarousellIndiaScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const boardHtml = await fetchText(CAREERS_URL)
    assertVerifiedBoardSignal(boardHtml)
    assertVerifiedHomePageLink(boardHtml)

    const indiaListings = await loadAllListings(fetchJson)
    const selectedListings = Number.isInteger(maxJobs)
      ? indiaListings.slice(0, maxJobs)
      : indiaListings
    const scrapedAt = now()
    const jobs = []

    for (const listing of selectedListings) {
      const detail = await fetchJson(listing.ref, { method: 'GET' })
      jobs.push(mapListingDetailToJob(listing, detail, scrapedAt))
    }

    return jobs
  },
})

export const run = async (options = {}) => createCarousellIndiaScraper(options).run(options)
