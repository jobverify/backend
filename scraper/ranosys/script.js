import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const LANDING_URL = provider.homepageUrl
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareerLandingSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*Careers at Ranosys\s*\|\s*IT Software Jobs in US, India \(Jaipur\), Singapore\s*<\/title>/i.test(page)
    && text.includes('Ranosys - Your next career destination')
    && text.includes('CURRENT OPENINGS')
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*Current Openings/i.test(page)
    && /placeholder=["'][^"']*See all open positions/i.test(page)
    && /current-opening-section/i.test(page)
  }

export const extractCurrentOpenings = (html = '') => {
  const rows = String(html ?? '').match(/<tr data-title="[\s\S]*?<\/tr>/gi) || []

  return rows.map((row) => {
    const title = normalizeWhitespace(row.match(/<td[^>]*views-field-title[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1])
    const sourceUrl = normalizeWhitespace(row.match(/<td[^>]*views-field-title[\s\S]*?<a[^>]*href=["']([^"']+)["']/i)?.[1])
    const experienceRequired = normalizeWhitespace(row.match(/views-field-field-job-experience[^>]*>([\s\S]*?)<\/td>/i)?.[1])
    const rawLocation = normalizeWhitespace(row.match(/views-field-field-job-location-new-1[^>]*>([\s\S]*?)<\/td>/i)?.[1])
    const city = normalizeWhitespace(String(rawLocation ?? '').split(',')[0]) || null

    return {
      title,
      sourceUrl,
      applyUrl: sourceUrl,
      experienceRequired,
      location: rawLocation,
      city,
      remoteStatus: /remote/i.test(rawLocation ?? '') ? 'Remote' : null,
    }
  }).filter((job) => job.title && job.sourceUrl && job.location)
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const landingHtml = await fetchText(LANDING_URL)
  if (!hasOfficialCareerLandingSignal(landingHtml)) {
    throw new Error('Ranosys Technologies verified career landing page no longer matches the trusted first-party surface')
  }

  const openingsHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCurrentOpeningsSignal(openingsHtml)) {
    throw new Error('Ranosys Technologies verified current openings table no longer matches the trusted first-party surface')
  }

  return extractCurrentOpenings(openingsHtml).map((job) => ({
    title: job.title,
    company: COMPANY,
    department: null,
    location: job.location,
    city: job.city,
    state: null,
    country: 'India',
    jobId: null,
    requisitionId: null,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    employmentType: null,
    experienceRequired: job.experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: job.remoteStatus,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: provider.companyDomain,
    atsPlatform: provider.atsPlatform,
    link: job.applyUrl,
    scrapedAt: new Date().toISOString(),
  }))
}

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
