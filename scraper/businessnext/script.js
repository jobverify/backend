import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import {
  BUSINESSNEXT_CATALOG,
  BUSINESSNEXT_CAREERS_HUB_URL,
  BUSINESSNEXT_CAREERS_URL,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BUSINESSNEXT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_HUB_URL = BUSINESSNEXT_CAREERS_HUB_URL
export const CAREERS_URL = BUSINESSNEXT_CAREERS_URL

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIAN_LOCATIONS = new Set(['Noida', 'Mumbai', 'Delhi', 'Bengaluru', 'Bangalore', 'Pune', 'Chennai'])

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersHubSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Unlimit Your Potential')
    && normalized.includes('Current Openings')
    && normalized.includes('Cloud / DevOps Roles')
  }

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Current Openings')
    && normalized.includes('Lead - DevOps')
    && normalized.includes('Manager- DataScience')
    && normalized.includes('Assistant Manager - .Net Core')
  }

const SECTION_TITLES = [
  'Cloud / DevOps Roles',
  'Global Operations',
  'Go-to-Market (GTM) & Strategy Roles',
  'Product Development / Engineering Roles',
  'Product Management & Design',
  'Techno-Functional Roles',
]

const extractSectionBlocks = (html = '') => {
  const page = String(html)
  const headingMatches = [...page.matchAll(/<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>/gi)]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      index: match.index ?? 0,
      length: match[0].length,
    }))
    .filter((match) => SECTION_TITLES.includes(match.title))

  return headingMatches.map((heading, index) => {
    const start = heading.index + heading.length
    const end = index + 1 < headingMatches.length ? headingMatches[index + 1].index : page.length
    const block = page.slice(start, end)
    const lines = [...block.matchAll(/<p[^>]*>\s*([\s\S]*?)\s*<\/p>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)

    return {
      title: heading.title,
      lines,
    }
  }).filter((section) => section.lines.length > 0)
}

const parseSectionRows = (section) => {
  return section.lines
    .filter((line) => !/^Job Role Location Experience Required Open Positions$/i.test(line))
    .flatMap((line) => {
      const matches = [...line.matchAll(
        /(.+?)\s+(Noida|Mumbai|Indonesia)\s+(\d+\s*-\s*\d+\s*years|\d+-\d+\s*years)\s+(\d+)/gi,
      )]
      return matches.map((match) => ({
        title: normalizeWhitespace(match[1]),
        location: normalizeWhitespace(match[2]),
        experienceRequired: normalizeWhitespace(match[3]),
        openings: Number(match[4]),
        department: section.title,
      }))
    })
}

const mapRowToJob = (row, now) => ({
  title: row.title,
  company: COMPANY,
  location: row.location,
  city: row.location,
  country: 'India',
  department: row.department,
  employmentType: null,
  experienceRequired: row.experienceRequired,
  jobId: toSlug(`${row.department}-${row.title}-${row.location}`),
  requisitionId: toSlug(`${row.title}-${row.location}`),
  sourceUrl: CAREERS_URL,
  applyUrl: CAREERS_URL,
  link: CAREERS_URL,
  jobDescription: `${row.department}. Open positions: ${row.openings}.`,
  source: SOURCE,
  scrapedAt: now(),
})

export const createBusinessnextScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHubHtml = await fetchText(CAREERS_HUB_URL)
    if (!hasOfficialCareersHubSignal(careersHubHtml)) {
      throw new Error('BUSINESSNEXT careers home no longer matches the verified first-party surface')
    }

    const currentOpeningsHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('BUSINESSNEXT current openings page no longer matches the verified first-party surface')
    }

    const rows = extractSectionBlocks(currentOpeningsHtml)
      .flatMap(parseSectionRows)
      .filter((row) => INDIAN_LOCATIONS.has(row.location))

    if (rows.length === 0) {
      throw new Error('BUSINESSNEXT current openings page no longer exposes trusted India job rows')
    }

    return rows
      .map((row) => mapRowToJob(row, now))
      .sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createBusinessnextScraper(options).run(options)

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
