import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'novartis'
export const COMPANY = 'Novartis'
export const CAREERS_URL = 'https://www.novartis.com/careers/career-search/tag/LOC_IN'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const buildDescription = ({ site, division, businessUnit, functionalArea }) =>
  [
    site ? `Site: ${site}.` : null,
    division ? `Division: ${division}.` : null,
    businessUnit ? `Business: ${businessUnit}.` : null,
    functionalArea ? `Functional Area: ${functionalArea}.` : null,
  ].filter(Boolean).join(' ') || null

const deriveCity = (site) => {
  const normalizedSite = normalizeWhitespace(site)
  if (!normalizedSite) return null

  const city = normalizedSite
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .split(',')[0]
    .trim()

  return city || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const parseJsonValue = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const flattenJsonLdNodes = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap((item) => flattenJsonLdNodes(item))
  if (typeof value !== 'object') return []

  return [
    value,
    ...flattenJsonLdNodes(value['@graph']),
  ]
}

const extractJobPosting = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]

  for (const match of scripts) {
    const parsed = parseJsonValue(match[1])
    if (!parsed) continue

    const jobPosting = flattenJsonLdNodes(parsed).find((node) => {
      const type = node?.['@type']
      return Array.isArray(type) ? type.includes('JobPosting') : type === 'JobPosting'
    })

    if (jobPosting) return jobPosting
  }

  return null
}

const inferExperienceRequired = (jobDescription) => {
  const experienceProfile = extractJobFilterSignals({
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    jobDescription,
  })?.experienceProfile

  if (experienceProfile?.confidence === 'high' && experienceProfile.evidence) {
    return normalizeWhitespace(
      experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
        ? 'No experience required'
        : experienceProfile.evidence,
    )
  }

  return null
}

const extractMinimumQualification = (jobDescription) => normalizeWhitespace(
  String(jobDescription ?? '').match(
    /\b(?:essential|minimum)\s+requirements?\s*:\s*([^.!?]+[.!?]?)/i,
  )?.[1],
)

export const extractJobDetailFromHtml = (html, listing = {}) => {
  const jobPosting = extractJobPosting(html)
  if (!jobPosting) return listing

  const jobDescription = [
    stripTags(jobPosting.description),
    stripTags(jobPosting.responsibilities),
  ].filter(Boolean).join(' ').trim() || null
  const location = normalizeWhitespace(
    jobPosting?.jobLocation?.address?.addressLocality
      || jobPosting?.jobLocation?.[0]?.address?.addressLocality,
  )
  const employmentType = normalizeWhitespace(jobPosting.employmentType)

  return {
    ...listing,
    title: normalizeWhitespace(jobPosting.title) || listing.title || null,
    location: location ? `${location}, India` : listing.location || null,
    city: deriveCity(location) || listing.city || null,
    postingDate: normalizeWhitespace(jobPosting.datePosted) || listing.postingDate || null,
    employmentType: employmentType || listing.employmentType || null,
    jobDescription: jobDescription || listing.jobDescription || null,
    minimumQualification: extractMinimumQualification(jobDescription) || listing.minimumQualification || null,
    experienceRequired: inferExperienceRequired(jobDescription) || listing.experienceRequired || null,
    department: normalizeWhitespace(jobPosting.industry) || listing.department || null,
  }
}

const mapWithConcurrency = async (items, limit, iteratee) => {
  const concurrency = Math.max(1, Number.isInteger(limit) ? limit : 1)
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
}

const extractField = (rowHtml, fieldClass) => normalizeWhitespace(
  String(rowHtml ?? '').match(
    new RegExp(`<td[^>]*class=["'][^"']*${fieldClass}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`, 'i'),
  )?.[1],
)

const extractJobLink = (rowHtml) => {
  const href = String(rowHtml ?? '').match(
    /<td[^>]*class=["'][^"']*views-field-field-job-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/i,
  )?.[1]

  if (!href) return null

  try {
    return new URL(href, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractJobId = (sourceUrl) =>
  normalizeWhitespace(String(sourceUrl ?? '').match(/\/details\/([^/?#]+)/i)?.[1] ?? null)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.novartis\.com\/careers\/career-search\/tag\/LOC_IN["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Novartis["']/i.test(page)
    && /<div class='view view-id-career_search view-display-id-page_3'>/i.test(page)
    && /<table[^>]*class="views-table responsive-enabled table table-striped"/i.test(page)
}

export const extractPagination = (html) => {
  const pages = [...String(html ?? '').matchAll(/\bhref=["'][^"']*\?page=(\d+)["']/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isInteger)

  return pages.length > 0 ? Math.max(...pages) : 0
}

export const extractJobsFromHtml = (html, { scrapedAt = new Date().toISOString() } = {}) =>
  [...String(html ?? '').matchAll(/<tr[^>]*>\s*([\s\S]*?)\s*<\/tr>/gi)]
    .map((match) => match[1])
    .map((rowHtml) => {
      const sourceUrl = extractJobLink(rowHtml)
      const title = normalizeWhitespace(
        String(rowHtml).match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1],
      )
      const site = extractField(rowHtml, 'views-field-field-job-work-location')
      const country = extractField(rowHtml, 'views-field-field-job-country')
      const division = extractField(rowHtml, 'views-field-field-job-division')
      const businessUnit = extractField(rowHtml, 'views-field-field-job-business-unit')
      const functionalArea = extractField(rowHtml, 'views-field-field-job-functional-area')
      const postingDate = extractField(rowHtml, 'views-field-field-job-posted-date')

      if (!title || !sourceUrl || country !== 'India') return null

      const location = site ? `${site}, India` : 'India'
      const jobId = extractJobId(sourceUrl)

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(site),
        country,
        department: functionalArea,
        team: businessUnit,
        source: SOURCE,
        sourceUrl,
        applyUrl: sourceUrl,
        link: sourceUrl,
        jobId,
        requisitionId: jobId,
        postingDate,
        employmentType: null,
        remoteStatus: null,
        jobDescription: buildDescription({
          site,
          division,
          businessUnit,
          functionalArea,
        }),
        requiredSkills: [],
        scrapedAt,
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const buildPageUrl = (pageNumber) => {
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    return CAREERS_URL
  }

  const url = new URL(CAREERS_URL)
  url.searchParams.set('page', String(pageNumber))
  return url.toString()
}

export const createNovartisScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const seenUrls = new Set()
    const jobs = []
    let maxPage = 0

    for (let currentPage = 0; currentPage <= maxPage; currentPage += 1) {
      const html = await fetchText(buildPageUrl(currentPage))

      if (!hasOfficialCareersSignal(html)) {
        throw new Error('Novartis careers page no longer matches the verified first-party India jobs surface')
      }

      maxPage = Math.max(maxPage, extractPagination(html))

      for (const job of extractJobsFromHtml(html, { scrapedAt: now() })) {
        if (seenUrls.has(job.sourceUrl)) continue
        seenUrls.add(job.sourceUrl)
        jobs.push(job)

        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) {
          return jobs.slice(0, maxJobs)
        }
      }
    }

    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const enrichedJobs = await mapWithConcurrency(
      selectedJobs,
      6,
      async (job) => {
        try {
          const detailHtml = await fetchText(job.sourceUrl || job.applyUrl)
          return extractJobDetailFromHtml(detailHtml, job)
        } catch {
          return job
        }
      },
    )

    return enrichedJobs
  },
})

export const run = async (options = {}) => createNovartisScraper(options).run(options)

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
