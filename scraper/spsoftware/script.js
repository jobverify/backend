import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SP_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_BUNDLE_URL = PROVIDER_METADATA.careersBundleUrl
export const CAREERS_EMAIL = 'careers@spsoftglobal.com'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const stripLocationDecorators = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\([^)]*\)/g, ' '),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*SPSoft\s*<\/title>/i.test(page)
    && /<app-root>\s*<\/app-root>/i.test(page)
    && (
      /app-career-career-module\.js/i.test(page)
      || (
        /<base\s+href="\/">/i.test(page)
        && /<body[^>]*mat-typography/i.test(page)
        && /<script[^>]+src="runtime\.js"/i.test(page)
        && /<script[^>]+src="main\.js"/i.test(page)
      )
    )
}

export const hasVerifiedCareerBundleSignal = (bundleText = '') => {
  const text = String(bundleText ?? '')

  return /careers@spsoftglobal\.com/i.test(text)
    && /#\s*001582-\s*[\s\S]*?Java Developer/i.test(text)
    && /#\s*001585-\s*[\s\S]*?\.NET Developer/i.test(text)
}

const decodeCompiledTextLiteral = (value) => {
  try {
    return JSON.parse(`"${String(value ?? '')}"`)
  } catch {
    return String(value ?? '')
  }
}

const extractCompiledTextLines = (bundleText = '') =>
  [...String(bundleText ?? '').matchAll(/ɵɵtext"\]\(\d+,\s*"((?:[^"\\]|\\.)*)"\);/g)]
    .map(([, value]) => normalizeWhitespace(decodeCompiledTextLiteral(value)))
    .filter(Boolean)

const normalizeBundleText = (bundleText = '') => {
  const compiledLines = extractCompiledTextLines(bundleText)
  if (compiledLines.some((line) => /^#\d{6}-$/.test(line))) {
    return compiledLines.join('\n')
  }

  return String(bundleText ?? '')
}

const parseBundleSections = (bundleText = '') =>
  [...normalizeBundleText(bundleText).matchAll(/#\s*(\d{6})-\s*([\s\S]*?)(?=(?:#\s*\d{6}-)|$)/g)]
    .map(([, jobId, block]) => ({ jobId, block }))

const mapSectionToJob = ({ jobId, block } = {}) => {
  const lines = String(block ?? '')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/careers@spsoftglobal\.com/i.test(line))

  const header = lines.shift()
  const headerMatch = /^(.+?):\s*([^,]+),\s*Location:\s*(.+)$/i.exec(header ?? '')
  if (!headerMatch) return null

  const title = normalizeWhitespace(headerMatch[1])
  const experienceRequired = normalizeWhitespace(headerMatch[2])
  const locationText = normalizeWhitespace(headerMatch[3])
  const city = stripLocationDecorators(locationText)
  const sectionLines = lines.filter(Boolean)
  let minimumQualification = null
  let captureQualification = false

  const requiredSkills = sectionLines.filter((line) => {
    if (/careers@spsoftglobal\.com/i.test(line)) return false
    if (/^Job Description:/i.test(line)) return false
    if (/^Skills Set:/i.test(line)) return false
    if (/^Educational Qualification:/i.test(line)) {
      captureQualification = true
      return false
    }
    if (/^Send your CV to\b/i.test(line)) {
      captureQualification = false
      return false
    }
    if (captureQualification && !minimumQualification) {
      minimumQualification = line
      captureQualification = false
      return false
    }

    return true
  })

  if (!title || !city) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location: `${city}, India`,
    city,
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl: `mailto:${CAREERS_EMAIL}`,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: requiredSkills.length > 0 ? requiredSkills.join(' ') : null,
    remoteStatus: /\bWFO\b/i.test(locationText ?? '') ? 'On-site' : null,
  }
}

export const extractIndiaJobs = (bundleText = '') => parseBundleSections(bundleText)
  .map((section) => mapSectionToJob(section))
  .filter(Boolean)

export const createSpSoftwareScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('The verified SP Software careers page no longer matches the trusted first-party surface')
    }

    const careersBundleText = await fetchText(CAREERS_BUNDLE_URL)
    if (!hasVerifiedCareerBundleSignal(careersBundleText)) {
      throw new Error('The verified SP Software careers bundle no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobs(careersBundleText)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSpSoftwareScraper().run(options)

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
