import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'cromptongreaves'
export const COMPANY = 'Crompton Greaves Consumer Electricals Limited'
export const CAREER_PAGE_URL = 'https://www.crompton.co.in/pages/careers'
export const APPLICATION_EMAIL = 'recruitment@crompton.co.in'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREER_PAGE_URL,
  companyDomain: 'crompton.co.in',
  adapter: 'script',
  atsPlatform: 'shopify-careers-page',
  modulePath: '../../scraper/cromptongreaves/script.js',
  dryRunFile: 'cromptongreaves/jobs.json',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+html-current-openings-list+mailto-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified the first-party Crompton careers page on crompton.co.in. The public Current Openings list is rendered in HTML and Apply Now links use mailto:recruitment@crompton.co.in.',
}

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/[\u2013\u2014\u2212\uFF0D]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const formatLocation = (locationText) => {
  const normalized = normalizeWhitespace(locationText)
  if (!normalized || /^india$/i.test(normalized)) {
    return { location: 'India', city: null }
  }

  if (/^all india\b/i.test(normalized)) {
    return { location: normalized, city: null }
  }

  return {
    location: `${normalized}, India`,
    city: normalized,
  }
}

const extractJobCards = (html) => Array.from(
  String(html ?? '').matchAll(
    /<li\b[^>]*class=["'][^"']*\bscale-anm\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi,
  ),
  (match) => {
    const cardHtml = match[1]
    const titleAndLocation = stripTags(
      cardHtml.match(/<span>([\s\S]*?)<div\b[^>]*class=["'][^"']*career_badge/i)?.[1],
    )
    const badge = stripTags(
      cardHtml.match(/<span\b[^>]*class=["'][^"']*badge[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    )
    const applyUrl = normalizeWhitespace(
      cardHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1],
    )
    const parts = titleAndLocation?.split(/\s+-\s+/) || []
    const locationText = parts.pop()

    return {
      title: normalizeWhitespace(parts.join(' - ')),
      locationText,
      department: badge,
      applyUrl,
    }
  },
).filter((entry) => entry.title && entry.locationText && entry.applyUrl)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return (
    /<h2>\s*Current Openings\s*<\/h2>/i.test(page)
    && /<ul\b[^>]*class=["'][^"']*career_list[^"']*["'][^>]*id=["']filter-sec["']/i.test(page)
    && new RegExp(`mailto:${APPLICATION_EMAIL}`, 'i').test(page)
  )
}

export const extractSearchResults = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    return []
  }

  return extractJobCards(html)
    .map((entry) => {
      const { location, city } = formatLocation(entry.locationText)

      return {
        title: entry.title,
        company: COMPANY,
        department: entry.department,
        location,
        city,
        country: 'India',
        jobId: `${SOURCE}-${slugify(`${entry.title}-${entry.locationText}`)}`,
        requisitionId: null,
        sourceUrl: CAREER_PAGE_URL,
        applyUrl: CAREER_PAGE_URL,
        employmentType: null,
        experienceRequired: null,
        publicExperienceChecked: true,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: `Apply via the Crompton Greaves careers page or email ${APPLICATION_EMAIL}.`,
      }
    })
    .sort((left, right) => left.title.localeCompare(right.title) || left.location.localeCompare(right.location))
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createCromptonGreavesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const html = await (options.fetchText || defaultFetchText)(CAREER_PAGE_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Crompton Greaves careers page no longer exposes the verified current openings markup')
    }

    const jobs = extractSearchResults(html)
    const limitedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return limitedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createCromptonGreavesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Crompton Greaves India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}

