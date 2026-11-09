import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'manastuspace'
export const COMPANY = 'Manastu Space'
export const HOMEPAGE_URL = 'https://manastuspace.com/'
export const CAREERS_URL = 'https://manastuspace.com/careers'
export const COMPANY_DOMAIN = 'manastuspace.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))
const hasCareersLink = (html) =>
  /href=["'](?:https:\/\/manastuspace\.com)?\/careers\/?["']/i.test(String(html ?? ''))

const slugify = (value) => stripTags(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /manastu space/i.test(text)
    && /green propulsion/i.test(text)
    && /debris collision avoidance/i.test(text)
    && hasCareersLink(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /careers at manastu space/i.test(text)
    && /careers@manastuspace\.com/i.test(text)
    && /navi mumbai/i.test(text)
    && /full\s*time/i.test(text)
}

const SECTION_PATTERN = /<section\b[^>]*>([\s\S]*?)<\/section>/gi
const HEADING_PATTERN = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i
const JOB_LINK_PATTERN = /mailto:careers@manastuspace\.com/i
const OPEN_ROLE_TITLE_PATTERN = /<div[^>]*class="heading-style-h5[^"]*"[^>]*>([\s\S]*?)<\/div>/gi

const parseLocation = (value) => {
  const normalized = stripTags(value)
  if (!normalized) return { location: null, city: null, state: null, country: null }

  if (/navi mumbai/i.test(normalized)) {
    return {
      location: 'Navi Mumbai, Maharashtra, India',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      country: 'India',
    }
  }

  if (normalized.length > 120) {
    return { location: null, city: null, state: null, country: null }
  }

  return {
    location: normalized,
    city: normalized,
    state: null,
    country: 'India',
  }
}

const extractSectionText = (sectionHtml) => {
  const withoutHeading = String(sectionHtml ?? '').replace(HEADING_PATTERN, ' ')
  return stripTags(withoutHeading)
}

const extractHeading = (sectionHtml) => {
  const headingMatch = String(sectionHtml ?? '').match(HEADING_PATTERN)
  return stripTags(headingMatch?.[1])
}

const extractApplyUrl = (sectionHtml, title) => {
  const page = String(sectionHtml ?? '')
  if (JOB_LINK_PATTERN.test(page)) {
    return `mailto:careers@manastuspace.com?subject=${encodeURIComponent(title)}`
  }
  return CAREERS_URL
}

const buildJob = ({
  title,
  location,
  employmentType,
  applyUrl,
  experienceRequired,
  jobDescription,
  publicExperienceChecked = false,
}) => ({
  title,
  company: COMPANY,
  ...location,
  jobId: `manastuspace-${slugify(title)}-${slugify(location.city || location.location)}`,
  requisitionId: null,
  sourceUrl: CAREERS_URL,
  applyUrl,
  department: null,
  employmentType,
  experienceRequired: experienceRequired || null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: jobDescription || null,
  publicExperienceChecked,
})

const extractExperienceRequired = (value) => {
  const experienceProfile = extractJobFilterSignals({
    description: stripTags(value),
  })?.experienceProfile
  const evidence = stripTags(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const extractOpenRoleCardJobs = (html) => {
  const page = String(html ?? '')
  const titleMatches = [...page.matchAll(OPEN_ROLE_TITLE_PATTERN)]
  const jobs = []

  for (let index = 0; index < titleMatches.length; index += 1) {
    const match = titleMatches[index]
    const nextMatch = titleMatches[index + 1]
    const block = page.slice(match.index, nextMatch?.index ?? page.length)
    const title = stripTags(match[1])
    const employmentType = /full\s*time/i.test(
      stripTags(block.match(/class="text-size-small text-weight-medium text-size">([\s\S]*?)<\/div>/i)?.[1]),
    )
      ? 'Full-time'
      : null
    const location = parseLocation(
      block.match(/class="text-size-small text-weight-medium">([\s\S]*?)<\/div>/i)?.[1],
    )
    const applyUrl = stripTags(block.match(/href="(mailto:careers@manastuspace\.com[^"]*)"/i)?.[1])
      || `mailto:careers@manastuspace.com?subject=${encodeURIComponent(title)}`
    const detailsHtml = block.match(/class="[^"]*w-richtext[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
    const jobDescription = stripTags(detailsHtml)
    const experienceRequired = extractExperienceRequired(jobDescription)

    if (!title || !location.location) continue

    jobs.push(buildJob({
      title,
      location,
      employmentType,
      applyUrl,
      experienceRequired,
      jobDescription,
      publicExperienceChecked: Boolean(jobDescription) && !experienceRequired,
    }))
  }

  return jobs
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Manastu Space verified first-party careers page no longer matches the known public surface')
  }

  const page = String(html ?? '')
  const cardJobs = extractOpenRoleCardJobs(page)
  if (cardJobs.length > 0) {
    return cardJobs.sort((left, right) => left.title.localeCompare(right.title))
  }

  const jobs = []

  for (const match of page.matchAll(SECTION_PATTERN)) {
    const sectionHtml = match[1]
    const title = extractHeading(sectionHtml)
    if (!title) continue

    const sectionText = extractSectionText(sectionHtml)
    const location = parseLocation(sectionText)
    const employmentType = /full\s*time/i.test(sectionText) ? 'Full-time' : null

    if (!location.location) continue

    const applyUrl = extractApplyUrl(sectionHtml, title)

    jobs.push(buildJob({
      title,
      location,
      employmentType,
      applyUrl,
    }))
  }

  if (jobs.length === 0) {
    throw new Error('Manastu Space verified careers surface no longer exposes structured openings')
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createManastuSpaceScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Manastu Space verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createManastuSpaceScraper().run(options)

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
