import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://w.tracxn.com/careers'

const COMPANY = 'Tracxn Technologies Limited'
const SOURCE = 'tracxn'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const toJobId = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    return new URL(absoluteUrl).pathname.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const inferRemoteStatus = (location) => /remote|hybrid/i.test(String(location ?? ''))
  ? 'Hybrid'
  : 'On-site'

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  return /india/i.test(location) ? location : `${location}, India`
}

const toCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  const [city] = normalized.split(/[\/,]/)
  return normalizeWhitespace(city)
}

const extractFirst = (pattern, value) => {
  const match = String(value ?? '').match(pattern)
  return match ? stripTags(match[1]) : null
}

const extractField = (label, html) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return extractFirst(new RegExp(`${escaped}\\s*:\\s*([^<]+)`, 'i'), html)
}

const JOB_FAMILY_HEADING_IGNORE_PATTERN =
  /join our team at tracxn|a little about us|why you(?:'|’)ll love working here|your next role starts here|hear from the people who make tracxn what it is|some basics to help you get started|company|customers|explore tracxn|quick links/i

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const buildJobDescription = (html) => [...String(html ?? '').matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)
  .join('\n\n') || null

const buildInlineJobDescription = (html) => {
  const text = normalizeWhitespace(html)
  const match = text?.match(
    /Job Description\s+([\s\S]+?)(?:What We(?:'|’)?re Looking For:?|What can you expect at Tracxn\?|Founders:|$)/i,
  )

  return match?.[1] ? normalizeWhitespace(match[1]) : null
}

const extractNarrativeSkills = (html) => {
  const text = normalizeWhitespace(html)
  const match = text?.match(
    /What We(?:'|’)?re Looking For:?\s+([\s\S]+?)(?:What can you expect at Tracxn\?|Founders:|$)/i,
  )

  if (!match?.[1]) return []

  return match[1]
    .split(/\.\s+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
}

const inferDepartmentFromContext = (html, index) => {
  const context = String(html ?? '').slice(Math.max(0, index - 1500), index)
  const headings = [...context.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return headings.reverse().find((heading) => !JOB_FAMILY_HEADING_IGNORE_PATTERN.test(heading)) || null
}

const extractLegacyListings = (html) => [...String(html ?? '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
  .map((match) => {
    const cardHtml = match[1]
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a\b[^>]*href=["']([^"']+)["']/i, cardHtml))
    const title = extractFirst(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i, cardHtml)
    const paragraphs = [...cardHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((paragraphMatch) => stripTags(paragraphMatch[1]))
      .filter(Boolean)
    const department = paragraphs[0] || null
    const location = normalizeLocation(paragraphs.at(-1))
    const jobId = toJobId(sourceUrl)

    if (!title || !sourceUrl || !location || !jobId) return null

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
      jobDescription: null,
      remoteStatus: inferRemoteStatus(location),
    }
  })
  .filter(Boolean)

const extractCurrentListings = (html) => {
  const page = String(html ?? '')
  const jobs = []
  const seenJobIds = new Set()

  for (const match of page.matchAll(/<a\b[^>]*href=["']([^"']*\/career\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const jobId = toJobId(sourceUrl)
    if (!sourceUrl || !jobId || seenJobIds.has(jobId)) continue

    const anchorHtml = match[0]
    const title = extractFirst(
      /<div\b[^>]*class=["'][^"']*text-block-292[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      anchorHtml,
    ) || extractFirst(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i, anchorHtml)
    const employmentType = extractFirst(
      /<div\b[^>]*class=["'][^"']*text-block-290[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      anchorHtml,
    )
    const location = normalizeLocation(extractFirst(
      /<div\b[^>]*class=["'][^"']*text-block-291[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      anchorHtml,
    ))

    if (!title || !location) continue

    seenJobIds.add(jobId)
    jobs.push({
      title,
      company: COMPANY,
      department: inferDepartmentFromContext(page, match.index ?? 0),
      location,
      city: toCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: employmentType || null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: inferRemoteStatus(location),
    })
  }

  return jobs
}

const extractDetailHeaderFields = (html) => {
  const text = normalizeWhitespace(html)
  const match = text?.match(
    /Job details\s+(.+?)\s+(Full(?:-|\s)?time|Part(?:-|\s)?time|Contract|Contractor|Internship|Freelance)\s*\|\s*([^|]+?)\s+Apply for this role/i,
  )

  if (!match) return {}

  return {
    title: normalizeWhitespace(match[1]),
    employmentType: normalizeWhitespace(match[2]),
    location: normalizeLocation(match[3]),
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /tracxn/i.test(page)
    && /careers/i.test(page)
    && /\/career\/[a-z0-9-]+/i.test(page)
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified Tracxn careers surface with public opportunities')
  }

  const legacyJobs = extractLegacyListings(html)
  const jobs = legacyJobs.length > 0 ? legacyJobs : extractCurrentListings(html)

  if (jobs.length === 0) {
    throw new Error('Expected verified Tracxn careers surface with public opportunities')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const detailHeader = extractDetailHeaderFields(html)
  const title = extractFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html)
    || detailHeader.title
    || listing.title
    || null
  const department = extractField('Department', html) || listing.department || null
  const location = normalizeLocation(extractField('Location', html) || detailHeader.location || listing.location)
  const requiredSkills = extractListItems(html)
  const narrativeSkills = requiredSkills.length > 0 ? [] : extractNarrativeSkills(html)
  const applyUrl = toAbsoluteUrl(extractFirst(/<a\b[^>]*href=["']([^"']*docs\.google\.com\/forms[^"']*)["']/i, html))
    || listing.applyUrl
    || listing.sourceUrl
    || null

  return {
    ...listing,
    title,
    company: listing.company || COMPANY,
    department,
    location,
    city: toCity(location) || listing.city || null,
    country: listing.country || 'India',
    applyUrl,
    employmentType: extractField('Employment Type', html) || detailHeader.employmentType || listing.employmentType || null,
    minimumQualification: requiredSkills[0] || narrativeSkills[0] || listing.minimumQualification || null,
    preferredQualification: requiredSkills[1] || narrativeSkills[1] || listing.preferredQualification || null,
    requiredSkills: requiredSkills.length > 0 ? requiredSkills : narrativeSkills,
    jobDescription: buildJobDescription(html) || buildInlineJobDescription(html) || listing.jobDescription || null,
    remoteStatus: inferRemoteStatus(location || listing.location),
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

export const createTracxnScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = []

    for (const listing of extractListings(careersHtml)) {
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

export const run = async (options = {}) => createTracxnScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Tracxn jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
