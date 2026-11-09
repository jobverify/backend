import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SHIPSY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SHIPSY_CATALOG
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
  .replace(/&middot;/gi, '·')

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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractFieldValue = (lines, label) => {
  const index = lines.findIndex((line) => line === label)
  return index >= 0 ? lines[index + 1] || null : null
}

const extractTitleFromCardText = (text) => {
  const candidates = [
    'Senior Director, Customer Solutions',
    'Associate Director, Customer Solutions',
    'Deployment Strategist',
    'Forward Deployed Engineer',
    'Director, Engineering',
    'Software Engineer, Core Platform',
    'Head of Global Partnerships & Alliances',
  ]

  return candidates.find((candidate) => text.includes(candidate)) || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = (normalizeWhitespace(stripScriptsAndStyles(html)) || '').toLowerCase()

  return normalized.includes('come drive the future of logistics')
    && normalized.includes('open roles')
    && normalized.includes('careers@shipsy.io')
    && normalized.includes('software engineer, core platform')
}

export const extractRoleCards = (html = '') => [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map((match) => {
    const href = match[1]
    const text = normalizeWhitespace(match[2])
    if (!href || !text || !href.includes('/careers/') || href.endsWith('/careers')) return null
    const title = extractTitleFromCardText(text)
    if (!title) return null

    return {
      title,
      detailUrl: new URL(href, CAREERS_URL).toString(),
    }
  })
  .filter((card, index, array) => card && array.findIndex((item) => item?.detailUrl === card.detailUrl) === index)

export const extractJobFromDetailHtml = (html = '', card = {}, { scrapedAt } = {}) => {
  const lines = htmlToLines(html)
  const title = lines.find((line) => line === card.title) || card.title
  const department = extractFieldValue(lines, 'Team')
  const experienceRequired = extractFieldValue(lines, 'Experience')
  const employmentType = extractFieldValue(lines, 'Employment')
  const location = lines.find((line) => /\bGurugram\b/i.test(line)) || null
  const requiredSkills = lines.find((line) => line === 'Strong foundations. Generalist by design.')
    ? ['Strong foundations. Generalist by design.']
    : []
  const jobDescriptionIndex = lines.findIndex((line) => line === 'About the role')
  const showInterestIndex = lines.findIndex((line) => line === 'Show your interest')
  const jobDescription = jobDescriptionIndex >= 0
    ? normalizeWhitespace(lines.slice(jobDescriptionIndex + 1, showInterestIndex >= 0 ? showInterestIndex : undefined).join(' '))
    : null
  const applyUrl = String(html ?? '').match(/href=["'](mailto:[^"']*careers@shipsy\.io[^"']*)["']/i)?.[1]
    || 'mailto:careers@shipsy.io'
  const jobId = String(card.detailUrl ?? '').split('/').filter(Boolean).at(-1) || null

  if (!title || !jobId || !location) return null

  return {
    title,
    company: COMPANY,
    department,
    location: 'Gurugram, India',
    city: 'Gurugram',
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: card.detailUrl,
    applyUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: 'On-site',
    source: SOURCE,
    link: card.detailUrl,
    scrapedAt,
  }
}

export const createShipsyScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Shipsy careers page no longer matches the trusted first-party surface')
    }

    const roleCards = extractRoleCards(careersHtml)
    if (roleCards.length === 0) {
      throw new Error('The verified Shipsy careers page no longer exposes the expected role links')
    }

    const jobs = []
    for (const card of roleCards) {
      const detailHtml = await fetchText(card.detailUrl)
      const job = extractJobFromDetailHtml(detailHtml, card, { scrapedAt: now() })
      if (job) jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('Shipsy verified first-party detail pages no longer return India-normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createShipsyScraper().run(options)

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
