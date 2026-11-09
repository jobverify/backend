import path from 'node:path'
import { fileURLToPath } from 'node:url'

import TANISHA_SYSTEMS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = TANISHA_SYSTEMS_CATALOG.source
export const COMPANY = TANISHA_SYSTEMS_CATALOG.companyName
export const CAREERS_URL = TANISHA_SYSTEMS_CATALOG.companyCareerPage
export const VERIFIED_ON = TANISHA_SYSTEMS_CATALOG.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const htmlToLines = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

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

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parseOpeningsCount = (value) => {
  const match = String(value ?? '').match(/(\d+)\s+Openings?/i)
  return match ? Number.parseInt(match[1], 10) : null
}

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')
  return code === 'UND_ERR_CONNECT_TIMEOUT' || /connect timeout/i.test(message)
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Current Openings - Tanisha Systems Inc\.\s*<\/title>/i.test(page)
    && text.includes('Current Openings')
    && text.includes('You can view our most current openings below on this page.')
}

export const extractCurrentOpenings = (html = '') => Array.from(
  String(html ?? '').matchAll(/<section\b[^>]*class=["'][^"']*opening[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi),
  (match) => {
    const section = match[1]
    const title = stripTags(section.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1])
    const openingsCount = parseOpeningsCount(stripTags(section.match(/<p>([\s\S]*?Openings[\s\S]*?)<\/p>/i)?.[1]))
    const detailLocationLine = Array.from(
      section.matchAll(/<p>([\s\S]*?)<\/p>/gi),
      (lineMatch) => stripTags(lineMatch[1]),
    ).find((line) => /^Job Locations:/i.test(line))
    const jobId = slugify(title)

    return {
      title,
      location: normalizeWhitespace(String(detailLocationLine ?? '').replace(/^Job Locations:\s*/i, '')),
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      jobId,
      openingsCount,
    }
  },
).filter((job) => job.title && job.location && job.jobId)

const isPotentialOpeningTitle = (line = '', nextLines = []) => {
  const value = String(line ?? '')

  if (!value) return false
  if (/^\d/.test(value)) return false
  if (/^(?:current openings|work with us|apply now|click to explore this job)$/i.test(value)) return false
  if (/^(?:date|start date|job locations?|field of study|salary|benefits):/i.test(value)) return false
  if (/\bopenings?\b/i.test(value)) return false
  if (/\b(?:suite|avenue|ave\.?|street|st\.?|road|rd\.?|drive|dr\.?|boulevard|blvd|lane|ln\.?)\b/i.test(value)) return false

  return nextLines.some((nextLine) => parseOpeningsCount(nextLine) != null)
}

const extractInlineCurrentOpenings = (html = '') => {
  const lines = htmlToLines(html)
  const titleIndexes = []

  for (let index = 0; index < lines.length; index += 1) {
    if (isPotentialOpeningTitle(lines[index], lines.slice(index + 1, index + 5))) {
      titleIndexes.push(index)
    }
  }

  return titleIndexes.map((startIndex, titleIndex) => {
    const endIndex = titleIndexes[titleIndex + 1] ?? lines.length
    const block = lines.slice(startIndex, endIndex)
    const title = block[0]
    const openingsCount = block.map((line) => parseOpeningsCount(line)).find((value) => value != null) ?? null
    const detailLocationLine = block.find((line) => /^Job Locations:/i.test(line))
    const summaryLocation = block.slice(1, 4).find((line) =>
      /(?:\b[A-Z]{2}\b|U\.S\.|relocation possible|client sites)/i.test(line),
    )
    const location = normalizeWhitespace(String(detailLocationLine ?? summaryLocation ?? '').replace(/^Job Locations:\s*/i, ''))
    const jobId = slugify([title, location].filter(Boolean).join(' '))

    return {
      title,
      location,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      jobId,
      openingsCount,
    }
  }).filter((job) => job.title && job.location && job.jobId)
}

export const createTanishaSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    try {
      const html = await fetchText(CAREERS_URL)
      if (!hasOfficialCurrentOpeningsSignal(html)) {
        throw new Error('The verified Tanisha Systems current openings page no longer matches the trusted first-party surface')
      }

      const openings = extractCurrentOpenings(html)
      const normalizedOpenings = openings.length > 0 ? openings : extractInlineCurrentOpenings(html)
      if (normalizedOpenings.length === 0) {
        throw new Error('Tanisha Systems current openings page no longer exposes trusted public openings')
      }

      return normalizedOpenings.map((opening) => ({
        title: opening.title,
        company: COMPANY,
        department: null,
        location: opening.location,
        city: null,
        country: 'United States',
        jobId: opening.jobId,
        requisitionId: opening.jobId,
        sourceUrl: opening.sourceUrl,
        applyUrl: opening.sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: opening.sourceUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: TANISHA_SYSTEMS_CATALOG.companyDomain,
        atsPlatform: TANISHA_SYSTEMS_CATALOG.atsPlatform,
        openingsCount: opening.openingsCount,
      }))
    } catch (error) {
      if (hasConnectTimeoutFailure(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createTanishaSystemsScraper(options).run(options)

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
