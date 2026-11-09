import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cybage'
export const COMPANY = 'Cybage'
export const CAREERS_URL = 'https://www.cybage.com/careers/open-positions'
export const APPLY_LOGIN_URL = 'https://careers.cybage.com/PublicPages/UserLogin.aspx'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|td|table|tbody|section|article|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const normalizeLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return /,\s*India$/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractJobInfoValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return stripTags(
    String(html ?? '').match(
      new RegExp(
        `<div class="job_info">[\\s\\S]*?<h4 class="job_info__heading">${escapedLabel}<\\/h4>[\\s\\S]*?<div class="job_info__desc">([\\s\\S]*?)<\\/div>`,
        'i',
      ),
    )?.[1],
  )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Open Positions\s*(?:\|\s*Cybage|\(Careers\):\s*Cybage)\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.cybage\.com\/careers\/open-positions["']/i.test(page)
    && text.includes('Open Positions')
    && /\/careers\/open-positions\/current-openings\//i.test(page)
    && /views-view-table|jobs-table/i.test(page)
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Cybage verified official open positions surface changed or disappeared')
  }

  const jobs = []

  for (const rowMatch of String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[1]
    const linkMatch = rowHtml.match(/<a[^>]+href=["']([^"']*\/current-openings\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) continue

    const sourceUrl = toAbsoluteUrl(linkMatch[1])
    const title = stripTags(linkMatch[2])
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean)
    const metadataCells = cells.slice(1)
    const department = metadataCells.length >= 3 ? metadataCells[0] : null
    const location = normalizeLocation(
      metadataCells.length >= 3 ? metadataCells[1] : metadataCells[0],
    ) || null
    const experienceRequired = metadataCells.length >= 3 ? metadataCells[2] : metadataCells[1]
    const jobId = slugify(sourceUrl?.split('/').pop() || title)

    if (!sourceUrl || !title || !jobId || !location) {
      throw new Error('Cybage verified official open positions surface changed or disappeared')
    }

    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Cybage verified official open positions surface changed or disappeared')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const titleFromHeading = stripTags(page.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const title = titleFromHeading && titleFromHeading.toLowerCase() !== 'job description'
    ? titleFromHeading
    : extractJobInfoValue(page, 'Job Title') || listing.title || null
  const applyUrl = toAbsoluteUrl(
    page.match(/<a[^>]+href=["']([^"']*PublicPages\/UserLogin\.aspx)["'][^>]*>\s*Apply Now/i)?.[1]
    || page.match(/<a[^>]+class=["'][^"']*apply-now[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1],
  )
  const location = normalizeLocation(
    extractJobInfoValue(page, 'Location')
    || stripTags(page.match(/Location:\s*([^<\n]+)/i)?.[1])
    || listing.location,
  )
  const experienceRequired = normalizeWhitespace(
    extractJobInfoValue(page, 'Work Experience')
    || stripTags(page.match(/Experience:\s*([^<\n]+)/i)?.[1])
    || listing.experienceRequired,
  )
  const department = normalizeWhitespace(
    extractJobInfoValue(page, 'Department') || listing.department,
  )
  const jobDescription = normalizeWhitespace(
    stripTags(page.match(/<div[^>]+class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]),
  )

  if (!title || !applyUrl || !jobDescription || applyUrl !== APPLY_LOGIN_URL) {
    throw new Error('Cybage verified first-party detail page changed materially')
  }

  return {
    ...listing,
    title,
    department,
    location,
    city: extractCity(location),
    applyUrl,
    experienceRequired,
    jobDescription,
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

export const createCybageScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const listings = extractListings(careersHtml)
    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: 'cybage.com',
        atsPlatform: 'official-company-careers-aspnet-apply',
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createCybageScraper().run(options)

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
