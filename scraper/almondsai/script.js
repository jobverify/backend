import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ALMONDS_AI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ALMONDS_AI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const stripScriptsAndStyles = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (value) => decodeHtmlEntities(
  stripScriptsAndStyles(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|a)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractSectionLines = (lines, startLabels, endLabels) => {
  const startIndex = lines.findIndex((line) => startLabels.includes(line))
  if (startIndex < 0) return []

  const values = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endLabels.includes(line)) break
    values.push(line)
  }

  return values
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = (normalizeWhitespace(stripScriptsAndStyles(html)) || '').toLowerCase()

  return normalized.includes('collaboration, creativity, and innovation')
    && normalized.includes('open positions')
    && normalized.includes('automation tester')
    && normalized.includes('hireme@almonds.ai')
}

export const extractRoleSections = (html = '') => {
  const lines = htmlToLines(html)
  const applyUrl = String(html ?? '').match(/href=["'](mailto:[^"']*hireme@almonds\.ai[^"']*)["']/i)?.[1]
    || 'mailto:hireme@almonds.ai'
  const openPositionsIndex = lines.findIndex((line) => line === 'Open Positions')
  const scanLines = openPositionsIndex >= 0 ? lines.slice(openPositionsIndex + 1) : lines
  const sections = []

  for (let index = 0; index < scanLines.length - 1; index += 1) {
    if (scanLines[index + 1] !== 'Role Type : Full Time') continue

    const title = scanLines[index]
    const sectionLines = [title]

    for (let cursor = index + 1; cursor < scanLines.length; cursor += 1) {
      const line = scanLines[cursor]
      sectionLines.push(line)
      if (line === 'Apply Now') {
        index = cursor
        break
      }
    }

    sections.push({ title, lines: sectionLines, applyUrl })
  }

  return sections
}

export const extractJobFromRoleSection = (section, { scrapedAt } = {}) => {
  const title = normalizeWhitespace(section?.title)
  const lines = Array.isArray(section?.lines) ? section.lines : []
  const locationLine = lines.find((line) => line.startsWith('Location :'))
  const employmentLine = lines.find((line) => line.startsWith('Role Type :'))
  const location = normalizeWhitespace(locationLine?.replace(/^Location\s*:\s*/i, ''))
  const slug = slugify(title)

  if (!title || !slug) return null

  const minimumQualification = extractSectionLines(
    lines,
    ['Requirements:'],
    ['Skills-', 'Technical Knowledge:', 'Desired Candidate Profile', 'Note: Please add subject line before the email and send an email at hireme@almonds.ai', 'Apply Now'],
  )[0] || null

  const requiredSkills = [
    ...extractSectionLines(
      lines,
      ['Skills-'],
      ['Technical Knowledge:', 'Desired Candidate Profile', 'Note: Please add subject line before the email and send an email at hireme@almonds.ai', 'Apply Now'],
    ),
    ...extractSectionLines(
      lines,
      ['Technical Knowledge:'],
      ['Desired Candidate Profile', 'Note: Please add subject line before the email and send an email at hireme@almonds.ai', 'Apply Now'],
    ),
  ].filter(Boolean)

  const objectiveLines = extractSectionLines(
    lines,
    ['Objective of this role'],
    ['Key Responsibility', 'Key Responsibilities', 'Requirements:', 'Desired Candidate Profile', 'Apply Now'],
  )
  const responsibilityLines = extractSectionLines(
    lines,
    ['Key Responsibility', 'Key Responsibilities'],
    ['Requirements:', 'Skills-', 'Technical Knowledge:', 'Desired Candidate Profile', 'Apply Now'],
  )
  const desiredProfileLines = extractSectionLines(
    lines,
    ['Desired Candidate Profile'],
    ['Note: Please add subject line before the email and send an email at hireme@almonds.ai', 'Apply Now'],
  )

  return {
    title,
    company: COMPANY,
    department: null,
    location: location ? `${location}, India` : 'India',
    city: location || null,
    country: 'India',
    jobId: slug,
    requisitionId: slug,
    sourceUrl: `${CAREERS_URL}#${slug}`,
    applyUrl: section.applyUrl,
    employmentType: normalizeWhitespace(employmentLine?.replace(/^Role Type\s*:\s*/i, '')) || null,
    experienceRequired: null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace([
      objectiveLines[0],
      responsibilityLines[0],
      desiredProfileLines[0],
    ].filter(Boolean).join(' ')),
    remoteStatus: 'On-site',
    source: SOURCE,
    link: `${CAREERS_URL}#${slug}`,
    scrapedAt,
  }
}

export const createAlmondsAiScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Almonds Ai careers page no longer matches the trusted public surface')
    }

    const jobs = extractRoleSections(careersHtml)
      .map((section) => extractJobFromRoleSection(section, { scrapedAt: now() }))
      .filter(Boolean)

    if (jobs.length === 0) {
      throw new Error('The verified Almonds Ai careers page no longer exposes normalized public role sections')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAlmondsAiScraper().run(options)

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
