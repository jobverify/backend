import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://danlawtechnologies.com/careers'
const SOURCE = 'danlawtechnologies'
const COMPANY = 'Danlaw Technologies'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const stripHtml = (value) => decodeHtml(value)
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractLabel = (block, label) => stripHtml(
  block.match(new RegExp(`${label}\\s*:\\s*([^<]+)`, 'i'))?.[1],
) || null

const buildLocation = (city) => city ? `${city}, India` : null

const extractCity = (location) => location?.split(',')[0]?.trim() || null

const buildJobId = (url) => {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '')
    return pathname.split('/').pop()?.toLowerCase() || null
  } catch {
    return null
  }
}

const extractDescription = (block) => {
  const descriptionBlock = block.match(/<h3[^>]*>\s*description\s*<\/h3>([\s\S]*?)<h6\b/i)?.[1]
  if (!descriptionBlock) return null

  return stripHtml(descriptionBlock)
    .replace(/\bLocation\s*:\s*[^.]+?(?=Experience\s*:)/i, '')
    .replace(/\bExperience\s*:\s*[^.]+?(?=Qualification\s*:)/i, '')
    .replace(/\bQualification\s*:\s*.*?(?=Roles\s*&\s*Responsibilities|•|$)/i, '')
    .replace(/Roles\s*&\s*Responsibilities\s*:?/i, '')
    .replace(/^\s*[•·-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim() || null
}

export const extractJobs = (html) => String(html ?? '')
  .split(/<div[^>]+id=["']jb-hover["'][^>]*>/i)
  .slice(1)
  .map((block) => {
    const title = stripHtml(block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
    const sourceUrl = block.match(/<a[^>]+href=["']([^"']*\/career-detail\/[^"']+)["'][^>]*>\s*Apply/i)?.[1] || null
    const city = extractLabel(block, 'Location')
    const experienceRequired = extractLabel(block, 'Experience')
    const minimumQualification = extractLabel(block, 'Qualification')
    const jobId = buildJobId(sourceUrl)
    const location = buildLocation(city)

    if (!title || !sourceUrl || !jobId || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: extractDescription(block),
      remoteStatus: 'On-site',
      salary: null,
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDanlawTechnologiesScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = extractJobs(await fetchText(CAREER_PAGE_URL))

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createDanlawTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Danlaw Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
