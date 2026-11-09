import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.avinsystems.com/careers/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => new URL(value, CAREERS_PAGE_URL).toString()

const extractJobId = (url) => {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/india/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  return normalized
    .replace(/,?\s*India$/i, '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)[0] || null
}

const buildJobDescription = (detail = {}) => normalizeWhitespace([
  detail.jobDescription,
  detail.keyResponsibilities ? `Key Responsibilities: ${detail.keyResponsibilities}` : null,
  detail.requiredSkills.length > 0 ? `Skills Required: ${detail.requiredSkills.join(', ')}` : null,
].filter(Boolean).join(' '))

export const extractJobCards = (html) => {
  const cards = []
  const cardPattern = /<div class="job-card">[\s\S]*?<span class="job-title">([\s\S]*?)<\/span>[\s\S]*?<span class="job-skill">([\s\S]*?)<\/span>[\s\S]*?<span class="job-experience">([\s\S]*?)<\/span>[\s\S]*?<span class="job-location">([\s\S]*?)<\/span>[\s\S]*?<a href="([^"]+)"/gi

  for (const match of String(html ?? '').matchAll(cardPattern)) {
    const absoluteUrl = buildAbsoluteUrl(match[5])
    const jobId = extractJobId(absoluteUrl)

    cards.push({
      title: stripTags(match[1]),
      skill: stripTags(match[2]),
      experienceRequired: stripTags(match[3]),
      location: normalizeLocation(stripTags(match[4])),
      city: extractCity(stripTags(match[4])),
      sourceUrl: absoluteUrl,
      applyUrl: absoluteUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  return cards.filter((card) => card.title && card.sourceUrl && card.jobId)
}

const extractField = (text, label, nextLabels) => {
  const pattern = new RegExp(
    `${label}:\\s*([\\s\\S]*?)(?=\\s+(?:${nextLabels.join('|')}):|$)`,
    'i',
  )
  return normalizeWhitespace(text.match(pattern)?.[1] || null)
}

export const extractJobDetail = (html) => {
  const text = normalizeWhitespace(
    String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

  const title = normalizeWhitespace(
    html.match(/<title[^>]*>([\s\S]*?)\s*-\s*AVIN Systems<\/title>/i)?.[1]
      || extractField(text, 'Apply', ['Job Location', 'Primary Skills', 'Experience', 'Job Description']),
  )
  const location = normalizeLocation(extractField(text, 'Job Location', ['Primary Skills', 'Experience', 'Job Description']))
  const primarySkills = extractField(text, 'Primary Skills', ['Experience', 'Job Description', 'Key Responsibilities', 'Skills Required'])
  const experienceRequired = extractField(text, 'Experience', ['Job Description', 'Key Responsibilities', 'Skills Required'])
  const jobDescription = extractField(text, 'Job Description', ['Key Responsibilities', 'Skills Required', 'Benefits'])
  const keyResponsibilities = extractField(text, 'Key Responsibilities', ['Skills Required', 'Benefits'])
  const requiredSkills = (extractField(text, 'Skills Required', ['Benefits']) || '')
    .split(/[;,]/)
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean)

  return {
    title,
    location,
    city: extractCity(location),
    primarySkills,
    experienceRequired,
    jobDescription,
    keyResponsibilities,
    requiredSkills,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'avinsystems',
  timeoutMs: 15000,
})

export const createAvinSystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    const listings = extractJobCards(careersHtml)
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedJobs) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml)

      jobs.push({
        title: detail.title || listing.title,
        company: 'AVIN Systems',
        department: detail.primarySkills || listing.skill || null,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        country: 'India',
        jobId: listing.jobId,
        requisitionId: listing.requisitionId,
        sourceUrl: listing.sourceUrl,
        applyUrl: listing.applyUrl,
        employmentType: null,
        experienceRequired: detail.experienceRequired || listing.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: detail.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: buildJobDescription(detail),
        source: 'avinsystems',
        link: listing.applyUrl || listing.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async () => createAvinSystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AVIN Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'avinsystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
