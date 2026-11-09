import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'zluri'
export const COMPANY = 'Zluri'
export const OFFICIAL_BRAND = 'Zluri'
export const VERIFIED_ON = '2026-08-02'
export const CAREERS_URL = 'https://www.zluri.com/careers'
export const KEKA_BOARD_URL = 'https://zluri.keka.com/careers/'
export const EXPECTED_KEKA_IDENTIFIER = 'ed2b6b25-be74-43f1-9a38-c3bf27b9146c'
export const EXPECTED_KEKA_DOMAIN = 'zluri.keka.com'
export const EXPECTED_TARGET_CONTAINER = '#khembedjobs'
export const EXPECTED_PORTAL_NAME = 'Zluri'
export const CAREER_PORTAL_INFO_URL = `${KEKA_BOARD_URL}api/organization/default/careerportalinfo`
export const ACTIVE_JOBS_URL = `${KEKA_BOARD_URL}api/embedjobs/default/active/${EXPECTED_KEKA_IDENTIFIER}`
export const DISPOSITION = 'verified-first-party-careers-page-plus-public-keka-embedjobs-api'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://www.zluri.com/careers remained the live Zluri first-party careers surface, that it still embedded the public Keka jobs widget from https://zluri.keka.com/careers/api/embedjobs/js/ed2b6b25-be74-43f1-9a38-c3bf27b9146c, and that https://zluri.keka.com/careers/api/embedjobs/default/active/ed2b6b25-be74-43f1-9a38-c3bf27b9146c still exposed India roles including Bangalore openings. This scraper validates those verified surfaces and returns India jobs only from the public Keka payload.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const targetContainerId = EXPECTED_TARGET_CONTAINER.slice(1)
  const hasCanonicalCareersLink =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.zluri\.com\/careers\/?["']/i.test(page)
    || /<link[^>]+href=["']https:\/\/www\.zluri\.com\/careers\/?["'][^>]+rel=["']canonical["']/i.test(page)

  return /<title[^>]*>\s*Careers\s*\|\s*Zluri\s*<\/title>/i.test(page)
    && hasCanonicalCareersLink
    && new RegExp(`id=["']${escapeRegex(targetContainerId)}["']`, 'i').test(page)
}

export const extractEmbeddedKekaConfig = (html = '') => {
  const page = String(html ?? '')
  const identifier = page.match(/identifier\s*:\s*['"]([^'"]+)['"]/i)?.[1] || null
  const domain = normalizeDomain(page.match(/domain\s*:\s*['"]([^'"]+)['"]/i)?.[1] || null)
  const targetContainer =
    normalizeWhitespace(page.match(/targetContainer\s*:\s*['"]([^'"]+)['"]/i)?.[1] || null)

  if (!identifier || !domain || !targetContainer) return null

  return {
    identifier,
    domain,
    targetContainer,
  }
}

const hasExpectedEmbeddedKekaScript = (html = '', identifier = EXPECTED_KEKA_IDENTIFIER) => {
  const page = String(html ?? '')
  const scriptPattern = new RegExp(
    `${escapeRegex(KEKA_BOARD_URL)}api/embedjobs/js/${escapeRegex(identifier)}`,
    'i',
  )

  return /href=["']#opportunities["']/i.test(page)
    && /id=["']opportunities["']/i.test(page)
    && scriptPattern.test(page)
}

export const hasExpectedPortalIdentity = (payload = {}) => {
  const name = normalizeWhitespace(payload?.name)
  const shortName = normalizeWhitespace(payload?.shortName)
  const domain = normalizeWhitespace(payload?.careersPortalDomain)

  return name === EXPECTED_PORTAL_NAME
    && shortName === EXPECTED_PORTAL_NAME
    && domain === EXPECTED_KEKA_DOMAIN
}

export const buildActiveJobsUrl = (identifier = EXPECTED_KEKA_IDENTIFIER) =>
  `${KEKA_BOARD_URL}api/embedjobs/default/active/${identifier}`

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const buildApplyUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}applyjob/${jobId}`
}

const isIndiaLocation = (location = {}) => {
  const countryCode = String(location.countryCode ?? '').trim().toUpperCase()
  if (countryCode === 'IN' || countryCode === 'IND') return true
  if (/^india$/i.test(String(location.countryName ?? '').trim())) return true

  return /\bindia\b/i.test(
    [location.name, location.city, location.state]
      .filter(Boolean)
      .join(' '),
  )
}

const addUniquePart = (parts, seen, value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return

  const key = normalized.toLowerCase()
  if (seen.has(key)) return

  seen.add(key)
  parts.push(normalized)
}

const buildLocationLabel = (location = {}) => {
  const parts = []
  const seen = new Set()
  const city = normalizeWhitespace(location.city)
  const name = normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)

  addUniquePart(parts, seen, city || name)

  if (state && !/^india$/i.test(state)) {
    addUniquePart(parts, seen, state)
  }

  addUniquePart(parts, seen, 'India')

  return parts.join(', ') || null
}

const buildLocation = (locations = []) => {
  const labels = []
  const seen = new Set()

  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isIndiaLocation(location)) continue

    const label = buildLocationLabel(location)
    if (!label) continue

    const key = label.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    labels.push(label)
  }

  return labels.join('; ') || null
}

const extractCity = (locations = []) => {
  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isIndiaLocation(location)) continue

    const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
    if (!city || /^india$/i.test(city) || /^remote$/i.test(city)) continue

    return city
  }

  return null
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const mapJob = (job = {}, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const indiaLocations = locations.filter(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (indiaLocations.length === 0 || !jobId || !title || !sourceUrl || !applyUrl) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: buildLocation(indiaLocations),
    city: extractCity(indiaLocations),
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description || job.excerpt),
  }
}

export const extractKekaJobs = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createZluriScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const embeddedConfig = extractEmbeddedKekaConfig(careersHtml)

    if (
      !hasOfficialCareersPageSignal(careersHtml)
      || !embeddedConfig
      || embeddedConfig.identifier !== EXPECTED_KEKA_IDENTIFIER
      || embeddedConfig.domain !== KEKA_BOARD_URL
      || embeddedConfig.targetContainer !== EXPECTED_TARGET_CONTAINER
      || !hasExpectedEmbeddedKekaScript(careersHtml, embeddedConfig.identifier)
    ) {
      throw new Error('Zluri verified official careers surface changed materially')
    }

    const portalInfo = await fetchJson(CAREER_PORTAL_INFO_URL)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('Zluri Keka portal no longer resolves to the exact company identity')
    }

    const jobs = extractKekaJobs(
      await fetchJson(buildActiveJobsUrl(embeddedConfig.identifier)),
      { domain: embeddedConfig.domain },
    )

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createZluriScraper().run(options)
