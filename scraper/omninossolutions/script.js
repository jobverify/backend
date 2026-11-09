import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'omninossolutions'
export const COMPANY = 'Omninos Solutions'
export const HOMEPAGE_URL = 'https://www.omninos.in/'
export const CAREERS_URL = 'https://omninos.in/current-opening.php'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Omninos',
  adapter: 'script',
  modulePath: '../../scraper/omninossolutions/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-first-party-role-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-page-role-card-list',
  extractionStrategy: 'verified-first-party-current-openings-page+same-page-role-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'omninos.in',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://omninos.in/current-opening.php was the live first-party Omninos current openings page and that it exposed public same-page role cards in Mohali, India including UI/UX Designer, Product Manager, Marketing Manager, Intern Android Developer, and Experienced Flutter Developer. Verified separately that the older first-party route https://www.omninos.in/career.php still showed stale 1st Jan, 2018 copy, so the scraper is pinned to the newer current-openings surface only.',
  dryRunFile: 'omninossolutions/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Current Job Openings at Omninos \| Grow Your Career With Us\s*<\/title>/i.test(page)
    && /Current Openings at Omninos for Technology and Digital Professionals/i.test(page)
    && /<span class="designation">/i.test(page)
    && /Mohali,\s*India/i.test(page)
}

export const extractRoles = (html = '') =>
  [...String(html ?? '').matchAll(
    /<span class="designation">([\s\S]*?)<\/span>\s*<span class="location">([\s\S]*?)<i class="fad fa-angle-right/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      location: normalizeWhitespace(match[2]),
    }))
    .filter((job) => job.title && job.location)

export const run = async ({
  fetchText = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
    return response.text()
  },
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Omninos Solutions verified current openings page changed materially')
  }

  const roles = extractRoles(careersHtml)
  if (!roles.length) {
    throw new Error('Omninos Solutions current openings page no longer exposes trusted public role cards')
  }

  return roles.map((role) => ({
    title: role.title,
    company: COMPANY,
    location: role.location,
    country: 'India',
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    link: CAREERS_URL,
    source: SOURCE,
    scrapedAt: now(),
    publicExperienceChecked: true,
  }))
}

export const runStandalone = async ({
  argv = process.argv,
  fetchText,
  now,
  saveToFile,
  saveToDB,
} = {}) => {
  const jobs = await run({
    ...(fetchText ? { fetchText } : {}),
    ...(now ? { now } : {}),
  })

  if (argv.includes('--dry-run')) {
    const writeJobsToFile = saveToFile
      ?? (await import('../../scraper-support/utils/saveToDB.js')).saveToFile
    writeJobsToFile(jobs, path.join(currentDir, 'jobs.json'))
    return jobs
  }

  const persistJobsToDb = saveToDB
    ?? (await import('../../scraper-support/utils/saveToDB.js')).saveToDB
  await persistJobsToDb(jobs, SOURCE)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runStandalone()
}

