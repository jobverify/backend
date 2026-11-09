import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_SEARCH_URL = PROVIDER_METADATA.jobsSearchUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const toAbsoluteUrl = (value, baseUrl = JOBS_SEARCH_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtml(value), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value).replace(/\s+Office$/i, '')

const isIndiaLocation = (value) => /\bIndia\b/i.test(normalizeLocation(value))

const toCity = (location = '') => {
  const normalized = normalizeLocation(location)
  if (!normalized || /remote\s*-\s*india/i.test(normalized)) return null

  const match = normalized.match(/^([A-Za-z][A-Za-z\s-]+?)\s+India\b/i)
  return match ? match[1].trim() : null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*Explore Opportunities Across the Globe\s*\|\s*Hyland\s*<\/title>/i.test(page)
    && /Explore opportunities across the globe/i.test(normalized)
    && /Join our team/i.test(normalized)
    && /Fraud alert/i.test(normalized)
    && /careers-hyland\.icims\.com\/jobs\/search\?ss=1(?:&amp;|&|\\u0026)hashed=-435679902/i.test(page)
    && /careers-hyland\.icims\.com\/jobs\/intro\?hashed=-435679902/i.test(page)
}

export const hasListingsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers at Hyland\s*\|\s*Jobs in Software at Hyland\s*\|\s*Job Listings at Hyland\s*<\/title>/i.test(page)
    && normalized.includes('Here are our current job openings.')
    && normalized.includes('Use this form to perform another job search')
    && normalized.includes('Please enable cookies in your browser')
}

export const extractNextPageUrl = (html = '') => {
  const match = String(html ?? '').match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)
  return toAbsoluteUrl(match?.[1])
}

export const extractJobs = (html = '') => [...String(html ?? '').matchAll(
  /<li class="iCIMS_JobCardItem">([\s\S]*?)<\/li>/gi,
)]
  .map((match) => {
    const segment = match[1]
    const sourceUrl = toAbsoluteUrl(
      segment.match(/<a[^>]+href=["']([^"']*\/jobs\/\d+\/[^"']+)["'][^>]*>/i)?.[1],
    )
    const title = normalizeWhitespace(segment.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const jobId = normalizeWhitespace(segment.match(/<dt class="iCIMS_JobHeaderField">Job ID<\/dt>[\s\S]*?<dd class="iCIMS_JobHeaderData"><span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1])
    const department = normalizeWhitespace(segment.match(/<dt class="iCIMS_JobHeaderField">Category<\/dt>[\s\S]*?<dd class="iCIMS_JobHeaderData"><span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1])
    const location = normalizeLocation(
      segment.match(/<span class="sr-only field-label">Job Locations<\/span>[\s\S]*?<dd class="iCIMS_JobHeaderData"><span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1],
    )
    const jobDescription = normalizeWhitespace(
      segment.match(/<div class="col-xs-12 description">([\s\S]*?)<\/div>/i)?.[1],
    )

    if (!sourceUrl || !title || !jobId || !location || !isIndiaLocation(location)) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department,
      location,
      city: toCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: jobDescription || null,
      publicExperienceChecked: Boolean(jobDescription),
    }
  })
  .filter(Boolean)

export const createHylandSoftwareSolutionsIndiaScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const fetchImpl = overrideFetchText || fetchText
    const careersHtml = await fetchImpl(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Hyland careers page no longer matches the pinned first-party handoff')
    }

    const jobs = []
    const visited = new Set()
    let nextUrl = JOBS_SEARCH_URL

    while (nextUrl && !visited.has(nextUrl)) {
      visited.add(nextUrl)
      const listingsHtml = await fetchImpl(nextUrl)

      if (!hasListingsSignal(listingsHtml)) {
        throw new Error('The verified Hyland iCIMS listings surface no longer matches the pinned public contract')
      }

      for (const job of extractJobs(listingsHtml)) {
        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })
      }

      nextUrl = extractNextPageUrl(listingsHtml)
    }

    return jobs
  },
})

export const run = async (options = {}) => createHylandSoftwareSolutionsIndiaScraper().run(options)

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
