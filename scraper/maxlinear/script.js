import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.maxlinear.com/company/careers'
export const INTERNATIONAL_JOBS_URL = 'https://careersintl-maxlinear.icims.com/jobs/search?ss=1'
export const SEARCH_PAGE_URL = `${INTERNATIONAL_JOBS_URL}&in_iframe=1`

const COMPANY_NAME = 'MaxLinear'
const SOURCE = 'maxlinear'
const ICIMS_HOST = 'https://careersintl-maxlinear.icims.com'
export const ICIMS_USER_AGENT = 'Mozilla/5.0'
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': ICIMS_USER_AGENT,
}
const DETAIL_SECTION_STOP_LABELS = [
  'Responsibilities',
  'Qualifications',
  'Company Overview',
  'Options',
  'Apply for this job online',
  'Email this job to a friend',
  'Share',
  'Refer',
]

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
    .replace(/<span[^>]*class=["'][^"']*sr-only[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|dt|dd|h[1-6]|li|main|p|section|span|ul|ol)>/gi, ' ')
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

const toAbsoluteUrl = (value, base = SEARCH_PAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, base).toString()
  } catch {
    return normalized
  }
}

const normalizeUrl = (value) => {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString()
  } catch {
    return normalizeWhitespace(value)
  }
}

const isValidListingsPageUrl = (value) => {
  const normalized = normalizeUrl(value)
  if (!normalized) return false

  try {
    const url = new URL(normalized)
    return /\/jobs\/search$/i.test(url.pathname)
      && /^\d+$/.test(url.searchParams.get('pr') || '')
  } catch {
    return false
  }
}

const extractJobPathInfo = (value = '') => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return { jobId: null, slug: null }

  try {
    const parsed = new URL(absoluteUrl)
    const match = parsed.pathname.match(/\/jobs\/(\d+)\/([^/?#]+)\/job/i)
    if (!match) return { jobId: null, slug: null }

    return {
      jobId: normalizeWhitespace(match[1]),
      slug: normalizeWhitespace(match[2]),
    }
  } catch {
    return { jobId: null, slug: null }
  }
}

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      city: null,
      location: null,
    }
  }

  if (/^IND[-,\s]/i.test(normalized)) {
    const parts = normalized.split('-').map((part) => normalizeWhitespace(part)).filter(Boolean)
    const city = parts.at(-1) || null
    return {
      city,
      location: city ? `${city}, India` : null,
    }
  }

  const segments = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = segments[0] || null
  return {
    city,
    location: city ? `${city}, India` : normalized,
  }
}

const isIndiaLocation = (value) => /^IND[-,\s]/i.test(normalizeWhitespace(value) || '')

const extractField = (html, label) => {
  const escapedLabel = escapeRegex(label)
  const source = String(html ?? '')
  const definitionMatch = source.match(new RegExp(
    `<dt[^>]*>\\s*(?:<[^>]+>)*\\s*${escapedLabel}\\s*(?:<[^>]+>)*\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
    'i',
  ))
  if (definitionMatch) return stripTags(definitionMatch[1])

  const srOnlyMatch = source.match(new RegExp(
    `<span[^>]*class=["'][^"']*sr-only[^"']*["'][^>]*>\\s*${escapedLabel}\\s*<\\/span>[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>`,
    'i',
  ))
  return stripTags(srOnlyMatch?.[1])
}

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
  const responsibilities = extractSectionLines(lines, 'Responsibilities', DETAIL_SECTION_STOP_LABELS)
  const qualifications = extractSectionLines(lines, 'Qualifications', DETAIL_SECTION_STOP_LABELS)
  const companyOverview = extractSectionLines(lines, 'Company Overview', DETAIL_SECTION_STOP_LABELS)

  return {
    jobDescription: normalizeWhitespace([
      responsibilities.join(' '),
      qualifications.join(' '),
      companyOverview.join(' '),
    ].filter(Boolean).join(' ')),
    requiredSkills: unique(qualifications),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, { headers: DEFAULT_HEADERS })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.text()
}

export const buildSearchUrl = (pageIndex = 0) => (
  pageIndex > 0
    ? `${ICIMS_HOST}/jobs/search?pr=${pageIndex}&in_iframe=1`
    : SEARCH_PAGE_URL
)

export const buildDetailUrl = ({ jobId, slug }) => (
  jobId && slug ? `${ICIMS_HOST}/jobs/${jobId}/${slug}/job` : null
)

export const buildDetailFetchUrl = ({ jobId, slug }) => {
  const detailUrl = buildDetailUrl({ jobId, slug })
  return detailUrl ? `${detailUrl}?in_iframe=1` : null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const source = String(html ?? '')
  return /\bFind Your Future with MaxLinear\b/i.test(source)
    && /Browse all International Jobs/i.test(source)
    && /careersintl-maxlinear\.icims\.com\/jobs\/search/i.test(source)
    && /IND-KA-Bangalore/i.test(source)
}

export const extractInternationalJobsUrl = (html = '') => {
  const source = String(html ?? '')
  const match = source.match(/href=["'](https:\/\/careersintl-maxlinear\.icims\.com\/jobs\/search[^"']+)["'][^>]*>\s*Browse all International Jobs/i)
  return normalizeUrl(match?.[1])
}

export const hasOfficialJobsPageSignal = (html = '') => {
  const source = String(html ?? '')
  return /\bJob Listings at MaxLinear\b/i.test(source)
    && /\biCIMS_JobCardItem\b/i.test(source)
    && /IND-KA-Bangalore/i.test(source)
    && /careersintl-maxlinear\.icims\.com\/jobs\/\d+\//i.test(source)
}

export const extractJobCards = (html = '') => {
  const source = String(html ?? '')
  const cardPattern = /<li[^>]*class=["'][^"']*iCIMS_JobCardItem[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi

  return [...source.matchAll(cardPattern)]
    .map((match) => {
      const cardHtml = match[1]
      const locationValue = extractField(cardHtml, 'Location : Location')
      if (!isIndiaLocation(locationValue)) return null

      const linkMatch = cardHtml.match(/<a[^>]+href=["']([^"']*\/jobs\/\d+\/[^"'?#\s<>]+\/job(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/i)
      const { jobId, slug } = extractJobPathInfo(linkMatch?.[1])
      const title = stripTags(linkMatch?.[2])
      const { city, location } = normalizeIndiaLocation(locationValue)

      if (!jobId || !slug || !title || !location) return null

      return {
        title,
        company: COMPANY_NAME,
        department: extractField(cardHtml, 'Category'),
        location,
        city,
        country: 'India',
        jobId,
        requisitionId: extractField(cardHtml, 'ID'),
        sourceUrl: buildDetailUrl({ jobId, slug }),
        applyUrl: buildDetailUrl({ jobId, slug }),
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: stripTags(cardHtml.match(/<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]),
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const lines = htmlToLines(html)
  const { city, location } = normalizeIndiaLocation(
    extractField(html, 'Job Locations') || listing.location,
  )
  const { jobDescription, requiredSkills } = extractDescriptionFields(lines)

  const applyMatch = String(html ?? '').match(
    /<a[^>]+href=["']([^"']*apply=yes[^"']*)["'][^>]*(?:class=["'][^"']*iCIMS_ApplyOnlineButton[^"']*["']|title=["']Apply for this job online["'])/i,
  )
  const rawApplyUrl = toAbsoluteUrl(applyMatch?.[1], ICIMS_HOST)
  let applyUrl = listing.applyUrl || listing.sourceUrl || null

  if (rawApplyUrl) {
    try {
      const parsed = new URL(rawApplyUrl)
      const canonical = new URL(parsed.pathname, parsed.origin)
      canonical.searchParams.set('apply', 'yes')
      if (parsed.searchParams.get('hashed')) {
        canonical.searchParams.set('hashed', parsed.searchParams.get('hashed'))
      }
      canonical.searchParams.set('mode', parsed.searchParams.get('mode') || 'apply')
      applyUrl = canonical.toString()
    } catch {
      applyUrl = rawApplyUrl
    }
  }

  return {
    title: stripTags(
      String(html ?? '').match(/<h1[^>]*class=["'][^"']*iCIMS_Header[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    ) || listing.title || null,
    company: listing.company || COMPANY_NAME,
    department: extractField(html, 'Category') || listing.department || null,
    location: location || listing.location || null,
    city: city || listing.city || null,
    country: listing.country || 'India',
    jobId: listing.jobId || null,
    requisitionId: extractField(html, 'ID') || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    employmentType: extractField(html, 'Type') || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: jobDescription || listing.jobDescription || null,
  }
}

export const extractNextPageUrl = (html = '') => {
  const source = String(html ?? '')
  const nextMatch = source.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)
  const normalizedNextLink = normalizeUrl(toAbsoluteUrl(nextMatch?.[1], ICIMS_HOST))
  if (isValidListingsPageUrl(normalizedNextLink)) {
    return normalizedNextLink
  }

  for (const match of source.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/Next page of results/i.test(match[2])) continue

    const candidateUrl = normalizeUrl(toAbsoluteUrl(match[1], ICIMS_HOST))
    if (isValidListingsPageUrl(candidateUrl)) {
      return candidateUrl
    }
  }

  return null
}

export const createMaxLinearScraper = ({
  fetchText = defaultFetchText,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    maxJobs: overrideMaxJobs = maxJobs,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const careersHtml = await fetchTextImpl(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('MaxLinear careers page no longer matches the verified official public surface')
    }

    const extractedJobsUrl = extractInternationalJobsUrl(careersHtml)
    if (extractedJobsUrl !== INTERNATIONAL_JOBS_URL) {
      throw new Error('MaxLinear official careers handoff no longer points to the verified international iCIMS jobs board')
    }

    const jobs = []
    const seenJobIds = new Set()
    const visitedListingPages = new Set()
    let nextPageUrl = buildSearchUrl()

    while (nextPageUrl && !visitedListingPages.has(nextPageUrl)) {
      visitedListingPages.add(nextPageUrl)
      const listingHtml = await fetchTextImpl(nextPageUrl)

      if (!hasOfficialJobsPageSignal(listingHtml)) {
        throw new Error('MaxLinear iCIMS listings page no longer matches the verified public jobs surface')
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
    }

    return jobs
  },
})

export const run = async (options = {}) => createMaxLinearScraper().run(options)

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
