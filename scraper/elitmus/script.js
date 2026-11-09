import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.elitmus.com/jobs?experience_category=all'
const BASE_URL = 'https://www.elitmus.com'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractJobId = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const directMatch = normalized.match(/\b(\d{4,})\b/)
  if (directMatch) return directMatch[1]

  try {
    const url = new URL(normalized, BASE_URL)
    const queryId = url.searchParams.get('job_id')
    if (queryId && /^\d{4,}$/.test(queryId)) return queryId

    const pathMatch = url.pathname.match(/\/jobs\/(\d{4,})(?:\/)?$/i)
    return pathMatch ? pathMatch[1] : null
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return null
  return normalizeWhitespace(value)
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractField = (label, html) => {
  const match = extractFirst(
    new RegExp(`${label}:\\s*([^<\\n]+)`, 'i'),
    html,
  )
  return normalizeWhitespace(match)
}

const extractDescriptionSection = (html) => {
  const section = extractFirst(/<section\b[^>]*>([\s\S]*?)<\/section>/i, html)
  return stripTags(section)
}

const extractJobRoles = (html) => {
  const jobRolesBlock = extractFirst(
    /Job roles(?:<\/h[1-6]>|\s)*\s*<ul[^>]*>([\s\S]*?)<\/ul>/i,
    html,
  )
  const listItems = extractListItems(jobRolesBlock)
  if (listItems.length > 0) return listItems

  const labeled = extractField('Job Roles', html)
  if (!labeled) return []

  return labeled
    .split(/\s*,\s*/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const buildDetailUrl = ({ jobId, sourceUrl } = {}) => {
  const normalizedJobId = extractJobId(jobId) || extractJobId(sourceUrl)
  return normalizedJobId ? `${BASE_URL}/jobs/${normalizedJobId}` : null
}

export const extractSearchResults = (html) => {
  const matches = [...String(html ?? '').matchAll(/<h6>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h6>/gi)]

  return matches.map((match) => {
    const anchorIndex = match.index ?? 0
    const nextAnchorIndex = html.indexOf('<h6><a', anchorIndex + match[0].length)
    const cardHtml = html.slice(
      anchorIndex,
      nextAnchorIndex === -1 ? html.length : nextAnchorIndex,
    )

    const title = stripTags(match[2])
    const sourceUrl = buildDetailUrl({
      jobId: extractJobId(match[1]),
      sourceUrl: match[1],
    })
    const company = stripTags(extractFirst(/<\/h6>\s*<div>([\s\S]*?)<\/div>/i, cardHtml))
    const fields = [...cardHtml.matchAll(/<div>([\s\S]*?)<\/div>/gi)]
      .map((fieldMatch) => stripTags(fieldMatch[1]))
      .filter(Boolean)

    const [companyName, employmentType, location, experienceRequired] = fields
    const department = fields.find((value) => /,/.test(value) && !/india/i.test(value) && value !== companyName)
    const jobId = extractJobId(match[1])

    if (!title || !jobId || !sourceUrl) return null

    return {
      title,
      company: company || companyName || 'eLitmus Evaluation Pvt Ltd',
      department: department || null,
      location: location || null,
      city: normalizeWhitespace(location)?.split(',')[0] || null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: employmentType || null,
      experienceRequired: experienceRequired || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  }).filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)) || listing.title || null
  const company = stripTags(extractFirst(/<\/h1>\s*<div>([\s\S]*?)<\/div>/i, html)) || listing.company || null
  const sourceUrl = buildDetailUrl({
    jobId: listing.jobId || listing.requisitionId,
    sourceUrl: listing.sourceUrl,
  }) || listing.sourceUrl || null
  const location = extractField('Drive Location', html) && listing.location
    ? listing.location
    : listing.location || stripTags(extractFirst(/Full Time<\/div>\s*<div>([\s\S]*?)<\/div>/i, html))
  const experienceRequired = extractField('Last Date To Apply', html)
    ? stripTags(extractFirst(/<div>\s*₹[\s\S]*?<\/div>\s*<div>([\s\S]*?)<\/div>/i, html))
    : stripTags(extractFirst(/<div>Bangalore, Karnataka, India<\/div>\s*<div>([\s\S]*?)<\/div>/i, html)) || listing.experienceRequired || null

  return {
    title,
    company,
    department: extractField('Job Roles', html) || listing.department || null,
    location: normalizeWhitespace(location),
    city: normalizeWhitespace(location)?.split(',')[0] || listing.city || null,
    jobId: listing.jobId || extractJobId(sourceUrl),
    requisitionId: listing.requisitionId || listing.jobId || extractJobId(sourceUrl),
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(
      stripTags(extractFirst(/<\/a>\s*<div>(Full[\s-]*Time|Part[\s-]*Time|Internship|Contract)[\s\S]*?<\/div>/i, html)),
    ) || normalizeEmploymentType(listing.employmentType),
    experienceRequired: normalizeWhitespace(experienceRequired) || listing.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractJobRoles(html),
    postingDate: null,
    closingDate: extractField('Last Date To Apply', html),
    jobDescription: extractDescriptionSection(html),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createElitmusScraper = ({ fetchText = defaultFetchText } = {}) => ({
  run: async ({ fetchText: overrideFetchText } = {}) => {
    const fetchImpl = overrideFetchText || fetchText
    const listingHtml = await fetchImpl(CAREER_PAGE_URL)
    const listings = extractSearchResults(listingHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchImpl(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...listing,
        ...detail,
        company: detail.company || listing.company || 'eLitmus Evaluation Pvt Ltd',
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        source: 'elitmus',
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createElitmusScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running eLitmus scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'elitmus')
    console.log('DB result:', result)
    process.exit(0)
  }
}
