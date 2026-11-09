import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.crompton.co.in/pages/careers'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\u2013\u2014\uFFFD]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const formatLocation = (locationText) => {
  const normalized = normalizeWhitespace(locationText)
  if (!normalized || /^all india\b/i.test(normalized)) {
    return { location: normalized || 'India', city: null }
  }

  return { location: `${normalized}, India`, city: normalized }
}

const extractJobCards = (html) => Array.from(
  String(html ?? '').matchAll(/<li\b[^>]*class="[^"]*\bscale-anm\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi),
  (match) => {
    const cardHtml = match[1]
    const titleAndLocation = stripTags(cardHtml.match(/<span>([\s\S]*?)<div\b[^>]*class="career_badge"/i)?.[1])
    const badge = stripTags(cardHtml.match(/<span\b[^>]*class="badge"[^>]*>([\s\S]*?)<\/span>/i)?.[1])
    const applyUrl = normalizeWhitespace(
      cardHtml.match(/<a\b[^>]*href="([^"]+)"[^>]*>\s*Apply Now\s*<\/a>/i)?.[1],
    )
    const parts = titleAndLocation?.split(/\s+-\s+/) || []
    const locationText = parts.pop()

    return {
      title: normalizeWhitespace(parts.join(' - ')),
      locationText,
      department: badge,
      applyUrl,
    }
  },
).filter((entry) => entry.title && entry.locationText && entry.applyUrl)

export const pageIndicatesJobCards = (html) => (
  /<ul\b[^>]*class="career_list"/i.test(String(html ?? ''))
  && /\bscale-anm\b/i.test(String(html ?? ''))
  && /Apply Now/i.test(String(html ?? ''))
)

export const extractSearchResults = (html) => extractJobCards(html)
  .map((entry) => {
    const { location, city } = formatLocation(entry.locationText)

    return {
      title: entry.title,
      company: 'Crompton Greaves Consumer Electricals Limited',
      department: entry.department,
      location,
      city,
      country: 'India',
      jobId: `crompton-${slugify(`${entry.title}-${entry.locationText}`)}`,
      requisitionId: null,
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: entry.applyUrl,
      employmentType: null,
      experienceRequired: null,
      publicExperienceChecked: true,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the Crompton careers page.',
    }
  })
  .sort((left, right) => left.title.localeCompare(right.title) || left.location.localeCompare(right.location))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createCromptonScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const html = await (options.fetchText || defaultFetchText)(CAREER_PAGE_URL)
    if (!pageIndicatesJobCards(html)) {
      throw new Error('Crompton careers page no longer exposes the expected job cards')
    }

    const jobs = extractSearchResults(html)
    return (maxJobs ? jobs.slice(0, maxJobs) : jobs).map((job) => ({
      ...job,
      source: 'crompton',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCromptonScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Crompton India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'crompton')
  }
}
