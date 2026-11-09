import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://axisenergy.in/career/'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeTitle = (value) => normalizeWhitespace(value)
  ?.replace(/\s*-\s*/g, ' - ') || null

const extractLabeledValue = (html, label) => {
  const lines = String(html ?? '')
    .replace(/<(br|\/p|\/li|\/div)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = lines.find((line) => new RegExp(`^${escapedLabel}\\s*:`, 'i').test(line))

  return normalizeWhitespace(match?.replace(new RegExp(`^${escapedLabel}\\s*:\\s*`, 'i'), ''))
}

const extractJobBlocks = (html) => Array.from(String(html ?? '').matchAll(
  /<div\s+class="job-listing">([\s\S]*?)(?=<div\s+class="job-listing">|<!--END Job Listing Block|<\/main>|$)/gi,
), ([, block]) => block)

export const pageIndicatesJobs = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career\s*-\s*Axis Energy\s*<\/title>/i.test(page)
    && /Interested to join Axis/i.test(page)
    && /Current Opening'?s/i.test(page)
    && /class="job-listing"/i.test(page)
}

export const extractListings = (html) => extractJobBlocks(html).flatMap((block) => {
  const title = normalizeTitle(block.match(/<div\s+class="job-title">([\s\S]*?)<\/div>/i)?.[1])
  const detailsHtml = block.match(/<div\s+class="job-details">([\s\S]*)/i)?.[1] || ''
  const jobId = slugify(title)

  if (!title || !jobId) return []

  const location = extractLabeledValue(detailsHtml, 'Location')
  const city = location?.split(',')[0]?.trim() || null
  const qualification = extractLabeledValue(detailsHtml, 'Qualification')
  const experience = extractLabeledValue(detailsHtml, 'Experience')
  const detailsWithoutApplyButton = detailsHtml.replace(
    /<a\b[^>]*>\s*(?:<[^>]+>\s*)*Apply For Job[\s\S]*?<\/a>/gi,
    '',
  )
  const jobDescription = normalizeWhitespace(
    `${stripTags(detailsWithoutApplyButton) || `Apply for ${title}.`} Apply via the Axis Energy careers page.`,
  )
  const department = title.includes('-') ? normalizeWhitespace(title.split('-').slice(1).join('-')) : title

  return [{
    title,
    company: 'Axis Energy',
    department,
    location: location ? `${location}, India` : 'India',
    city,
    country: 'India',
    jobId: `axisenergy-${jobId}`,
    requisitionId: `axisenergy-${jobId}`,
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CAREER_PAGE_URL,
    employmentType: null,
    experienceRequired: experience,
    minimumQualification: qualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
  }]
})

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)

  return response.text()
}

export const createAxisEnergyScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)

    if (!pageIndicatesJobs(html)) {
      throw new Error('Axis Energy careers page no longer exposes the expected job listing blocks')
    }

    const listings = extractListings(html)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings

    return selectedListings.map((job) => ({
      ...job,
      source: 'axisenergy',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAxisEnergyScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Axis Energy scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'axisenergy')
    console.log('DB result:', result)
    process.exit(0)
  }
}
