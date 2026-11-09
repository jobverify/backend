import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DATAWEAVE_CATALOG } from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = DATAWEAVE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value) => {
  const match = String(value ?? '').match(pattern)
  return match ? stripTags(match[1]) : null
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSectionHtml = (html, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<h[1-6]\\b[^>]*>\\s*${escapedHeading}\\s*<\\/h[1-6]>([\\s\\S]*?)(?=<h[1-6]\\b|$)`, 'i'),
  )
  return match ? match[1] : ''
}

const extractDepartmentBefore = (html, index) => {
  const context = String(html ?? '').slice(Math.max(0, index - 4000), index)
  const matches = [...context.matchAll(
    /<h[1-6]\b[^>]*>\s*([^<]+?)\s*,\s*\d+\s+Open Position(?:s)?\s*<\/h[1-6]>/gi,
  )]
  return stripTags(matches.at(-1)?.[1] || null)
}

const extractLocationFromAnchorText = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/\bin\s+([A-Za-z][A-Za-z .-]+?)(?:\s+We are looking|\s+Apply for|\s*$)/i)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractTitleFromAnchorText = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(.*?)\s+in\s+[A-Za-z][A-Za-z .-]+?(?:\s+We are looking|\s+Apply for|\s*$)/i)
  return match ? normalizeWhitespace(match[1]) : normalized
}

const toJobId = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    return new URL(absoluteUrl).pathname
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .at(-1) || null
  } catch {
    return null
  }
}

const buildJobDescription = (html) => normalizeWhitespace(
  [
    extractFirst(/<h2\b[^>]*>\s*Product Engineering @DataWeave\s*<\/h2>([\s\S]*?)(?=<h[1-6]\b|$)/i, html),
    extractSectionHtml(html, 'Roles & Responsibilities'),
    extractSectionHtml(html, 'Skills & Requirements'),
    extractSectionHtml(html, 'Apply Now'),
    /Apply Now/i.test(String(html ?? '')) ? 'Apply Now' : null,
  ]
    .filter(Boolean)
    .join(' '),
)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /DataWeave/i.test(page)
    && /<a\b[^>]*href=["']https:\/\/dataweave\.com\/us\/careers\/?["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
}

export const extractCareersUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/dataweave\.com\/us\/careers\/?)["']/i)
  return match ? toAbsoluteUrl(match[1], HOMEPAGE_URL)?.replace(/\/+$/, '') : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Join us @DataWeave/i.test(page)
    && /Current Openings/i.test(page)
    && /hr@dataweave\.com/i.test(page)
    && /href=["'][^"']*\/jobs\/[^"']+["']/i.test(page)
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified DataWeave first-party careers surface with visible openings')
  }

  const jobs = [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const [fullMatch, href, labelHtml] = match
      const sourceUrl = toAbsoluteUrl(href)
      const title = extractTitleFromAnchorText(labelHtml)
      const rawLocation = extractLocationFromAnchorText(labelHtml)
      const location = rawLocation ? `${rawLocation}, India` : null
      const jobId = toJobId(sourceUrl)
      const department = extractDepartmentBefore(html, match.index ?? 0)

      if (!title || !sourceUrl || !location || !jobId) return null

      return {
        title,
        company: COMPANY,
        department,
        location,
        city: rawLocation,
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
        jobDescription: null,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Expected verified DataWeave first-party careers surface with visible openings')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const title = extractFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html) || listing.title || null
  const skillsSection = extractSectionHtml(html, 'Skills & Requirements')
  const requiredSkills = extractListItems(skillsSection)
  const detailLocation = extractFirst(/Job Location:\s*<\/p>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i, html)
  const location = detailLocation || listing.location || null
  const city = normalizeWhitespace(location?.split(',')[0] || listing.city || null)
  const hasInlineApplyForm = /Apply Now/i.test(String(html ?? '')) && /<form\b/i.test(String(html ?? ''))

  return {
    ...listing,
    title,
    company: listing.company || COMPANY,
    department: listing.department || extractFirst(/<h2\b[^>]*>([\s\S]*?)@DataWeave<\/h2>/i, html),
    location,
    city,
    country: listing.country || 'India',
    applyUrl: hasInlineApplyForm ? (listing.sourceUrl || listing.applyUrl || null) : (listing.applyUrl || listing.sourceUrl || null),
    employmentType: null,
    minimumQualification: requiredSkills[0] || listing.minimumQualification || null,
    preferredQualification: requiredSkills[1] || listing.preferredQualification || null,
    requiredSkills,
    jobDescription: buildJobDescription(html) || listing.jobDescription || null,
    remoteStatus: listing.remoteStatus || 'On-site',
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDataWeaveScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('DataWeave homepage no longer matches the verified DataWeave careers handoff')
    }

    if (extractCareersUrl(homepageHtml) !== CAREERS_URL) {
      throw new Error('DataWeave homepage Careers link changed materially')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const listings = extractListings(careersHtml)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      jobs.push(extractJobDetail(detailHtml, listing))
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createDataWeaveScraper().run(options)

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
