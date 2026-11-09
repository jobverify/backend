import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://edutinker.com'
export const CAREERS_URL = `${BASE_URL}/careers-at-edutinker/`

const SOURCE = 'edutinker'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const slugFromUrl = (url) => {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

const extractField = (html, label) => normalizeWhitespace(
  extractFirst(
    new RegExp(`${label}\\s*:?[\\s\\S]{0,80}?<[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'),
    html,
  ),
) || normalizeWhitespace(
  extractFirst(
    new RegExp(`${label}\\s*:?\\s*([^<\\n]+)`, 'i'),
    html,
  ),
)

const extractDescription = (html) => {
  const section = extractFirst(
    /Job Brief[\s\S]*?(<div[\s\S]*?Apply for this position|<section[\s\S]*?Apply for this position|Apply for this position)/i,
    html,
    (match) => match[0],
  )

  return stripTags(section)
    ?.replace(/Apply for this position[\s\S]*$/i, '')
    .trim() || null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Careers\s*-\s*eduTinker/i.test(page)
    && /Open Positions/i.test(page)
    && /Technodemics Smart Solutions Private Limited/i.test(page)
    && /\/jobs\/python-developer\//i.test(page)
    && /\/jobs\/react-developer\//i.test(page)
}

export const extractListings = (html) => {
  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']*\/jobs\/[^"']+\/)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = normalizeWhitespace(match[2])
    const jobId = slugFromUrl(sourceUrl)

    if (!sourceUrl || !title || !jobId || seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    jobs.push({
      title,
      company: 'Edutinker',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i, html),
  ) || listing.title || null

  const department = extractField(html, 'Job Category')
  const employmentType = extractField(html, 'Job Type')
  const location = extractField(html, 'Job Location')
  const description = extractDescription(html)
  const hasApplyForm = /Apply for this position/i.test(String(html ?? ''))
    && /Full Name/i.test(String(html ?? ''))
    && /Upload CV\/Resume/i.test(String(html ?? ''))

  return {
    title,
    company: 'Edutinker',
    department,
    location,
    city: /remote/i.test(location || '') ? 'Remote' : normalizeWhitespace(location)?.split(',')[0] || null,
    country: /india/i.test(location || '') ? 'India' : (/remote/i.test(location || '') ? 'India' : null),
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: hasApplyForm ? (listing.sourceUrl || null) : (listing.applyUrl || listing.sourceUrl || null),
    employmentType,
    experienceRequired: normalizeWhitespace(
      extractFirst(/\(([^)]*years experience[^)]*)\)/i, title || ''),
    ),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: /remote/i.test(location || '') ? 'Remote' : 'On-site',
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

export const createEdutinkerScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Edutinker careers page no longer matches the verified official public jobs surface')
    }

    const listings = extractListings(careersHtml)

    const jobs = await Promise.all(listings.map(async (listing) => {
      const detailHtml = await fetchText(listing.sourceUrl)
      return {
        ...extractJobDetail(detailHtml, listing),
        link: listing.sourceUrl,
        source: SOURCE,
        scrapedAt: new Date().toISOString(),
      }
    }))

    return jobs
  },
})

export const run = async (options = {}) => createEdutinkerScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Edutinker scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
