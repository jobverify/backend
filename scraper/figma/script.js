import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import FIGMA_CATALOG from './catalog.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FIGMA_CATALOG
export const SOURCE = FIGMA_CATALOG.source
export const COMPANY = FIGMA_CATALOG.companyName
export const CAREERS_URL = FIGMA_CATALOG.officialCareersLandingUrl
export const GREENHOUSE_JOBS_API_URL = FIGMA_CATALOG.greenhouseJobsApiUrl
export const GREENHOUSE_JOB_BASE_URL = FIGMA_CATALOG.greenhouseJobBaseUrl
export const VERIFIED_ON = FIGMA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FIGMA_CATALOG.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const buildCanonicalGreenhouseJobUrl = (jobId) =>
  `${GREENHOUSE_JOB_BASE_URL}/${jobId}?gh_jid=${jobId}`

const normalizeLocationLabel = (value) => normalizeWhitespace(value)
const INDIA_LOCATION_PATTERN = /\bindia\b/i

const getLocationSegments = (location) =>
  normalizeLocationLabel(location)
    ?.split(/\s*[•|/]\s*/g)
    .map((segment) => normalizeLocationLabel(segment))
    .filter(Boolean) || []

const deriveCity = (location) => {
  const primarySegment = getLocationSegments(location)[0] || normalizeLocationLabel(location)
  if (!primarySegment) return null

  return normalizeWhitespace(primarySegment.split(',')[0])
}

const inferCountry = (location) => {
  const segments = getLocationSegments(location)
  const lastSegment = segments.at(-1) || normalizeLocationLabel(location)
  if (!lastSegment) return null

  if (/^remote$/i.test(lastSegment)) return null

  const tokens = lastSegment.split(',').map((token) => normalizeWhitespace(token)).filter(Boolean)
  return tokens.at(-1) || null
}

const inferRemoteStatus = ({ location, description }) => {
  const haystack = [location, description].filter(Boolean).join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack) || /#LI-Remote/i.test(haystack)) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (description) => {
  const normalizedDescription = normalizeWhitespace(description)
  if (!normalizedDescription) return null

  const rangeMatch = normalizedDescription.match(/\b(\d+\s*-\s*\d+\s*years?)\s+of\s+experience\b/i)
  if (rangeMatch) return normalizeWhitespace(rangeMatch[1])?.toLowerCase()

  const plusMatch = normalizedDescription.match(/\b(\d+\+\s*years?)\s+of\b[^.]*\bexperience\b/i)
  if (plusMatch) return normalizeWhitespace(plusMatch[1])?.toLowerCase()

  return null
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Figma\s*<\/title>/i.test(page)
    && /Our vision is to make design accessible to all\./i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/www\.figma\.com\/careers\/["']/i.test(page)
    && page.includes('https://www.figma.com/careers/#job-openings')
    && extractGreenhouseJobUrls(page).length > 0
}

export const extractVisibleGreenhouseJobs = (html) => {
  const matches = String(html ?? '').matchAll(
    /<a[^>]+href=["'](https:\/\/boards\.greenhouse\.io\/figma\/jobs\/(\d+)(?:\?gh_jid=(\d+))?)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )

  const jobs = []
  const seen = new Set()

  for (const match of matches) {
    const [, rawUrl, jobId, ghJobId, rawTitle] = match
    if (!jobId) continue
    if (ghJobId && ghJobId !== jobId) continue

    const normalized = normalizeGreenhouseJobUrl(rawUrl, jobId)
    if (!normalized) continue
    if (seen.has(normalized)) continue

    seen.add(normalized)
    jobs.push({
      sourceUrl: normalized,
      title: stripTags(decodeRepeatedHtmlEntities(rawTitle)) || '',
    })
  }

  return jobs
}

export const extractGreenhouseJobUrls = (html) =>
  extractVisibleGreenhouseJobs(html).map((job) => job.sourceUrl)

const isIndiaLocation = (value) => INDIA_LOCATION_PATTERN.test(String(value ?? ''))

const extractIndiaApiJobUrls = (jobs) =>
  jobs
    .filter((job) => isIndiaLocation(job.country) || isIndiaLocation(job.location))
    .map((job) => job.sourceUrl)

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/figma/jobs/${canonicalJobId}`

    if (normalizedHost !== 'boards.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return buildCanonicalGreenhouseJobUrl(canonicalJobId)
  } catch {
    return null
  }
}

export const extractJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Figma Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs.map((job) => {
    const title = normalizeWhitespace(job?.title)
    const location = normalizeLocationLabel(job?.location?.name)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
    const companyName = normalizeWhitespace(job?.company_name)
    const jobDescription = stripTags(decodeRepeatedHtmlEntities(job?.content))

    if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
      throw new Error('Figma Greenhouse jobs API no longer maps to the verified company identity')
    }

    if (!title || !location || !sourceUrl) {
      throw new Error('Figma Greenhouse payload no longer exposes the verified public Greenhouse detail URLs')
    }

    return {
      title,
      company: COMPANY,
      location,
      city: deriveCity(location),
      country: inferCountry(location),
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: job?.id ?? null,
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: extractExperienceRequired(jobDescription),
      postingDate: normalizeDate(job?.updated_at || job?.first_published),
      jobDescription,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: inferRemoteStatus({
        location,
        description: jobDescription,
      }),
      scrapedAt,
    }
  })
}

export const createFigmaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Figma verified Figma careers page no longer matches the official first-party surface')
    }

    const visibleJobUrls = extractGreenhouseJobUrls(careersHtml)
    if (visibleJobUrls.length === 0) {
      throw new Error('Figma verified public Greenhouse job links are no longer exposed on the first-party careers page')
    }

    const jobs = extractJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    const visibleJobUrlSet = new Set(visibleJobUrls)
    const apiIndiaJobUrlSet = new Set(extractIndiaApiJobUrls(jobs))
    for (const url of apiIndiaJobUrlSet) {
      if (visibleJobUrlSet.has(url)) continue
      const job = jobs.find(job => job.sourceUrl === url)
      const doc = readNativeDocument(await fetchText(url))
      const expected = new URL(url)
      const titles = doc.nodes(node => node.tag === 'title')
      const canonical = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
      const sameRole = value => {
        try {
          const candidate = new URL(value, url)
          return ['http:', 'https:'].includes(candidate.protocol)
            && ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(candidate.hostname)
            && candidate.pathname === expected.pathname && candidate.searchParams.get('gh_jid') === expected.searchParams.get('gh_jid')
        } catch { return false }
      }
      if (titles.length !== 1 || normalizeWhitespace(decodeRepeatedHtmlEntities(titles[0].raw)) !== `Job Application for ${job.title} at Figma`
        || canonical.length !== 1 || !sameRole(canonical[0].attrs.href)
        || !doc.nodes(node => node.tag === 'h1').some(node => doc.text(node) === job.title)
        || !doc.nodes(node => node.tag === 'form' && node.attrs.id === 'application-form' && sameRole(node.attrs.action)).length) {
        throw new Error('Figma verified public Greenhouse job links for India no longer match the verified Greenhouse jobs API surface')
      }
    }

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createFigmaScraper(options).run(options)

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
