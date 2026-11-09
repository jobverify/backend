import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.stonex.com/en/about/careers/jobs/'
export const ICIMS_HOST = 'https://english-stonex.icims.com'
export const SEARCH_WRAPPER_URL = `${ICIMS_HOST}/jobs/search?ss=1`
export const SEARCH_RESULTS_URL = `${ICIMS_HOST}/jobs/search?ss=1&in_iframe=1`

const COMPANY_NAME = 'StoneX India'
const SOURCE = 'stonexindia'
export const ICIMS_USER_AGENT = 'Mozilla/5.0'
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': ICIMS_USER_AGENT,
}
const DETAIL_SECTION_STOP_LABELS = [
  'Overview',
  'Responsibilities',
  'Qualifications',
  'Options',
  'Apply for this job online',
  'Email this job to a friend',
  'Share',
  'Refer',
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

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#39;|&#x27;|&apos;/gi, '\'')
  .replace(/&#34;|&quot;/gi, '"')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|dt|dd|h[1-6]|li|p|section|span|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const unique = (values) => [...new Set(values.filter(Boolean))]

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const htmlToLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/?(?:article|div|dl|dt|dd|h[1-6]|li|main|ol|p|section|span|ul)[^>]*>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const toAbsoluteUrl = (value, base = SEARCH_RESULTS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, base).toString()
  } catch {
    return normalized
  }
}

const normalizeIndiaLocationParts = (value) => unique(
  String(value ?? '')
    .split('|')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .map((part) => part.replace(/^IN[-,\s]*/i, ''))
    .map((part) => part.replace(/^[A-Z]{2}[-,\s]+/, ''))
    .map((part) => part.replace(/,\s*India\b/i, ''))
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean),
)

const buildIndiaLocation = (value) => {
  const parts = normalizeIndiaLocationParts(value)
  const city = parts[0] || null
  return {
    city,
    location: parts.length > 0 ? `${parts.join(', ')}, India` : null,
  }
}

const isIndiaLocation = (value = '') => /^IN[-,\s]/i.test(String(value ?? ''))
  || /,\s*India\b/i.test(String(value ?? ''))

const extractJobPathInfo = (value = '') => {
  const match = String(value ?? '').match(/\/jobs\/(\d+)\/([^/?#]+)\/job/i)
  if (!match) return { jobId: null, slug: null }

  return {
    jobId: normalizeWhitespace(match[1]),
    slug: normalizeWhitespace(match[2]),
  }
}

const extractLineAfterLabel = (lines, label) => {
  const index = lines.findIndex((line) => new RegExp(`^${escapeRegex(label)}$`, 'i').test(line))
  return index >= 0 ? normalizeWhitespace(lines[index + 1]) : null
}

const extractHeaderFieldValue = (html = '', label = '') => stripTags(
  String(html ?? '').match(
    new RegExp(
      `<span[^>]*class=["'][^"']*sr-only[^"']*field-label[^"']*["'][^>]*>\\s*${escapeRegex(label)}\\s*<\\/span>\\s*<span[^>]*>\\s*([\\s\\S]*?)\\s*<\\/span>`,
      'i',
    ),
  )?.[1],
)

const extractDefinitionValue = (html = '', label = '') => stripTags(
  String(html ?? '').match(
    new RegExp(
      `<dt[^>]*>\\s*${escapeRegex(label)}\\s*<\\/dt>\\s*<dd[^>]*>\\s*<span[^>]*>\\s*([\\s\\S]*?)\\s*<\\/span>\\s*<\\/dd>`,
      'i',
    ),
  )?.[1],
)

const extractSectionLines = (lines, label, stopLabels = []) => {
  const startIndex = lines.findIndex((line) => new RegExp(`^${escapeRegex(label)}$`, 'i').test(line))
  if (startIndex === -1) return []

  const collected = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (stopLabels.some((stopLabel) => new RegExp(`^${escapeRegex(stopLabel)}$`, 'i').test(line))) {
      break
    }
    collected.push(line)
  }

  return collected
}

const extractDescriptionFields = (lines) => {
  const sanitizeSectionLines = (sectionLines) => sectionLines.filter((line) => !/^(apply|share|refer|email this job)/i.test(line))

  const overviewLines = extractSectionLines(lines, 'Overview', DETAIL_SECTION_STOP_LABELS)
  const responsibilityLines = sanitizeSectionLines(
    extractSectionLines(lines, 'Responsibilities', DETAIL_SECTION_STOP_LABELS),
  )
  const qualificationLines = sanitizeSectionLines(
    extractSectionLines(lines, 'Qualifications', DETAIL_SECTION_STOP_LABELS),
  )

  return {
    jobDescription: normalizeWhitespace([
      overviewLines.join(' '),
      responsibilityLines.join(' '),
      qualificationLines.join(' '),
    ].filter(Boolean).join(' ')),
    requiredSkills: unique(qualificationLines),
  }
}

const extractApplyUrl = (html = '', listing = {}) => {
  const applyMatch = String(html ?? '').match(
    /<a[^>]+href=["']([^"']*apply=yes[^"']*)["'][^>]*(?:class=["'][^"']*iCIMS_ApplyOnlineButton[^"']*["']|title=["']Apply for this job online["'])/i,
  ) || String(html ?? '').match(
    /<a[^>]+(?:class=["'][^"']*iCIMS_ApplyOnlineButton[^"']*["']|title=["']Apply for this job online["'])[^>]+href=["']([^"']+)["']/i,
  )

  const rawUrl = toAbsoluteUrl(applyMatch?.[1], ICIMS_HOST)
  if (!rawUrl) return listing.applyUrl || listing.sourceUrl || null

  try {
    const parsed = new URL(rawUrl)
    const canonical = new URL(parsed.pathname, parsed.origin)

    canonical.searchParams.set('apply', 'yes')
    if (parsed.searchParams.get('hashed')) {
      canonical.searchParams.set('hashed', parsed.searchParams.get('hashed'))
    }
    canonical.searchParams.set('mode', parsed.searchParams.get('mode') || 'apply')

    return canonical.toString()
  } catch {
    return rawUrl
  }
}

export const defaultFetchText = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: DEFAULT_HEADERS,
    signal: createTimeoutSignal(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const buildCareerPageUrl = () => CAREER_PAGE_URL
export const buildSearchWrapperUrl = () => SEARCH_WRAPPER_URL
export const buildSearchResultsUrl = () => SEARCH_RESULTS_URL
export const buildSearchPageUrl = (page = 0) => (
  page === 0
    ? SEARCH_RESULTS_URL
    : `${ICIMS_HOST}/jobs/search?pr=${page}&in_iframe=1&searchRelation=keyword_all`
)

export const buildDetailUrl = ({ jobId, slug }) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  const normalizedSlug = normalizeWhitespace(slug)
  return normalizedJobId && normalizedSlug
    ? `${ICIMS_HOST}/jobs/${normalizedJobId}/${normalizedSlug}/job`
    : null
}

export const buildDetailFetchUrl = ({ jobId, slug }) => {
  const detailUrl = buildDetailUrl({ jobId, slug })
  if (!detailUrl) return null

  const url = new URL(detailUrl)
  url.searchParams.set('in_iframe', '1')
  return url.toString()
}

export const hasOfficialJobsPageSignal = (html = '') => {
  const source = String(html ?? '')
  return /<title>\s*Job Listings at StoneX\s*<\/title>/i.test(source)
    && /Job Locations/i.test(source)
    && /Requisition ID/i.test(source)
    && /Position Type \(Portal Searching\)/i.test(source)
    && /\/jobs\/\d+\/[^"'?\s<>]+\/job\?in_iframe=1/i.test(source)
}

export const extractNextPageUrl = (html = '') => toAbsoluteUrl(
  decodeHtmlEntities(
    String(html ?? '').match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1],
  ),
  ICIMS_HOST,
)

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<li[^>]*class=["'][^"']*iCIMS_JobCardItem[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi,
)]
  .map((match) => match[0])
  .map((cardHtml) => {
    const linkHref = String(cardHtml).match(
      /<a[^>]+href=["']([^"']*\/jobs\/\d+\/[^"'?#\s<>]+\/job(?:\?[^"']*)?)["']/i,
    )?.[1]
    const title = stripTags(String(cardHtml).match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const rawLocation = extractHeaderFieldValue(cardHtml, 'Job Locations')
    if (!isIndiaLocation(rawLocation)) return null

    const { jobId, slug } = extractJobPathInfo(linkHref)
    if (!jobId || !slug || !title) return null

    const requisitionId = extractHeaderFieldValue(cardHtml, 'Requisition ID')
    const department = extractDefinitionValue(cardHtml, 'Category (Portal Searching)')
    const employmentType = extractDefinitionValue(cardHtml, 'Position Type (Portal Searching)')
    const jobDescription = stripTags(
      String(cardHtml).match(/<div[^>]*class=["'][^"']*col-xs-12 description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const { city, location } = buildIndiaLocation(rawLocation)

    return {
      title,
      company: COMPANY_NAME,
      department,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId,
      sourceUrl: buildDetailUrl({ jobId, slug }),
      applyUrl: buildDetailUrl({ jobId, slug }),
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html = '', listing = {}) => {
  const lines = htmlToLines(html)
  const rawLocation = extractHeaderFieldValue(html, 'Job Locations') || listing.location
  const { city, location } = buildIndiaLocation(rawLocation)
  const { jobDescription, requiredSkills } = extractDescriptionFields(lines)
  const { jobId, slug } = extractJobPathInfo(listing.sourceUrl)
  const title = stripTags(
    String(html ?? '').match(/<h1[^>]*class=["'][^"']*iCIMS_Header[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title || null

  return {
    title,
    company: listing.company || COMPANY_NAME,
    department: extractDefinitionValue(html, 'Category (Portal Searching)') || listing.department || null,
    location: location || listing.location || null,
    city: city || listing.city || null,
    country: listing.country || 'India',
    jobId: listing.jobId || jobId,
    requisitionId: extractHeaderFieldValue(html, 'Requisition ID') || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || buildDetailUrl({ jobId, slug }),
    applyUrl: extractApplyUrl(html, listing),
    employmentType: extractDefinitionValue(html, 'Position Type (Portal Searching)') || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: jobDescription || listing.jobDescription || null,
    publicExperienceChecked: true,
  }
}

export const createStoneXIndiaScraper = ({
  fetchText = defaultFetchText,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    maxJobs: overrideMaxJobs = maxJobs,
    maxPages: overrideMaxPages = Number.POSITIVE_INFINITY,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const jobs = []
    const seenJobIds = new Set()
    const seenPageUrls = new Set()
    let nextPageUrl = buildSearchResultsUrl()
    let pagesFetched = 0

    while (nextPageUrl && !seenPageUrls.has(nextPageUrl) && pagesFetched < overrideMaxPages) {
      seenPageUrls.add(nextPageUrl)
      const listingHtml = await fetchTextImpl(nextPageUrl)

      if (pagesFetched === 0 && !hasOfficialJobsPageSignal(listingHtml)) {
        throw new Error('StoneX iCIMS search page no longer matches the verified public jobs surface')
      }

      for (const listing of extractJobCards(listingHtml)) {
        if (!listing.jobId || seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const { jobId, slug } = extractJobPathInfo(listing.sourceUrl)
        let job = listing

        try {
          const detailHtml = await fetchTextImpl(buildDetailFetchUrl({ jobId, slug }))
          job = extractJobDetail(detailHtml, listing)
        } catch {
          job = listing
        }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

        if (overrideMaxJobs && jobs.length >= overrideMaxJobs) {
          return jobs
        }
      }

      nextPageUrl = extractNextPageUrl(listingHtml)
      pagesFetched += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createStoneXIndiaScraper().run(options)

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
