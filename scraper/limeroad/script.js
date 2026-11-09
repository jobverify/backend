import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { LIMEROAD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = LIMEROAD_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ROLE_URLS = PROVIDER_METADATA.verifiedRoleUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toTextLines = (html = '') => decodeHtml(String(html ?? ''))
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n• ')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const stripBulletPrefix = (value) => normalizeWhitespace(
  String(value ?? '').replace(/^[•\-]+\s*/u, ''),
)

const extractLineValue = (line, prefix) => normalizeWhitespace(
  String(line ?? '').replace(prefix, ''),
)

const findLineIndex = (lines, pattern, startIndex = -1) =>
  lines.findIndex((line, index) => index > startIndex && pattern.test(line))

const collectSectionLines = (lines, startIndex, stopPatterns = []) => {
  const items = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (stopPatterns.some((pattern) => pattern.test(line))) break
    if (/^Job Description -$/i.test(line)) continue

    const item = stripBulletPrefix(line)
    if (item) items.push(item)
  }

  return items
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const lines = toTextLines(html)

  return lines.includes('careers')
    && lines.some((line) => /^Department - Customer Support$/i.test(line))
    && lines.some((line) => /^Designation - Customer Support Representative$/i.test(line))
    && lines.some((line) => /^Desired Candidate Profile -$/i.test(line))
    && lines.some((line) => /^Education - Any Graduate - Any Specialization$/i.test(line))
}

export const extractRoleBlocks = (html = '') => {
  const lines = toTextLines(html)
  const roleStartIndexes = lines
    .map((line, index) => (/^Department - /i.test(line) ? index : -1))
    .filter((index) => index >= 0)

  return roleStartIndexes.map((startIndex, roleIndex) => {
    const nextStartIndex = roleStartIndexes[roleIndex + 1] ?? lines.length
    const pageBoundaryIndex = lines.findIndex(
      (line, index) => index >= startIndex && /^Limeroad is Offered in:/i.test(line),
    )
    const endIndex = pageBoundaryIndex >= 0
      ? Math.min(nextStartIndex, pageBoundaryIndex)
      : nextStartIndex
    const segment = lines.slice(startIndex, endIndex)

    const department = extractLineValue(segment[0], /^Department -\s*/i)
    const designationIndex = findLineIndex(segment, /^Designation - /i)
    const firstDescriptionIndex = findLineIndex(segment, /^Job Description -$/i, designationIndex)
    const desiredProfileIndex = findLineIndex(segment, /^Desired Candidate Profile -$/i, firstDescriptionIndex)
    const educationIndex = findLineIndex(segment, /^Education - /i, desiredProfileIndex)
    const secondDescriptionIndex = findLineIndex(segment, /^Job Description -$/i, educationIndex)
    const title = extractLineValue(segment[designationIndex], /^Designation -\s*/i)
    const minimumQualification = extractLineValue(segment[educationIndex], /^Education -\s*/i)
    const jobDescription = normalizeWhitespace(
      collectSectionLines(segment, firstDescriptionIndex, [
        /^Desired Candidate Profile -$/i,
        /^Department - /i,
      ]).join(' '),
    )
    const requiredSkills = collectSectionLines(segment, secondDescriptionIndex, [
      /^Department - /i,
      /^Limeroad is Offered in:/i,
    ])

    if (
      !department
      || !title
      || !minimumQualification
      || !jobDescription
      || requiredSkills.length === 0
    ) {
      return null
    }

    return {
      department,
      title,
      minimumQualification,
      experienceRequired: null,
      location: null,
      city: null,
      country: null,
      jobDescription,
      requiredSkills,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
    }
  }).filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createLimeRoadScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('LimeRoad careers page no longer matches the verified first-party role shell')
    }

    const roles = extractRoleBlocks(careersHtml)
    if (roles.length === 0) {
      throw new Error('LimeRoad careers page no longer matches the verified first-party role shell')
    }

    const selectedRoles = maxJobs ? roles.slice(0, maxJobs) : roles
    const scrapedAt = now()

    return selectedRoles.map((role) => {
      const slug = slugify(role.title)
      if (!slug) {
        throw new Error('LimeRoad careers page no longer matches the verified first-party role shell')
      }

      return {
        title: role.title,
        company: COMPANY,
        department: role.department,
        location: role.location,
        city: role.city,
        country: role.country,
        jobId: `${SOURCE}-${slug}`,
        requisitionId: `${SOURCE}-${slug}`,
        sourceUrl: role.sourceUrl,
        applyUrl: role.applyUrl,
        employmentType: null,
        experienceRequired: role.experienceRequired,
        minimumQualification: role.minimumQualification,
        preferredQualification: null,
        requiredSkills: role.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: role.jobDescription,
        remoteStatus: null,
        source: SOURCE,
        link: role.applyUrl,
        scrapedAt,
      }
    })
  },
})

export const run = async (options = {}) => createLimeRoadScraper().run(options)

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
