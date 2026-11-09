import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INUBE_SOFTWARE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INUBE_SOFTWARE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const parseListItems = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeOptionalValue(match[1]))
  .filter(Boolean)

const cleanJobTitle = (value) => normalizeOptionalValue(value)?.replace(/:\s*$/u, '') || null

const extractJobSpecificationValues = (block = '', specificationClass) =>
  [...String(block ?? '').matchAll(
    new RegExp(
      `<div[^>]*class=["'][^"']*${specificationClass}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'gi',
    ),
  )]
    .flatMap((match) => [...match[1].matchAll(/<span[^>]*class=["'][^"']*awsm-job-specification-term[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)])
    .map((match) => normalizeOptionalValue(match[1]))
    .filter(Boolean)

const buildIndiaLocation = (locations = []) => {
  const uniqueLocations = [
    ...new Set((Array.isArray(locations) ? locations : []).map(normalizeOptionalValue).filter(Boolean)),
  ]

  if (uniqueLocations.length === 0) return null
  return `${uniqueLocations.join(', ')}, India`
}

const buildJobId = (detailUrl) => detailUrl?.split('/').filter(Boolean).at(-1) || null

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const roles = extractRoleSummaries(page)

  return /<title>\s*Careers\s*-\s*iNube\s*<\/title>/i.test(page)
    && /class=["'][^"']*awsm-job-listings[^"']*["']/i.test(page)
    && /View all [O0]penings/i.test(normalized)
    && roles.length > 0
    && roles.every(({ detailUrl }) => {
      try {
        const url = new URL(detailUrl)
        return url.protocol === 'https:'
          && ['inubesolutions.com', 'www.inubesolutions.com'].includes(url.hostname)
          && /^\/jobs\/[^/]+\/?$/.test(url.pathname)
      } catch {
        return false
      }
    })
}

export const extractRoleSummaries = (html = '') =>
  [...String(html ?? '').matchAll(
    /<div[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/a>\s*<\/div>/gi,
  )]
    .map((match) => {
      const block = match[1]
      const detailUrl = normalizeOptionalValue(
        block.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*awsm-job-item[^"']*["']/i)?.[1],
      )
      const title = cleanJobTitle(
        block.match(/<h2[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1],
      )

      return {
        title,
        detailUrl,
        department: extractJobSpecificationValues(block, 'awsm-job-specification-job-category')[0] || null,
        employmentType: extractJobSpecificationValues(block, 'awsm-job-specification-job-type')[0] || null,
        locations: extractJobSpecificationValues(block, 'awsm-job-specification-job-location'),
      }
    })
    .filter((item) => item.title && item.detailUrl)

export const extractRoleDetail = (html = '', summary = {}) => {
  const detailText = normalizeWhitespace(html)
  const location = normalizeOptionalValue(detailText.match(
    /Location:\s*([\s\S]{1,160}?)(?:Roles and responsibilities|Main responsibilities|Key Responsibilities|Qualifications|Work experience|Experience|Skills:|$)/i,
  )?.[1])
  const experienceRequired = normalizeOptionalValue(
    detailText.match(/(\d+\s*-\s*\d+\s*years?(?:\s+of\s+experience|\s+experience)?|\d+\+\s*years?(?:\s+of\s+experience)?)/i)?.[1],
  )?.replace(/\s+(?:of\s+)?experience$/i, '')
  const normalizedLocations = location
    ? [location]
    : Array.isArray(summary.locations) ? summary.locations : []
  const jobId = buildJobId(summary.detailUrl)
  const primaryCity = normalizedLocations[0] || null

  return {
    title: cleanJobTitle(summary.title),
    company: COMPANY,
    department: summary.department,
    location: buildIndiaLocation(normalizedLocations),
    city: primaryCity,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: summary.detailUrl,
    applyUrl: summary.detailUrl,
    employmentType: summary.employmentType,
    experienceRequired: experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: parseListItems(html),
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeOptionalValue(String(html ?? '').match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]) || detailText,
    remoteStatus: /Work from Office|On-?site/i.test(detailText)
      ? 'On-site'
      : /Hybrid/i.test(detailText)
        ? 'Hybrid'
        : /Remote/i.test(detailText)
          ? 'Remote'
          : null,
  }
}

export const createInubeSoftwareSolutionsScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Inube Software Solutions careers surface no longer matches the trusted first-party page')
    }

    const summaries = extractRoleSummaries(careersHtml)
    const selectedSummaries = maxJobs ? summaries.slice(0, maxJobs) : summaries
    const jobs = []

    for (const summary of selectedSummaries) {
      const detailHtml = await fetchText(summary.detailUrl)
      jobs.push({
        ...extractRoleDetail(detailHtml, summary),
        source: SOURCE,
        link: summary.detailUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createInubeSoftwareSolutionsScraper().run(options)

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
