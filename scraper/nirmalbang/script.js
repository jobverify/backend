import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { NIRMAL_BANG_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NIRMAL_BANG_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

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

const normalizeTextDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const shortDateMatch = text.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/)
  if (shortDateMatch) {
    const [, day, month, year] = shortDateMatch
    const isoMonth = MONTHS[month.toLowerCase()]
    if (!isoMonth) return text
    return `20${year}-${isoMonth}-${day}`
  }

  const slashDateMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashDateMatch) {
    const [, day, month, year] = slashDateMatch
    return `${year}-${month}-${day}`
  }

  return text
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) || normalized
}

export const buildListingsUrl = (page = 0) =>
  `https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=${page}`

export const buildDetailUrl = (jobId) =>
  `https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=${encodeURIComponent(jobId)}`

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return /canonical["'] href=["']https:\/\/www\.nirmalbang\.com\/static\/career\.aspx/i.test(rawHtml)
    && normalized.includes('nirmal bang is where ambition meets opportunity')
    && normalized.includes('browse our current openings below')
    && normalized.includes('find open positions at nirmalbang')
    && normalized.includes('careers@nirmalbang.com')
}

export const extractListingCards = (html) => Array.from(
  String(html ?? '').matchAll(
    /<div class=['"]careersec['"]>\s*<span>([\s\S]*?)<i>([\s\S]*?)<\/i><\/span>\s*<em>([\s\S]*?)<\/em>\s*<a[^>]*loadcareerpopById\('([^']+)'\)[^>]*>/gi,
  ),
)
  .map((match) => {
    const title = normalizeWhitespace(match[1])
    const location = normalizeWhitespace(match[2])
    const listingDate = normalizeTextDate(match[3])
    const jobId = normalizeWhitespace(match[4])

    if (!title || !location || !jobId) return null

    return {
      title,
      location,
      listingDate,
      jobId,
      requisitionId: jobId,
      sourceUrl: buildDetailUrl(jobId),
      applyUrl: CAREERS_URL,
    }
  })
  .filter(Boolean)

export const extractJobDetailPayload = (value) => {
  const parts = String(value ?? '').split('*').map((part) => normalizeWhitespace(part))
  if (parts.length < 6 || parts.slice(0, 6).some((part) => !part)) {
    throw new Error('Nirmal Bang public detail ajax no longer exposes the expected payload')
  }

  const [title, location, postingDate, jobDescription, candidateProfile, experienceRequired] = parts

  return {
    title,
    location,
    postingDate: normalizeTextDate(postingDate),
    jobDescription,
    candidateProfile,
    experienceRequired,
  }
}

export const createNirmalBangScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    maxPages = 5,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('The verified careers page no longer matches the known first-party Nirmal Bang jobs surface')
    }

    const scrapedAt = now()
    const jobs = []

    for (let page = 0; page < maxPages; page += 1) {
      const listings = extractListingCards(await fetchText(buildListingsUrl(page)))
      if (listings.length === 0) {
        if (page === 0) {
          throw new Error('Nirmal Bang public listings ajax no longer exposes job cards')
        }
        break
      }

      for (const listing of listings) {
        const detail = extractJobDetailPayload(await fetchText(buildDetailUrl(listing.jobId)))

        jobs.push({
          title: detail.title,
          company: COMPANY,
          department: null,
          location: detail.location,
          city: extractCity(detail.location),
          country: 'India',
          jobId: listing.jobId,
          requisitionId: listing.requisitionId,
          sourceUrl: listing.sourceUrl,
          applyUrl: listing.applyUrl,
          link: listing.applyUrl,
          experienceRequired: detail.experienceRequired,
          postingDate: detail.postingDate || listing.listingDate,
          jobDescription: detail.jobDescription,
          candidateProfile: detail.candidateProfile,
          source: SOURCE,
          scrapedAt,
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs.slice(0, maxJobs)
        }
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createNirmalBangScraper().run(options)

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
