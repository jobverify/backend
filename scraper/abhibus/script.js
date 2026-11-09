import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'abhibus'
export const COMPANY = 'AbhiBus'
export const VERIFIED_AT = '2026-07-19'
export const HOMEPAGE_URL = 'https://www.abhibus.com/'
export const CAREERS_URL = 'https://www.abhibus.com/careers/'
export const SMARTRECRUITERS_COMPANY_IDENTIFIER = 'AbhiBus'
export const SMARTRECRUITERS_LISTING_API_URL =
  'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings'
export const SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE =
  'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings/{{jobId}}'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PAGE_SIZE = 100

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/[\u2013\u2014\u2212\uff0d]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeUrl = (value) => {
  try {
    return new URL(decodeHtml(value)).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || ''

const buildListingApiUrl = (offset = 0) => {
  const url = new URL(SMARTRECRUITERS_LISTING_API_URL)
  url.searchParams.set('limit', String(PAGE_SIZE))
  url.searchParams.set('country', 'in')
  url.searchParams.set('offset', String(offset))
  return url.toString()
}

const buildDetailApiUrl = (jobId) =>
  SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE.replace('{{jobId}}', encodeURIComponent(String(jobId)))

const buildPostingUrl = (posting = {}) => {
  const jobId = normalizeWhitespace(posting.id)
  const title = normalizeWhitespace(posting.name)
  if (!jobId || !title) return null
  return `https://jobs.smartrecruiters.com/${SMARTRECRUITERS_COMPANY_IDENTIFIER}/${jobId}-${slugify(title)}`
}

const sectionText = (detail = {}, key) => stripTags(detail.jobAd?.sections?.[key]?.text)

const resolveLocation = (posting = {}) => {
  const location = posting.location || {}
  return normalizeWhitespace(location.fullLocation)
    || [location.city, location.region, 'India'].map(normalizeWhitespace).filter(Boolean).join(', ')
    || null
}

const isIndiaPosting = (posting = {}) => {
  const country = normalizeWhitespace(posting.location?.country)
  if (country?.toLowerCase() === 'in') return true

  const location = resolveLocation(posting)
  return /\bIndia\b/i.test(location || '')
}

const isPublicPosting = (posting = {}) =>
  normalizeWhitespace(posting.visibility)?.toUpperCase() === 'PUBLIC'

export const hasVerifiedZeroListingsState = (payload = {}) =>
  Number(payload?.totalFound ?? 0) === 0
  && Array.isArray(payload?.content)
  && payload.content.length === 0

const getRemoteStatus = (posting = {}) => {
  if (posting.location?.remote) return 'Remote'
  if (posting.location?.hybrid) return 'Hybrid'
  return 'On-site'
}

const mapSmartRecruitersJob = (posting = {}, detail = {}, scrapedAt = new Date().toISOString()) => {
  const merged = { ...posting, ...detail }
  const title = normalizeWhitespace(merged.name)
  const jobId = normalizeWhitespace(merged.id)
  const location = resolveLocation(merged)
  const sourceUrl = normalizeUrl(merged.postingUrl) || buildPostingUrl(merged)
  const applyUrl = normalizeUrl(merged.applyUrl) || (sourceUrl ? `${sourceUrl}?oga=true` : null)

  if (!title || !jobId || !sourceUrl || !location) {
    throw new Error('AbhiBus SmartRecruiters payload no longer exposes the verified public job fields')
  }

  return {
    title,
    company: COMPANY,
    department:
      normalizeWhitespace(merged.function?.label)
      || normalizeWhitespace(merged.department?.label),
    location,
    city: normalizeWhitespace(merged.location?.city) || normalizeWhitespace(location.split(',')[0]),
    country: 'India',
    link: sourceUrl,
    applyUrl,
    sourceUrl,
    source: SOURCE,
    jobId,
    requisitionId: normalizeWhitespace(merged.refNumber),
    employmentType: normalizeWhitespace(merged.typeOfEmployment?.label),
    experienceRequired: null,
    experienceLevel: normalizeWhitespace(merged.experienceLevel?.label),
    minimumQualification: sectionText(detail, 'qualifications'),
    preferredQualification: sectionText(detail, 'additionalInformation'),
    requiredSkills: [],
    postingDate: normalizeWhitespace(merged.releasedDate),
    closingDate: null,
    jobDescription: sectionText(detail, 'jobDescription') || 'Apply via the AbhiBus careers page.',
    remoteStatus: getRemoteStatus(merged),
    scrapedAt,
  }
}

export const extractSmartRecruitersCompanyIdentifier = (value) => {
  try {
    const url = new URL(value)
    const segments = url.pathname.split('/').filter(Boolean)

    if (url.hostname.toLowerCase() === 'api.smartrecruiters.com') {
      const companiesIndex = segments.findIndex((segment) => segment.toLowerCase() === 'companies')
      return companiesIndex >= 0 ? segments[companiesIndex + 1] || null : null
    }

    if (url.hostname.toLowerCase() === 'jobs.smartrecruiters.com') {
      return segments[0] || null
    }

    return null
  } catch {
    return null
  }
}

export const extractSmartRecruitersListingApiUrl = (html) => {
  for (const match of String(html ?? '').matchAll(
    /https:\/\/api\.smartrecruiters\.com\/v1\/companies\/[^/"'`\s]+\/postings(?:\?[^"'`\s<)]*)?/gi,
  )) {
    const normalized = normalizeUrl(match[0])
    if (!normalized) continue

    const companyIdentifier = extractSmartRecruitersCompanyIdentifier(normalized)
    if (!companyIdentifier) continue

    const url = new URL(normalized)
    url.search = ''
    return url.toString().replace(/\/$/, '')
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''

  return /<title>\s*ixigo\s*&(?:amp;)?\s*AbhiBus Careers/i.test(page)
    && normalized.includes('Open Positions')
    && normalized.includes('Find your next role.')
    && normalized.includes('Live AbhiBus openings from SmartRecruiters')
    && normalized.includes('official hiring portal')
    && /<div[^>]+class=["'][^"']*\bjobs-grid\b/i.test(page)
    && /api\.smartrecruiters\.com\/v1\/companies\/[^/"'`\s]+\/postings/i.test(page)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      Referer: CAREERS_URL,
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createAbhiBusScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('AbhiBus verified first-party careers page no longer matches the trusted public jobs surface')
    }

    const listingApiUrl = extractSmartRecruitersListingApiUrl(html)
    if (listingApiUrl !== SMARTRECRUITERS_LISTING_API_URL) {
      throw new Error('AbhiBus verified SmartRecruiters API handoff changed on the official careers page')
    }

    const jobs = []
    let offset = 0

    while (!Number.isFinite(maxJobs) || jobs.length < maxJobs) {
      const payload = await fetchJson(buildListingApiUrl(offset))
      const postings = Array.isArray(payload?.content) ? payload.content : null

      if (!postings) {
        throw new Error('AbhiBus SmartRecruiters listings payload no longer returns content[]')
      }

      if (offset === 0 && hasVerifiedZeroListingsState(payload)) {
        return []
      }

      for (const posting of postings) {
        const companyIdentifier = normalizeWhitespace(posting.company?.identifier)
        if (companyIdentifier && companyIdentifier !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
          throw new Error('AbhiBus SmartRecruiters payload company identifier changed')
        }

        if (!isPublicPosting(posting) || !isIndiaPosting(posting)) continue

        const detailUrl = normalizeUrl(posting.ref) || buildDetailApiUrl(posting.id)
        const detail = await fetchJson(detailUrl)
        jobs.push(mapSmartRecruitersJob(posting, detail, now()))

        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
      }

      const totalFound = Number(payload?.totalFound)
      offset += postings.length
      if (!postings.length || !Number.isFinite(totalFound) || offset >= totalFound) break
    }

    if (jobs.length === 0) {
      throw new Error('AbhiBus SmartRecruiters API returned no public India jobs')
    }

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createAbhiBusScraper(options).run(options)

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
