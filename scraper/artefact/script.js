import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'

import { ARTEFACT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ARTEFACT_CATALOG.source
export const COMPANY = ARTEFACT_CATALOG.companyName
export const HOMEPAGE_URL = ARTEFACT_CATALOG.homepageUrl
export const CAREERS_URL = ARTEFACT_CATALOG.companyCareerPage
export const JOBS_URL = 'https://www.artefact.com/careers/explore-our-jobs/'
export const GREENHOUSE_BOARD_URL = ARTEFACT_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = ARTEFACT_CATALOG.greenhouseJobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PAGE_FETCH_CONCURRENCY = 4
const DETAIL_FETCH_CONCURRENCY = 4

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#x27;/gi, "'")
  .replace(/&ndash;/gi, '-')
  .replace(/&mdash;/gi, '-')
  .replace(/&#8211;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|article)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const textIncludesAll = (text, fragments) => fragments.every((fragment) => text.includes(fragment))

const inferCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return firstToken
}

const extractMetadataValue = (metadata, name) => {
  if (!Array.isArray(metadata)) return null

  const match = metadata.find((entry) => normalizeText(entry?.name)?.toLowerCase() === normalizeText(name)?.toLowerCase())
  return normalizeText(match?.value)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Artefact is a global data and AI consulting company\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/www\.artefact\.com\/careers\/(?:explore-our-jobs\/)?["']/i.test(rawHtml)
    && /Explore our Jobs/i.test(normalized)
    && /Working at Artefact/i.test(normalized)
    && (/Artefact is a global leader in data and AI consulting services/i.test(normalized)
      || /Artefact is a global data and AI consulting company/i.test(normalized))
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Careers: Explore our job offers - Artefact\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.artefact\.com\/careers\/(?:explore-our-jobs\/)?["']/i.test(rawHtml)
    && /Explore our jobs/i.test(normalized)
    && /Filter by:/i.test(normalized)
    && (/https:\/\/www\.artefact\.com\/careers\/explore-our-jobs\/page\/\d+\//i.test(rawHtml)
      || extractListingCards(rawHtml).length > 0)
    && /https:\/\/www\.artefact\.com\/job\//i.test(rawHtml)
    && /https:\/\/job-boards\.greenhouse\.io\/artefact\/jobs\/\d+/i.test(rawHtml)
}

const hasOfficialCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  return /<title>\s*Careers - Artefact\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/www\.artefact\.com\/careers\/explore-our-jobs\/["']/i.test(rawHtml)
    && /href=["']https:\/\/www\.artefact\.com\/careers\/working-at-artefact\/["']/i.test(rawHtml)
}

export const hasBunkerWebBotDetectionSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Bot Detection\s*<\/title>/i.test(rawHtml)
    && textIncludesAll(normalized, [
      'Please wait while we check if you are a Human',
      'BunkerWeb',
    ])
}

export const hasOfficialGreenhouseBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Jobs at Artefact\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/job-boards\.greenhouse\.io\/artefact\/?["']/i.test(rawHtml)
    && /Artefact/i.test(normalized)
}

export const extractPaginationUrls = (html) => unique(
  [...String(html ?? '').matchAll(/href=["'](https:\/\/www\.artefact\.com\/careers\/explore-our-jobs\/page\/\d+\/)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1])),
)

export const extractListingCards = (html) => {
  const page = String(html ?? '')
  const seen = new Set()
  const listingPattern = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*View Job\s*<\/a>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/gi

  return [...page.matchAll(listingPattern)]
    .map((match) => ({
      title: stripTags(match[1]),
      department: stripTags(match[2]),
      location: stripTags(match[3]),
      sourceUrl: toAbsoluteUrl(match[4], CAREERS_URL),
      applyUrl: toAbsoluteUrl(match[5], CAREERS_URL),
    }))
    .filter((listing) => listing.title && listing.department && listing.location && listing.sourceUrl && listing.applyUrl)
    .filter((listing) => {
      const key = `${listing.sourceUrl}|${listing.applyUrl}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const filterIndiaListings = (listings = []) =>
  listings.filter((listing) => /\bindia\b/i.test(String(listing.location ?? '')))

export const hasOfficialDetailPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*[^<]+ - Artefact\s*<\/title>/i.test(rawHtml)
    && /APPLY NOW/i.test(normalized)
    && /https:\/\/job-boards\.greenhouse\.io\/artefact\/jobs\/\d+/i.test(rawHtml)
}

export const extractApplyUrlFromDetailPage = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/job-boards\.greenhouse\.io\/artefact\/jobs\/\d+)["'][^>]*>\s*APPLY NOW/i)
  return match ? match[1] : null
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeText(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (hostname !== 'job-boards.greenhouse.io') return null
    if (pathname !== `/artefact/jobs/${canonicalJobId}`) return null

    return `https://job-boards.greenhouse.io/artefact/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

const extractContentLines = (html) => {
  const lines = decodeHtmlEntities(String(html ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|article|section|main|body|html|head)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)

  const applyIndex = lines.findIndex((line) => /^APPLY NOW$/i.test(line))
  return applyIndex >= 0 ? lines.slice(0, applyIndex) : lines
}

const buildJobDescription = (lines = [], title) => {
  const titleIndex = lines.findIndex((line) => line === title)
  const descriptionStartIndex = titleIndex >= 0 ? titleIndex + 1 : 0
  return lines.slice(descriptionStartIndex).join('\n') || null
}

const extractExperienceRequired = (lines = []) =>
  lines.find((line) => /\b\d+\+?\s*years? of experience\b/i.test(line)) || null

const extractMinimumQualification = (lines = []) =>
  lines.find((line) => /Bachelor.?s|Master.?s degree/i.test(line)) || null

const extractRequiredSkills = (lines = []) => {
  const excludedPatterns = [
    /^Job Description/i,
    /^Artefact is /i,
    /^\d+\.\s*What /i,
    /^Technical Expertise:?$/i,
    /^Attitude & Soft Skills:?$/i,
    /^Key Responsibilities$/i,
    /^Required Qualifications$/i,
    /^Education:?$/i,
    /^Experience:?$/i,
  ]

  return lines.filter((line) => {
    if (excludedPatterns.some((pattern) => pattern.test(line))) return false
    if (/^Data Analyst - India \(2026\)$/i.test(line)) return false
    if (/^Data Architect$/i.test(line)) return false
    if (/^Artefact$/i.test(line)) return false
    return /Python|SQL|Tableau|PowerBI|Web Applications|data models|data warehousing|cloud data platforms|logical and physical data models|communication skills/i.test(line)
  })
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Artefact Greenhouse jobs API response no longer matches the expected payload')
  }

  const seenJobIds = new Set()

  return jobs.flatMap((job) => {
    const title = normalizeText(job?.title)
    const companyName = normalizeText(job?.company_name)
    const location = normalizeText(job?.location?.name)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
    const jobId = normalizeText(job?.id)

    if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
      throw new Error('Artefact Greenhouse payload no longer maps to the verified company identity')
    }

    if (!location || !/\bindia\b/i.test(location)) {
      return []
    }

    if (!title || !sourceUrl || !jobId) {
      throw new Error('Artefact Greenhouse payload no longer exposes the verified Greenhouse detail route')
    }

    if (seenJobIds.has(jobId)) {
      return []
    }
    seenJobIds.add(jobId)

    const lines = extractContentLines(job?.content)
    const applyUrl = sourceUrl

    return [{
      title,
      company: COMPANY,
      department: normalizeText(job?.departments?.[0]?.name),
      location,
      city: inferCity(location),
      country: 'India',
      jobId,
      requisitionId: normalizeText(job?.requisition_id) || jobId,
      sourceUrl,
      applyUrl,
      employmentType: extractMetadataValue(job?.metadata, 'Employment Type'),
      experienceRequired: extractExperienceRequired(lines),
      minimumQualification: extractMinimumQualification(lines),
      preferredQualification: null,
      requiredSkills: extractRequiredSkills(lines),
      postingDate: normalizeText(job?.updated_at || job?.first_published),
      closingDate: null,
      jobDescription: buildJobDescription(lines, title),
      link: applyUrl,
      source: SOURCE,
      scrapedAt,
    }]
  })
}

export const extractJobFromDetailPage = (html, listing = {}) => {
  if (!hasOfficialDetailPageSignal(html)) {
    throw new Error('Artefact detail page no longer matches the verified first-party surface')
  }

  const lines = extractContentLines(html)
  const title = normalizeText(listing.title) || lines.find((line) => /- Artefact$/i.test(line))?.replace(/\s*-\s*Artefact$/i, '') || null

  if (!title) {
    throw new Error('Artefact detail page no longer exposes a verified job title')
  }

  const sourceUrl = toAbsoluteUrl(listing.sourceUrl)
  const applyUrl = extractApplyUrlFromDetailPage(html) || toAbsoluteUrl(listing.applyUrl)
  const slug = sourceUrl ? new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) : slugify(title)
  const normalizedId = slug ? `${SOURCE}-${slugify(slug)}` : `${SOURCE}-${slugify(title)}`

  return {
    title,
    company: COMPANY,
    department: normalizeText(listing.department),
    location: normalizeText(listing.location),
    city: null,
    country: 'India',
    jobId: normalizedId,
    requisitionId: normalizedId,
    sourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: extractExperienceRequired(lines),
    minimumQualification: extractMinimumQualification(lines),
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(lines),
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(lines, title),
  }
}

const dedupeListings = (listings = []) => {
  const seen = new Set()
  const deduped = []

  for (const listing of listings) {
    if (!listing?.sourceUrl || seen.has(listing.sourceUrl)) continue
    seen.add(listing.sourceUrl)
    deduped.push(listing)
  }

  return deduped
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
  label: SOURCE,
  attempts: 2,
  timeoutMs: 15000,
  signal,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  method: 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: GREENHOUSE_BOARD_URL,
  },
  redirect: 'follow',
  label: SOURCE,
  attempts: 2,
  timeoutMs: 15000,
  signal,
})

export const createArtefactScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
    const homepageBlocked = hasBunkerWebBotDetectionSignal(homepageHtml)
    if (!homepageBlocked && !hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Artefact verified official homepage no longer matches the trusted first-party surface')
    }

    let careersHtml = await fetchText(CAREERS_URL, { signal })
    let listingUrl = CAREERS_URL
    if (hasOfficialCareersLandingSignal(careersHtml)) {
      listingUrl = JOBS_URL
      careersHtml = await fetchText(listingUrl, { signal })
    }
    const careersBlocked = hasBunkerWebBotDetectionSignal(careersHtml)
    if (!careersBlocked && !hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Artefact verified official careers page no longer matches the trusted first-party surface')
    }

    const fetchVerifiedGreenhouseJobs = async () => {
      const greenhouseBoardHtml = await fetchText(GREENHOUSE_BOARD_URL, { signal })
      if (!hasOfficialGreenhouseBoardSignal(greenhouseBoardHtml)) {
        throw new Error('Artefact verified public Greenhouse board no longer matches the trusted fallback surface')
      }

      const jobs = extractIndiaJobsFromGreenhousePayload(
        await fetchJson(GREENHOUSE_JOBS_API_URL, { signal }),
        { scrapedAt: now() },
      )

      if (jobs.length === 0) {
        throw new Error('Artefact Greenhouse API no longer exposes verified India jobs')
      }

      return jobs.sort((left, right) => left.title.localeCompare(right.title))
    }

    if (homepageBlocked || careersBlocked) {
      return fetchVerifiedGreenhouseJobs()
    }

    const pageUrls = [listingUrl, ...extractPaginationUrls(careersHtml)]
    const additionalPageEntries = await mapWithConcurrency(
      pageUrls.slice(1),
      PAGE_FETCH_CONCURRENCY,
      async (url) => ({
        url,
        html: await fetchText(url, { signal }),
      }),
    )
    const pageHtmlEntries = [{ url: listingUrl, html: careersHtml }, ...additionalPageEntries]

    const allListings = pageHtmlEntries.flatMap((entry) => extractListingCards(entry.html))
    const indiaListings = dedupeListings(filterIndiaListings(allListings))

    if (indiaListings.length === 0) {
      return fetchVerifiedGreenhouseJobs()
    }

    const jobs = await mapWithConcurrency(
      indiaListings,
      DETAIL_FETCH_CONCURRENCY,
      async (listing) => {
        const detailHtml = await fetchText(listing.sourceUrl, { signal })
        const job = extractJobFromDetailPage(detailHtml, listing)
        return {
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        }
      },
    )

    return jobs.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createArtefactScraper().run(options)

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
