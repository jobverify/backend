import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'theenergycompany'
export const COMPANY = 'The ENERGY COMPANY'
export const HOMEPAGE_URL = 'https://www.energycompany.in/'
export const CAREERS_URL = 'https://www.energycompany.in/we-are-hiring'
export const APPLY_URL = 'https://www.energycompany.in/contact-us'
export const MISSING_ROUTE_URLS = [
  'https://www.energycompany.in/careers',
  'https://www.energycompany.in/jobs',
]
export const EXPECTED_ROLE_TITLES = [
  'Hardware Design Engineer',
  'Embedded Software Engineer',
  'Full Stack Developer',
  'Backend Developer',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KARNATAKA_ALIASES = new Set(['ka', 'karnataka'])

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
    .replace(/&middot;/gi, '·')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[•●]/g, '·')
    .replace(/[📍]/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p|li|h[1-6]|section)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*The Intelligent Storage Layer\s*\|\s*The Energy Company\s*<\/title>/i.test(page)
    && /The Energy Company builds intelligent battery infrastructure for India/i.test(page)
    && normalized.includes('the energy company')
  }

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.energycompany\.in)?\/we-are-hiring["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''
  const hasAllExpectedRoles = EXPECTED_ROLE_TITLES.every((title) => page.includes(title))

  return /<title>\s*We are hiring\s*<\/title>/i.test(page)
    && normalized.includes('open roles')
    && normalized.includes('full-time roles with real scope')
    && hasAllExpectedRoles
    && /href=["']https:\/\/www\.energycompany\.in\/contact-us["']/i.test(page)
  }

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return Number(status) === 404
    && /<title>\s*Not Found\s*<\/title>/i.test(page)
    && normalized.includes('page not found')
    && normalized.includes("the page you are looking for doesn't exist or has been moved")
  }

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { location: 'India', city: null }

  const cleaned = normalized
    .replace(/^[-·]+/, '')
    .replace(/^[^A-Za-z]+/, '')
    .replace(/\s*·\s*Full-time$/i, '')
    .trim()
  const [cityPart, statePart] = cleaned.split(',').map((part) => normalizeWhitespace(part))
  const city = cityPart || null
  const stateKey = (statePart || '').toLowerCase()
  const state = KARNATAKA_ALIASES.has(stateKey) ? 'Karnataka' : statePart

  if (city && state) {
    return {
      city,
      location: `${city}, ${state}, India`,
    }
  }

  if (city) {
    return {
      city,
      location: `${city}, India`,
    }
  }

  return {
    city: null,
    location: 'India',
  }
}

const extractRoleBlocks = (html) => Array.from(
  String(html ?? '').matchAll(
    /<div class="role-card" id="role-[^"]+">([\s\S]*?)(?=<div class="role-card" id="role-[^"]+">|document\.querySelectorAll\('\.why-card,\.role-card'\)|<\/body>|$)/gi,
  ),
  ([, block]) => block,
)

export const extractListings = (html) => extractRoleBlocks(html).flatMap((block) => {
  const department = normalizeWhitespace(block.match(/<div class="role-dept">([\s\S]*?)<\/div>/i)?.[1])
  const title = normalizeWhitespace(block.match(/<div class="role-title">([\s\S]*?)<\/div>/i)?.[1])
  const rawLocation = stripTags(block.match(/<div class="role-loc">([\s\S]*?)<\/div>/i)?.[1])
  const applyUrl = normalizeWhitespace(block.match(/<a href="([^"]+)" class="role-apply-btn"/i)?.[1])
  const rolePoints = Array.from(
    block.matchAll(/<div class="role-point">([\s\S]*?)<\/div>/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)
  const { city, location } = normalizeLocation(rawLocation)
  const jobId = slugify(`${department || 'role'}-${title || ''}`)

  if (!department || !title || !applyUrl || !jobId || rolePoints.length === 0) {
    return []
  }

  return [{
    title,
    company: COMPANY,
    department,
    location,
    city,
    country: 'India',
    jobId: `${SOURCE}-${jobId}`,
    requisitionId: `${SOURCE}-${jobId}`,
    sourceUrl: CAREERS_URL,
    applyUrl,
    link: applyUrl,
    companyCareerPage: CAREERS_URL,
    companyDomain: 'energycompany.in',
    atsPlatform: 'official-company-careers',
    employmentType: /full-time/i.test(rawLocation || '') ? 'Full-time' : null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: rolePoints.join(' '),
  }]
})

export const createTheEnergyCompanyScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('The ENERGY COMPANY official homepage no longer matches the verified first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('The ENERGY COMPANY homepage no longer links to the verified first-party careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('The ENERGY COMPANY verified first-party careers surface no longer matches the expected public roles')
    }

    const listings = extractListings(careersPage.html)
    if (listings.length !== EXPECTED_ROLE_TITLES.length) {
      throw new Error('The ENERGY COMPANY verified first-party careers surface changed its expected public roles')
    }

    const extractedTitles = listings.map((job) => job.title)
    if (JSON.stringify(extractedTitles) !== JSON.stringify(EXPECTED_ROLE_TITLES)) {
      throw new Error('The ENERGY COMPANY verified first-party careers surface changed its expected public roles')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)
      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('The ENERGY COMPANY missing careers routes changed materially')
      }
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings

    return selectedListings.map((job) => ({
      ...job,
      source: SOURCE,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createTheEnergyCompanyScraper().run(options)

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
