import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { TRADINGO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = TRADINGO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const SHARED_APPLY_URL = PROVIDER_METADATA.applicationFormUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;|â€™/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*career opportunities at tradingo\s*<\/title>/i.test(page)
    && normalized.includes('work with us !')
    && normalized.includes('be a part of the tribe')
    && normalized.includes('job opportunities')
    && normalized.includes('customer acquisition manager')
    && normalized.includes('relationship manager')
    && extractSharedApplyUrl(page) === SHARED_APPLY_URL
}

export const extractSharedApplyUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(
    /https:\/\/docs\.google\.com\/forms\/d\/e\/[a-z0-9_-]+\/viewform\?usp=pp_url/gi,
  )) {
    const absoluteUrl = toAbsoluteUrl(match[0], CAREERS_URL)
    if (absoluteUrl === SHARED_APPLY_URL) {
      return absoluteUrl
    }
  }

  return null
}

const extractJobSection = (html = '') => {
  const match = String(html ?? '').match(
    /<h2\b[^>]*>\s*Job Opportunities\s*<\/h2>([\s\S]*?)(?=<section\b|<\/main>|$)/i,
  )

  return match?.[1] ?? ''
}

const parseArticle = (articleHtml, department, sharedApplyUrl) => {
  const title = stripTags(articleHtml.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
  if (!title) return null

  const experienceRequired = stripTags(
    articleHtml.match(/Experience required\s*:\s*([^<]+)</i)?.[1],
  ) || null
  const minimumQualification = stripTags(
    articleHtml.match(/Qualification\s*:\s*([^<]+)</i)?.[1],
  ) || null
  const applyUrl = toAbsoluteUrl(
    articleHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*APPLY\s*<\/a>/i)?.[1],
    CAREERS_URL,
  )

  const jobDescriptionParts = []
  if (experienceRequired) {
    jobDescriptionParts.push(`Experience required: ${experienceRequired}`)
  }
  if (minimumQualification) {
    jobDescriptionParts.push(`Qualification: ${minimumQualification}`)
  }

  return {
    title,
    company: COMPANY,
    department: department || null,
    location: null,
    city: null,
    country: null,
    jobId: slugify(title),
    requisitionId: null,
    sourceUrl: `${CAREERS_URL}#${slugify(title)}`,
    applyUrl: applyUrl === sharedApplyUrl ? applyUrl : sharedApplyUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: jobDescriptionParts.join(' ') || null,
  }
}

export const extractRoleCards = (html = '') => {
  const sharedApplyUrl = extractSharedApplyUrl(html)
  const jobSection = extractJobSection(html)
  if (!sharedApplyUrl || !jobSection) return []

  const jobs = []
  const departmentSections = [...jobSection.matchAll(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi,
  )]

  const sectionsToParse = departmentSections.length > 0
    ? departmentSections.map((match) => ({
      department: stripTags(match[1]) || null,
      html: match[2],
    }))
    : [{ department: null, html: jobSection }]

  for (const section of sectionsToParse) {
    for (const roleMatch of section.html.matchAll(
      /<h4\b[^>]*>[\s\S]*?<\/h4>[\s\S]*?<a\b[^>]*href=["'][^"']+["'][^>]*>\s*APPLY\s*<\/a>/gi,
    )) {
      const job = parseArticle(roleMatch[0], section.department, sharedApplyUrl)
      if (job) {
        jobs.push(job)
      }
    }
  }

  return jobs.filter((job) => job.applyUrl === sharedApplyUrl)
}

export const createTradingoScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Tradingo verified official careers page no longer matches the trusted same-page role board')
    }

    const jobs = extractRoleCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Tradingo verified official careers page no longer exposes public same-page role cards')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTradingoScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
