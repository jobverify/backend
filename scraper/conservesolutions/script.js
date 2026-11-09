import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.conservesolution.com/jobs'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getSpecification = (card, type) => normalizeWhitespace(
  card.match(new RegExp(
    `<div\\b[^>]*class=["'][^"']*awsm-job-specification-${type}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  ))?.[1],
)

export const extractJobCards = (html) => String(html ?? '')
  .match(/<a\b[^>]*class=["'][^"']*\bawsm-job-item\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)
  ?.map((card) => {
    const applyUrl = card.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1]
    const title = normalizeWhitespace(card.match(/<h2\b[^>]*class=["'][^"']*\bawsm-job-post-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const department = getSpecification(card, 'job-category')
    const location = getSpecification(card, 'job-location')
    const experienceRequired = getSpecification(card, 'experience')
    const jobId = slugify(title)

    if (!title || !applyUrl || !jobId || !/\bindia\b/i.test(location || '')) return null

    return {
      title,
      company: 'Conserve Solutions',
      department,
      location: 'India',
      city: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      compensation: null,
    }
  })
  .filter(Boolean) || []

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const markUpstreamOutage = (error) => {
  if (/\bHTTP\s+5\d\d\b/i.test(String(error?.message || error))) {
    error.softFailure = true
    error.upstreamOutage = true
  }

  return error
}

const fetchTextOrThrowUpstream = async (fetchText, url) => {
  try {
    return await fetchText(url)
  } catch (error) {
    throw markUpstreamOutage(error)
  }
}

export const createConserveSolutionsScraper = ({ fetchText = defaultFetchText } = {}) => ({
  run: async ({ fetchText: overrideFetchText } = {}) => {
    const jobs = extractJobCards(
      await fetchTextOrThrowUpstream(overrideFetchText || fetchText, CAREERS_URL),
    )

    return jobs.map((job) => ({
      ...job,
      source: 'conservesolutions',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createConserveSolutionsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'conservesolutions')
}
