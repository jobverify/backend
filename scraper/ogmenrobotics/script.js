import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ogmenrobotics'
export const COMPANY = 'Ogmen Robotics'
export const COMPANY_DOMAIN = 'ogmenrobotics.com'
export const HOMEPAGE_URL = 'https://www.ogmenrobotics.com/'
export const CAREERS_URL = 'https://www.ogmenrobotics.com/careers'
export const DETAIL_BASE_URL = 'https://www.ogmenrobotics.com/job'
export const CURRENT_OPENINGS_URL =
  'https://s3.amazonaws.com/cdn.s3.webcontentor.com/OFFICE/OGMEN01/site_design/data/currentOpening.json'
export const ATS_PLATFORM = 'official-company-careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|delhi|new delhi)\b/i
const NON_INDIA_LOCATION_PATTERN = /\b(?:usa|united states|america)\b/i

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/Â/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const slugify = (value) =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null

const normalizeKey = (value) =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '') || null

const normalizeEmploymentType = (value) =>
  normalizeWhitespace(value)
    ?.replace(/-/g, ' ')
    .replace(/\b([a-z])/g, (match) => match.toUpperCase()) || null

const normalizeLocationKey = (value) =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/\bnew\s+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() || null

const isIndiaRole = ({ listedLocation, detailLocation }) => {
  const listed = normalizeWhitespace(listedLocation) || ''
  const detail = normalizeWhitespace(detailLocation) || ''
  const haystack = `${listed} ${detail}`.trim()

  if (!haystack) return false
  if (NON_INDIA_LOCATION_PATTERN.test(haystack)) return false

  return INDIA_LOCATION_PATTERN.test(haystack)
}

const locationsMatch = (listedLocation, detailLocation) => {
  const listedKey = normalizeLocationKey(listedLocation)
  const detailKey = normalizeLocationKey(detailLocation)

  if (!listedKey || !detailKey) return false
  return listedKey === detailKey || listedKey.includes(detailKey) || detailKey.includes(listedKey)
}

const buildDetailUrl = ({ categoryId, openingId }) =>
  `${DETAIL_BASE_URL}?category=${encodeURIComponent(categoryId)}&opening=${encodeURIComponent(openingId)}`

const formatIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  return /india$/i.test(location) ? location : `${location}, India`
}

const toState = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'new delhi' || normalized === 'delhi') return 'Delhi'
  return null
}

const buildJobDescription = (opening) => {
  const sections = []
  const workItems = Array.isArray(opening?.work)
    ? opening.work.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : []
  const lookingForItems = Array.isArray(opening?.lookingFor)
    ? opening.lookingFor.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : []

  if (workItems.length > 0) {
    sections.push(`Technicals:\n${workItems.map((item) => `- ${item}`).join('\n')}`)
  }

  if (lookingForItems.length > 0) {
    sections.push(`What you'll be doing:\n${lookingForItems.map((item) => `- ${item}`).join('\n')}`)
  }

  return sections.join('\n\n') || null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Ogmen Robotics\s*<\/title>/i.test(page)
    && /href=["']\/careers["']/i.test(page)
    && text.includes('At Ogmen, we are building the next-generation family robots to serve with the care we all seek!')
    && text.includes('contact@ogmenrobotics.com')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers\s*\|\s*Ogmen Robotics\s*<\/title>/i.test(page)
    && /href=["']#joblistings["']/i.test(page)
    && /<section class=["']job-listing[^"']*["'][^>]*id=["']joblistings["']/i.test(page)
    && /loadJob\('engineering',\s*'[^']+'\)/i.test(page)
    && text.includes('We are a distributed, diverse team scattered across India and America.')
    && text.includes('contact@ogmenrobotics.com')
}

export const hasDetailApplySurfaceSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Jobs\s*\|\s*Ogmen Robotics\s*<\/title>/i.test(page)
    && /href=["']\/careers#joblistings["']/i.test(page)
    && /id=["']job-application-form["'][^>]*action=["']\/ogmen-job-apply["']/i.test(page)
    && /id=["']job-application-form-job-category["']/i.test(page)
    && /id=["']job-application-form-job-opening["']/i.test(page)
    && text.includes('Resume/CV*')
    && page.includes(CURRENT_OPENINGS_URL)
}

export const extractCareerRoleCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Ogmen Robotics verified first-party careers page no longer matches the trusted public jobs surface')
  }

  const blocks = String(html ?? '').split(/<div class="job-business">/i).slice(1)
  const roles = []

  for (const block of blocks) {
    const department = normalizeWhitespace(block.match(/<h5>([\s\S]*?)<\/h5>/i)?.[1])
    if (!department) continue

    for (const match of block.matchAll(
      /<div class="job-title-container"[^>]*onclick="loadJob\('([^']+)',\s*'([^']+)'\)"[\s\S]*?<span class="role">([\s\S]*?)<\/span>[\s\S]*?<span class="location">([\s\S]*?)<\/span>[\s\S]*?<span class="duration">([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi,
    )) {
      const [, categoryId, openingId, title, listedLocation, listedEmploymentType] = match
      const normalizedTitle = normalizeWhitespace(title)

      if (!categoryId || !openingId || !normalizedTitle) {
        throw new Error('Ogmen Robotics verified careers role cards changed shape')
      }

      roles.push({
        categoryId,
        openingId,
        department,
        title: normalizedTitle,
        listedLocation: normalizeWhitespace(listedLocation),
        listedEmploymentType: normalizeEmploymentType(listedEmploymentType),
      })
    }
  }

  if (roles.length === 0) {
    throw new Error('Ogmen Robotics verified careers page no longer exposes public role cards')
  }

  return roles
}

const buildOpeningsLookup = (payload) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('Ogmen Robotics verified current openings feed no longer exposes categories')
  }

  const lookup = new Map()

  for (const category of payload) {
    const categoryId = normalizeWhitespace(category?.id)
    const positions = Array.isArray(category?.positions) ? category.positions : null

    if (!categoryId || !positions) {
      throw new Error('Ogmen Robotics verified current openings feed changed shape')
    }

    for (const position of positions) {
      const openingId = normalizeWhitespace(position?.id)
      if (!openingId) {
        throw new Error('Ogmen Robotics verified current openings feed contains a position without an id')
      }

      lookup.set(`${categoryId}:${openingId}`, position)
    }
  }

  return lookup
}

const buildIndiaJobs = ({ careerRoles, openingsLookup }) => {
  const jobs = []

  for (const role of careerRoles) {
    const opening = openingsLookup.get(`${role.categoryId}:${role.openingId}`)
    if (!opening) {
      throw new Error(`Ogmen Robotics verified current openings feed no longer includes ${role.title}`)
    }

    const detailTitle = normalizeWhitespace(opening.position)
    const detailLocation = normalizeWhitespace(opening.location)
    const employmentType = normalizeEmploymentType(opening.basedOn || role.listedEmploymentType)

    if (normalizeKey(detailTitle) !== normalizeKey(role.title)) {
      throw new Error(`Ogmen Robotics verified current openings feed no longer matches the listed ${role.title} role`)
    }

    if (!locationsMatch(role.listedLocation, detailLocation)) {
      throw new Error(`Ogmen Robotics verified current openings feed no longer matches the listed location for ${role.title}`)
    }

    if (employmentType !== role.listedEmploymentType) {
      throw new Error(`Ogmen Robotics verified current openings feed no longer matches the listed employment type for ${role.title}`)
    }

    if (!isIndiaRole({ listedLocation: role.listedLocation, detailLocation })) {
      continue
    }

    const jobId = `${SOURCE}-${slugify(role.title)}`
    if (!jobId) {
      throw new Error(`Ogmen Robotics verified ${role.title} role no longer exposes a stable identifier`)
    }

    jobs.push({
      title: role.title,
      company: COMPANY,
      department: role.department,
      location: formatIndiaLocation(detailLocation),
      city: detailLocation,
      state: toState(detailLocation),
      country: 'India',
      jobId,
      requisitionId: role.openingId,
      sourceUrl: buildDetailUrl(role),
      applyUrl: buildDetailUrl(role),
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: Array.isArray(opening.work)
        ? opening.work.map((item) => normalizeWhitespace(item)).filter(Boolean)
        : [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(opening),
      remoteStatus: normalizeWhitespace(opening.onPreference),
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createOgmenRoboticsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Ogmen Robotics verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const careerRoles = extractCareerRoleCards(careersHtml)
    const openingsLookup = buildOpeningsLookup(await fetchJson(CURRENT_OPENINGS_URL))
    const jobs = buildIndiaJobs({ careerRoles, openingsLookup })

    if (jobs.length > 0) {
      const detailHtml = await fetchText(jobs[0].sourceUrl)
      if (!hasDetailApplySurfaceSignal(detailHtml)) {
        throw new Error('Ogmen Robotics verified first-party detail apply surface no longer matches the trusted contract')
      }
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createOgmenRoboticsScraper().run(options)

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
