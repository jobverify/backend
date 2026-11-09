import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SATTRIX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ROLE_START_LABELS = new Set(['Training Location', 'Job Location', 'Experience', 'Department'])
const SECTION_LABELS = new Set([
  'Training Location',
  'Job Location',
  'Experience',
  'Department',
  'Job description',
  'Education and skills',
  'Experience Tools and Technology',
  'Achievements',
  'Responsibilities',
])

export const PROVIDER_METADATA = SATTRIX_CATALOG
export const SOURCE = SATTRIX_CATALOG.source
export const COMPANY = SATTRIX_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SATTRIX_CATALOG.officialBrandName
export const VERIFIED_ON = SATTRIX_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SATTRIX_CATALOG.verifiedSurfaceSummary
export const CAREER_PAGE_URL = SATTRIX_CATALOG.officialCareersPageUrl
export const APPLICATION_FORM_URL = SATTRIX_CATALOG.applicationFormUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const htmlToLines = (html = '') =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h1|h2|h3|h4|h5|h6|p|div|section|article|main|li|ul|ol)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const isIndiaLocation = (value) => /\bindia\b/i.test(String(value ?? ''))

const isRoleTitle = (lines, index) => {
  const current = lines[index]
  const next = lines[index + 1]

  return Boolean(
    current
      && next
      && !SECTION_LABELS.has(current)
      && !/\?$/.test(current)
      && next === 'Training Location',
  )
}

const buildSections = (lines) => {
  const sections = {}
  let currentLabel = null

  for (const line of lines) {
    if (SECTION_LABELS.has(line)) {
      currentLabel = line
      sections[currentLabel] = []
      continue
    }

    if (currentLabel) {
      sections[currentLabel].push(line)
    }
  }

  return sections
}

const extractRoleBlocks = (html = '') => {
  const lines = htmlToLines(html)
  const startIndex = lines.findIndex((line) => line === 'Current Openings')
  if (startIndex === -1) return []

  const endIndex = lines.findIndex((line, index) => index > startIndex && /Couldn't find the job you are looking for\?/i.test(line))
  const content = lines.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex)
  const blocks = []

  for (let index = 0; index < content.length; index += 1) {
    if (!isRoleTitle(content, index)) continue

    const start = index
    let end = content.length

    for (let nextIndex = index + 1; nextIndex < content.length; nextIndex += 1) {
      if (isRoleTitle(content, nextIndex)) {
        end = nextIndex
        break
      }
    }

    blocks.push(content.slice(start, end))
    index = end - 1
  }

  return blocks
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /\banywhere in india\b/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const blockToJob = (block) => {
  const title = normalizeWhitespace(block[0])
  if (!title) return null

  const sections = buildSections(block.slice(1))
  const location = normalizeLocation(sections['Job Location']?.join(' '))
  if (!location || !isIndiaLocation(location)) return null

  const jobId = slugify(title)
  const sourceUrl = `${CAREER_PAGE_URL}#${jobId}`
  const descriptionSections = [
    ...(sections['Job description'] || []),
    ...(sections['Experience Tools and Technology'] || []),
    ...(sections.Achievements || []),
    ...(sections.Responsibilities || []),
  ]

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(sections.Department?.join(' ')) || null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: normalizeWhitespace(sections.Experience?.join(' ')) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: (sections['Education and skills'] || []).map((item) => normalizeWhitespace(item)).filter(Boolean),
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(descriptionSections.join(' ')) || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

export const hasOfficialSattrixCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const lines = htmlToLines(page)
  const text = lines.join(' ')

  return /<title[^>]*>\s*Grow Your Career in Cybersecurity \| Sattrix InfoSec\s*<\/title>/i.test(page)
    && text.includes('Join Our Team')
    && text.includes('Career Opportunities with Us!')
    && text.includes('Current Openings')
    && text.includes('Cybersecurity Associate')
}

export const extractApplicationFormUrl = (html = '') =>
  toAbsoluteUrl(
    String(html ?? '').match(/https:\/\/docs\.google\.com\/forms\/d\/e\/[a-zA-Z0-9_-]+\/viewform\?usp=sf_link/i)?.[0],
    CAREER_PAGE_URL,
  )

export const extractSearchResults = (html = '') =>
  extractRoleBlocks(html)
    .map((block) => blockToJob(block))
    .filter(Boolean)

export const createSattrixScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSattrixCareersSignal(careersHtml)) {
      throw new Error('The verified official careers page changed materially for Sattrix')
    }

    const jobs = extractSearchResults(careersHtml)
    if (jobs.length === 0) {
      throw new Error('The verified official careers page no longer exposes public Sattrix role sections')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSattrixScraper().run(options)

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
