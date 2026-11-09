import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SCALEFUSION_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SCALEFUSION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const CORPORATE_CAREERS_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const labelMatch = normalized.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})$/)
  if (labelMatch) {
    const [, monthLabel, dayLabel, year] = labelMatch
    const monthMap = {
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
    const month = monthMap[monthLabel.slice(0, 3).toLowerCase()]
    const day = dayLabel.padStart(2, '0')
    if (month) return `${year}-${month}-${day}`
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, 'https://promobitech.com').toString()
  } catch {
    return null
  }
}

const extractField = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp(`<h6[^>]*>\\s*${label}\\s*<\\/h6>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`, 'i'),
  )
  return normalizeWhitespace(match?.[1])
}

const extractLocations = (html) => {
  const section = String(html ?? '').match(
    /<h6[^>]*>\s*Location\s*<\/h6>([\s\S]*?)<h6[^>]*>\s*Date Posted\s*<\/h6>/i,
  )?.[1]

  const locations = [...String(section ?? '').matchAll(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  if (locations.length > 0) return locations

  const paragraph = normalizeWhitespace(section)
  return paragraph ? [paragraph] : []
}

const buildIndiaLocation = (locations = []) => {
  const cities = locations.map((value) => normalizeWhitespace(value)).filter(Boolean)
  if (cities.length === 0) {
    return {
      location: null,
      city: null,
      state: null,
      country: 'India',
    }
  }

  const location = cities
    .map((city) => (/\bindia\b/i.test(city) ? city : `${city}, India`))
    .join(' / ')

  return {
    location,
    city: cities[0],
    state: null,
    country: 'India',
  }
}

const buildJobId = (sourceUrl) => {
  try {
    const pathname = new URL(sourceUrl).pathname.replace(/\/+$/, '')
    const slug = pathname.split('/').pop()
    return normalizeWhitespace(slug) || null
  } catch {
    return null
  }
}

export const extractOfficialCareersHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/href=["'](https:\/\/promobitech\.com\/[^"']+)["']/i)
  return normalizeWhitespace(match?.[1])?.replace(/\/$/, '') || null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers at Scalefusion \| Build What the World Runs On\s*<\/title>/i.test(page)
    && text.includes('Build what the world runs on.')
    && text.includes('Scalefusion is a product of ProMobi Technologies Pvt. Ltd')
    && text.includes('You will be redirected to the careers page on our corporate website.')
    && extractOfficialCareersHandoffUrl(page) !== null
}

export const extractPromobiJobs = (html = '') => {
  const jobs = []
  const blocks = [
    ...String(html ?? '').matchAll(/<div[^>]+class=["'][^"']*\bjob\b[^"']*["'][^>]*itemtype=["']http:\/\/schema\.org\/JobPosting["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*\bjob\b[^"']*["'][^>]*itemtype=["']http:\/\/schema\.org\/JobPosting["']|<\/section>|<\/body>|$)/gi),
    ...String(html ?? '').matchAll(/<section[^>]+class=["'][^"']*\bjob-card\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi),
  ]

  for (const match of blocks) {
    const body = match[1]
    const title = normalizeWhitespace(body.match(/<h3[^>]*itemprop=["']title["'][^>]*>\s*([\s\S]*?)<\/h3>/i)?.[1])
      || normalizeWhitespace(body.match(/<h3[^>]*>\s*([\s\S]*?)<\/h3>/i)?.[1])
    const sourceUrl = toAbsoluteUrl(body.match(/<a[^>]*class=["'][^"']*\bbtn-details\b[^"']*["'][^>]*href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>/i)?.[1])
      || toAbsoluteUrl(body.match(/<a[^>]*href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>\s*See Details\s*<\/a>/i)?.[1])
    const description = normalizeWhitespace(body.match(/<p[^>]*>\s*([\s\S]*?)<\/p>/i)?.[1])
    const experienceRequired = extractField(body, 'Experience')
    const employmentType = normalizeEmploymentType(extractField(body, 'Job Type'))
    const postingDate = normalizeDate(extractField(body, 'Date Posted'))
    const locationFields = buildIndiaLocation(extractLocations(body))
    const jobId = buildJobId(sourceUrl)

    if (!title || !sourceUrl || !jobId || !locationFields.location) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: locationFields.location,
      city: locationFields.city,
      state: locationFields.state,
      country: locationFields.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: description,
      remoteStatus: 'On-site',
    })
  }

  return jobs
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

export const createScalefusionScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Scalefusion careers page')
    }

    if (extractOfficialCareersHandoffUrl(careersPageHtml) !== CORPORATE_CAREERS_URL) {
      throw new Error('The verified Scalefusion careers handoff changed materially')
    }

    const jobsPageHtml = await fetchText(CORPORATE_CAREERS_URL)
    const jobs = extractPromobiJobs(jobsPageHtml)

    if (jobs.length === 0) {
      throw new Error('The verified ProMobi public jobs surface changed materially')
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createScalefusionScraper().run(options)

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
