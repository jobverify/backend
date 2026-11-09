import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { runCurrentBotminds } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://botminds.ai/careers'

const INDIA_LOCATION_PATTERN = /india|chennai|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|gurugram|noida/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toArray = (value) => Array.isArray(value) ? value : []

export const buildSearchUrl = () => CAREER_PAGE_URL

const parseNextData = (html) => {
  const match = String(html ?? '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return []

  try {
    const payload = JSON.parse(match[1])
    return toArray(payload?.props?.pageProps?.CareerSection?.Data)
  } catch {
    return []
  }
}

const buildJobUrl = (jobPath) => new URL(String(jobPath ?? '').replace(/^\/+/, ''), 'https://botminds.ai/').toString()

const inferLocationFromDescription = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/\bUS market\b|\bbased in the US\b|\bNorth America\b/i.test(normalized)) {
    return 'US'
  }

  const indiaMatch = normalized.match(/\bbased in ([A-Za-z .-]+?)(?: with|,|\.|$)/i)
  if (indiaMatch?.[1]) {
    const city = normalizeWhitespace(indiaMatch[1])
    if (/\bUS\b|united states/i.test(city)) return 'US'
    if (city) return `${city}, India`
  }

  return null
}

const extractLocation = (jobData = {}) => (
  normalizeWhitespace(jobData?.Header?.Location)
  || inferLocationFromDescription(jobData?.Header?.DetailedDescription)
)

const inferCountry = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/india/i.test(normalized)) return 'India'
  if (/\bUS\b|united states/i.test(normalized)) return 'United States'
  return null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^\bUS\b$|^United States$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const joinLines = (values = []) => values
  .map((value) => normalizeWhitespace(value))
  .filter(Boolean)
  .join('\n')
  .trim() || null

const sectionText = (section = {}) => {
  const title = normalizeWhitespace(section?.Title)
  const body = joinLines(toArray(section?.Data))
  if (!title && !body) return null
  if (!title) return body
  if (!body) return title
  return `${title}:\n${body}`
}

const findSectionBody = (sections = [], titlePattern) => {
  const section = toArray(sections).find((item) => titlePattern.test(normalizeWhitespace(item?.Title) || ''))
  return joinLines(toArray(section?.Data))
}

export const extractSearchResults = (html) => parseNextData(html)
  .map((entry) => {
    const jobData = entry?.data || {}
    const title = normalizeWhitespace(jobData?.Header?.Title)
    const relativeUrl = normalizeWhitespace(entry?.url)
    const jobId = normalizeWhitespace(relativeUrl)?.split('/').filter(Boolean).at(-1) || null
    const location = extractLocation(jobData)
    const sourceUrl = relativeUrl ? buildJobUrl(relativeUrl) : null

    if (!title || !jobId || !location || !sourceUrl || !INDIA_LOCATION_PATTERN.test(location)) {
      return null
    }

    const sections = toArray(jobData?.CareerSection)

    return {
      title,
      company: 'Botminds',
      department: normalizeWhitespace(jobData?.Category),
      location,
      city: extractCity(location),
      country: inferCountry(location) || 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: normalizeWhitespace(jobData?.Header?.Description),
      minimumQualification: findSectionBody(sections, /requirements|desired qualifications/i),
      preferredQualification: findSectionBody(sections, /rewards/i),
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: joinLines([
        jobData?.Header?.DetailedDescription,
        jobData?.OverView?.Description,
        ...sections.map(sectionText),
      ]),
    }
  })
  .filter(Boolean)
  .sort((left, right) => left.title.localeCompare(right.title))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createBotmindsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    return runCurrentBotminds({ maxJobs, ...options })
  },
})

export const run = async (options = {}) => createBotmindsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Botminds scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'botminds')
    console.log('DB result:', result)
    process.exit(0)
  }
}
