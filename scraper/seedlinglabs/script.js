import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'seedlinglabs'
export const COMPANY = 'Seedling Labs'
export const HOMEPAGE_URL = 'https://seedlinglabs.com/'
export const CAREERS_URL = 'https://seedlinglabs.com/careers'
export const APPLY_URL = 'mailto:info@seedlinglabs.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LOCATION_META = {
  bengaluru: {
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
  },
  gangavathi: {
    city: 'Gangavathi',
    state: 'Karnataka',
    country: 'India',
  },
}

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const buildLocation = (locationText) => {
  const normalizedKey = normalizeWhitespace(locationText)?.toLowerCase()
  const meta = normalizedKey ? LOCATION_META[normalizedKey] : null

  if (!meta) {
    const fallbackLocation = normalizeWhitespace(locationText)
    return {
      location: fallbackLocation ? `${fallbackLocation}, India` : 'India',
      city: fallbackLocation,
      state: null,
      country: 'India',
    }
  }

  return {
    location: `${meta.city}, ${meta.state}, ${meta.country}`,
    city: meta.city,
    state: meta.state,
    country: meta.country,
  }
}

const buildJobDescription = ({
  title,
  department,
  location,
  employmentType,
}) => [
  `${COMPANY} is hiring for ${title}.`,
  department ? `Team: ${department}.` : null,
  location ? `Location: ${location}.` : null,
  employmentType ? `Type: ${employmentType}.` : null,
  'Apply via the official Seedling Labs careers page or the listed company email.',
]
  .filter(Boolean)
  .join(' ')

const collectRoleMatches = (bundleText) => [...String(bundleText ?? '').matchAll(
  /\{role:`([^`]+)`,team:`([^`]+)`,location:`([^`]+)`,type:`([^`]+)`\}/g,
)]

export const hasOfficialSiteShellSignal = (html) => {
  const page = String(html ?? '')

  return /<meta[^>]+name=["']description["'][^>]+content=["']SeedlingLabs builds AI-native products that transform how teams develop, test, and teach\./i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']SeedlingLabs["']/i.test(page)
    && /"@type"\s*:\s*"Organization"/i.test(page)
    && /"name"\s*:\s*"SeedlingLabs"/i.test(page)
    && /"url"\s*:\s*"https:\/\/seedlinglabs\.com"/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
    && /<script[^>]+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["']/i.test(page)
}

export const extractBundleAssetPath = (html) =>
  String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["'](\/assets\/index-[^"']+\.js)["']/i,
  )?.[1] ?? null

export const hasOfficialCareersBundleSignal = (bundleText) => {
  const bundle = String(bundleText ?? '')

  return /CareersJoin SeedlingLabs/.test(bundle)
    && /View Open Roles/.test(bundle)
    && /Open Roles/.test(bundle)
    && /#openings/.test(bundle)
    && /mailto:info@seedlinglabs\.com/.test(bundle)
    && /openings-list/.test(bundle)
    && collectRoleMatches(bundle).length > 0
}

export const extractCareerListings = (bundleText) => {
  if (!hasOfficialCareersBundleSignal(bundleText)) {
    throw new Error('Seedling Labs verified careers bundle no longer matches the trusted first-party surface')
  }

  // The current public careers SPA inlines roles as a compact array in the first-party bundle.
  const listings = collectRoleMatches(bundleText)
    .map((match) => {
      const title = normalizeWhitespace(match[1])
      const department = normalizeWhitespace(match[2])
      const locationText = normalizeWhitespace(match[3])
      const employmentType = normalizeWhitespace(match[4])
      const locationMeta = buildLocation(locationText)
      const requisitionId = slugify(SOURCE, title, locationMeta.city, locationMeta.state)

      if (!title || !locationMeta.location || !requisitionId) return null

      return {
        title,
        company: COMPANY,
        department,
        location: locationMeta.location,
        city: locationMeta.city,
        state: locationMeta.state,
        country: locationMeta.country,
        jobId: requisitionId,
        requisitionId,
        sourceUrl: CAREERS_URL,
        applyUrl: APPLY_URL,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: buildJobDescription({
          title,
          department,
          location: locationMeta.location,
          employmentType,
        }),
      }
    })
    .filter(Boolean)

  if (listings.length === 0) {
    throw new Error('Seedling Labs verified careers bundle no longer exposes public role listings')
  }

  return listings
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/javascript,application/javascript,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSeedlingLabsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialSiteShellSignal(homepageHtml)) {
      throw new Error('Seedling Labs verified official site shell no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialSiteShellSignal(careersHtml)) {
      throw new Error('Seedling Labs verified careers route no longer matches the trusted first-party site shell')
    }

    const bundleAssetPath = extractBundleAssetPath(careersHtml)
    if (!bundleAssetPath) {
      throw new Error('Seedling Labs verified careers route no longer exposes the trusted first-party client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)
    const jobs = extractCareerListings(bundleText)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: CAREERS_URL,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'seedlinglabs.com',
      atsPlatform: 'official-company-careers',
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSeedlingLabsScraper().run(options)

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
