import path from 'path'
import { fileURLToPath } from 'url'

import { runNativeInventory } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://achiralabs.com/careers'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&bull;|&#8226;/gi, ' | ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREER_PAGE_URL).href
  } catch {
    return null
  }
}

const getCurrentOpeningsHtml = (html) => {
  const content = String(html ?? '')
  const openingMatch = content.match(/<h2\b[^>]*>\s*Current Openings\s*<\/h2>/i)
  if (!openingMatch || openingMatch.index == null) return ''

  const afterOpenings = content.slice(openingMatch.index + openingMatch[0].length)
  const nextSection = afterOpenings.search(/<h2\b[^>]*>/i)
  return nextSection === -1 ? afterOpenings : afterOpenings.slice(0, nextSection)
}

const extractDescription = (cardHtml) => {
  const paragraphs = [...String(cardHtml).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  return paragraphs.find((paragraph) => !/^(?:[^|]+\s*\|\s*){2}[^|]+$/.test(paragraph)) || null
}

export const extractSearchResults = (html) => {
  const openingsHtml = getCurrentOpeningsHtml(html)
  const cards = [...openingsHtml.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)]

  return cards.map((match) => {
    const title = normalizeWhitespace(match[1])?.replace(/\s*\+\s*$/, '') || null
    const cardHtml = match[2]
    const metadata = normalizeWhitespace(cardHtml)?.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)(?:\s+Apply Now|$)/i)
    const applyMatch = cardHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)
    const jobId = slugify(title)

    if (!title || !metadata || !jobId) return null

    const [location, employmentType, department] = metadata.slice(1).map(normalizeWhitespace)
    const sourceUrl = `${CAREER_PAGE_URL}#${jobId}`

    return {
      title,
      company: 'Achira Labs',
      department,
      location: /\bindia\b/i.test(location) ? location : `${location}, India`,
      city: location?.split(',')[0]?.trim() || null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: toAbsoluteUrl(applyMatch?.[1]) || CAREER_PAGE_URL,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: extractDescription(cardHtml),
      remoteStatus: 'On-site',
    }
  }).filter(Boolean)
}

export const createAxiraLabsScraper = (factoryOptions = {}) => ({
  async run(options = {}) {
    return runNativeInventory({ ...factoryOptions, ...options })
  },
})

export const run = async (options = {}) => createAxiraLabsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Achira Labs scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'axiralabs')
    console.log('DB result:', result)
    process.exit(0)
  }
}
